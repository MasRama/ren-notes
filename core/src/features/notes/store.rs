use rusqlite::{params, params_from_iter, OptionalExtension, Row};

use super::derive::clamp;
use super::model::{DocFormat, Note, NoteFilter, NoteSort, NoteSummary, SaveNote, EMPTY_DOC};
use crate::features::tags::parse_tags;
use crate::shared::db::Db;
use crate::shared::error::{Error, Result};
use crate::shared::ids::new_id;

const SUMMARY_COLUMNS: &str = "id, folder_id, title, snippet, first_image_id, pinned,
    has_checklist, has_attachment, created_at, updated_at, deleted_at";

fn summary_from(row: &Row) -> rusqlite::Result<NoteSummary> {
    Ok(NoteSummary {
        id: row.get(0)?,
        folder_id: row.get(1)?,
        title: row.get(2)?,
        snippet: row.get(3)?,
        first_image_id: row.get(4)?,
        pinned: row.get(5)?,
        has_checklist: row.get(6)?,
        has_attachment: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
        deleted_at: row.get(10)?,
    })
}

pub fn create(db: &mut Db, folder_id: &str) -> Result<Note> {
    let id = new_id();
    db.tx(|tx, now| {
        let folder: Option<String> = tx
            .query_row("SELECT id FROM folders WHERE id = ?1", [folder_id], |r| {
                r.get(0)
            })
            .optional()?;
        folder.ok_or(Error::NotFound("folder"))?;
        tx.execute(
            "INSERT INTO notes (id, folder_id, doc_json, doc_format, created_at, updated_at)
             VALUES (?1, ?2, ?3, 'tiptap', ?4, ?4)",
            params![id, folder_id, EMPTY_DOC, now],
        )?;
        Ok(())
    })?;
    get(db, &id)
}

pub fn get(db: &Db, id: &str) -> Result<Note> {
    db.conn()
        .query_row(
            &format!("SELECT {SUMMARY_COLUMNS}, doc_json, doc_format FROM notes WHERE id = ?1"),
            [id],
            |row| {
                let format: String = row.get(12)?;
                Ok(Note {
                    summary: summary_from(row)?,
                    doc_json: row.get(11)?,
                    doc_format: if format == "legacy_html" {
                        DocFormat::LegacyHtml
                    } else {
                        DocFormat::Tiptap
                    },
                })
            },
        )
        .optional()?
        .ok_or(Error::NotFound("note"))
}

/// Stores the editor's document and what it derived from it. Tags come from
/// the plain text; only attachments the library knows are linked.
pub fn save(db: &mut Db, id: &str, mut input: SaveNote) -> Result<NoteSummary> {
    clamp(&mut input);
    let tags = parse_tags(&input.plain_text);
    db.tx(|tx, now| {
        let exists: Option<String> = tx
            .query_row(
                "SELECT id FROM notes WHERE id = ?1 AND deleted_at IS NULL",
                [id],
                |r| r.get(0),
            )
            .optional()?;
        exists.ok_or(Error::NotFound("note"))?;

        tx.execute("DELETE FROM note_attachments WHERE note_id = ?1", [id])?;
        let mut first_image: Option<String> = None;
        let mut linked = 0;
        for attachment in &input.attachment_ids {
            let mime: Option<String> = tx
                .query_row(
                    "SELECT mime FROM attachments WHERE id = ?1",
                    [attachment],
                    |r| r.get(0),
                )
                .optional()?;
            let Some(mime) = mime else { continue };
            linked += tx.execute(
                "INSERT OR IGNORE INTO note_attachments (note_id, attachment_id) VALUES (?1, ?2)",
                [id, attachment],
            )?;
            if first_image.is_none() && mime.starts_with("image/") {
                first_image = Some(attachment.clone());
            }
        }

        tx.execute("DELETE FROM note_tags WHERE note_id = ?1", [id])?;
        for tag in &tags {
            tx.execute(
                "INSERT INTO note_tags (note_id, tag) VALUES (?1, ?2)",
                [id, tag],
            )?;
        }

        tx.execute(
            "UPDATE notes SET doc_json = ?2, doc_format = 'tiptap', title = ?3, snippet = ?4,
                plain_text = ?5, has_checklist = ?6, has_attachment = ?7, first_image_id = ?8,
                updated_at = ?9
             WHERE id = ?1",
            params![
                id,
                input.doc_json,
                input.title,
                input.snippet,
                input.plain_text,
                input.has_checklist,
                linked > 0,
                first_image,
                now
            ],
        )?;
        Ok(tx.query_row(
            &format!("SELECT {SUMMARY_COLUMNS} FROM notes WHERE id = ?1"),
            [id],
            summary_from,
        )?)
    })
}

/// Notes for one view. Pinned notes come first, except in Recently Deleted,
/// which shows the most recently deleted first.
pub fn list(db: &Db, filter: &NoteFilter, sort: NoteSort) -> Result<Vec<NoteSummary>> {
    let mut args: Vec<String> = Vec::new();
    let condition = match filter {
        NoteFilter::All => "deleted_at IS NULL".to_owned(),
        NoteFilter::Trash => "deleted_at IS NOT NULL".to_owned(),
        NoteFilter::Folder(folder) => {
            args.push(folder.clone());
            "deleted_at IS NULL AND folder_id = ?1".to_owned()
        }
        NoteFilter::Tags(tags) => {
            let mut wanted: Vec<String> = tags.iter().map(|t| t.to_lowercase()).collect();
            wanted.sort();
            wanted.dedup();
            let marks = vec!["?"; wanted.len()].join(", ");
            let count = wanted.len();
            args.extend(wanted);
            format!(
                "deleted_at IS NULL AND id IN (
                    SELECT note_id FROM note_tags WHERE tag IN ({marks})
                    GROUP BY note_id HAVING count(DISTINCT tag) = {count})"
            )
        }
    };
    let order = match (filter, sort) {
        (NoteFilter::Trash, _) => "deleted_at DESC, id DESC",
        (_, NoteSort::Edited) => "pinned DESC, updated_at DESC, id DESC",
        (_, NoteSort::Created) => "pinned DESC, created_at DESC, id DESC",
        (_, NoteSort::Title) => "pinned DESC, title COLLATE NOCASE, updated_at DESC",
    };
    let sql = format!("SELECT {SUMMARY_COLUMNS} FROM notes WHERE {condition} ORDER BY {order}");
    let notes = db
        .conn()
        .prepare(&sql)?
        .query_map(params_from_iter(args.iter()), summary_from)?
        .collect::<std::result::Result<_, _>>()?;
    Ok(notes)
}

pub fn move_to(db: &mut Db, id: &str, folder_id: &str) -> Result<()> {
    db.tx(|tx, _| {
        let folder: Option<String> = tx
            .query_row("SELECT id FROM folders WHERE id = ?1", [folder_id], |r| {
                r.get(0)
            })
            .optional()?;
        folder.ok_or(Error::NotFound("folder"))?;
        let changed = tx.execute(
            "UPDATE notes SET folder_id = ?2 WHERE id = ?1 AND deleted_at IS NULL",
            [id, folder_id],
        )?;
        if changed == 0 {
            return Err(Error::NotFound("note"));
        }
        Ok(())
    })
}

/// Pins or unpins a note. Like the Mac, this is not an edit: the time stays.
pub fn set_pinned(db: &mut Db, id: &str, pinned: bool) -> Result<()> {
    let changed = db.conn().execute(
        "UPDATE notes SET pinned = ?2 WHERE id = ?1",
        params![id, pinned],
    )?;
    if changed == 0 {
        return Err(Error::NotFound("note"));
    }
    Ok(())
}

/// Moves a note to Recently Deleted, remembering its folder.
pub fn delete(db: &mut Db, id: &str) -> Result<()> {
    db.tx(|tx, now| {
        let changed = tx.execute(
            "UPDATE notes SET deleted_at = ?2, deleted_from_folder_id = folder_id
             WHERE id = ?1 AND deleted_at IS NULL",
            params![id, now],
        )?;
        if changed == 0 {
            return Err(Error::NotFound("note"));
        }
        Ok(())
    })
}

/// Removes a note for good if it holds nothing, as when you leave a new note
/// without typing. Returns whether it was removed.
pub fn delete_if_empty(db: &mut Db, id: &str) -> Result<bool> {
    let removed = db.conn().execute(
        "DELETE FROM notes WHERE id = ?1 AND trim(title) = '' AND trim(plain_text) = ''
           AND has_attachment = 0",
        [id],
    )?;
    Ok(removed > 0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::folders::{self, DEFAULT_FOLDER_ID};
    use crate::shared::error::Error;
    use crate::shared::testing::{temp_db, TestDb, START_MS};

    fn text(plain: &str) -> SaveNote {
        SaveNote {
            doc_json: "{}".into(),
            title: plain.lines().next().unwrap_or("").into(),
            snippet: String::new(),
            plain_text: plain.into(),
            has_checklist: false,
            attachment_ids: vec![],
        }
    }

    fn tags_of(t: &TestDb, id: &str) -> Vec<String> {
        t.db.conn()
            .prepare("SELECT tag FROM note_tags WHERE note_id = ?1 ORDER BY tag")
            .unwrap()
            .query_map([id], |r| r.get(0))
            .unwrap()
            .collect::<std::result::Result<_, _>>()
            .unwrap()
    }

    fn ids(notes: &[NoteSummary]) -> Vec<&str> {
        notes.iter().map(|n| n.id.as_str()).collect()
    }

    fn note_count(t: &TestDb) -> i64 {
        t.db.conn()
            .query_row("SELECT count(*) FROM notes", [], |r| r.get(0))
            .unwrap()
    }

    #[test]
    fn create_in_folder_starts_empty() {
        let mut t = temp_db();
        let note = create(&mut t.db, DEFAULT_FOLDER_ID).unwrap();
        assert_eq!(note.doc_json, EMPTY_DOC);
        assert_eq!(note.doc_format, DocFormat::Tiptap);
        assert_eq!(note.summary.title, "");
        assert_eq!(note.summary.created_at, START_MS);
        assert_eq!(note.summary.updated_at, START_MS);
        assert_eq!(get(&t.db, &note.summary.id).unwrap(), note);
    }

    #[test]
    fn create_in_missing_folder_not_found() {
        let mut t = temp_db();
        assert!(matches!(create(&mut t.db, "nope"), Err(Error::NotFound(_))));
    }

    #[test]
    fn get_missing_not_found() {
        let t = temp_db();
        assert!(matches!(get(&t.db, "nope"), Err(Error::NotFound(_))));
    }

    #[test]
    fn save_updates_fields_tags_and_time() {
        let mut t = temp_db();
        let id = create(&mut t.db, DEFAULT_FOLDER_ID).unwrap().summary.id;
        t.clock.advance(1000);
        let summary = save(&mut t.db, &id, text("Groceries\nBuy #milk")).unwrap();
        assert_eq!(summary.updated_at, START_MS + 1000);
        assert_eq!(summary.created_at, START_MS);
        assert_eq!(summary.title, "Groceries");
        assert_eq!(tags_of(&t, &id), ["milk"]);

        save(&mut t.db, &id, text("nothing")).unwrap();
        assert!(tags_of(&t, &id).is_empty());
    }

    #[test]
    fn save_missing_note_not_found() {
        let mut t = temp_db();
        assert!(matches!(
            save(&mut t.db, "ghost", text("x")),
            Err(Error::NotFound(_))
        ));
        assert_eq!(note_count(&t), 0);
    }

    #[test]
    fn save_keeps_only_known_attachments() {
        let mut t = temp_db();
        t.db.conn()
            .execute(
                "INSERT INTO attachments VALUES ('pdf', 'application/pdf', 'a.pdf', 1, NULL, NULL, 0),
                                                ('a1', 'image/png', 'a.png', 1, 4, 4, 0)",
                [],
            )
            .unwrap();
        let id = create(&mut t.db, DEFAULT_FOLDER_ID).unwrap().summary.id;
        let mut input = text("pics");
        input.attachment_ids = vec!["pdf".into(), "zz".into(), "a1".into()];
        let summary = save(&mut t.db, &id, input).unwrap();
        assert!(summary.has_attachment);
        assert_eq!(summary.first_image_id.as_deref(), Some("a1"));
        let linked: i64 =
            t.db.conn()
                .query_row(
                    "SELECT count(*) FROM note_attachments WHERE note_id = ?1",
                    [&id],
                    |r| r.get(0),
                )
                .unwrap();
        assert_eq!(linked, 2);
    }

    #[test]
    fn save_turns_legacy_into_tiptap() {
        let mut t = temp_db();
        let id = create(&mut t.db, DEFAULT_FOLDER_ID).unwrap().summary.id;
        t.db.conn()
            .execute(
                "UPDATE notes SET doc_format = 'legacy_html' WHERE id = ?1",
                [&id],
            )
            .unwrap();
        assert_eq!(get(&t.db, &id).unwrap().doc_format, DocFormat::LegacyHtml);
        save(&mut t.db, &id, text("x")).unwrap();
        assert_eq!(get(&t.db, &id).unwrap().doc_format, DocFormat::Tiptap);
    }

    #[test]
    fn save_trashed_note_not_found() {
        let mut t = temp_db();
        let id = create(&mut t.db, DEFAULT_FOLDER_ID).unwrap().summary.id;
        delete(&mut t.db, &id).unwrap();
        assert!(matches!(
            save(&mut t.db, &id, text("x")),
            Err(Error::NotFound(_))
        ));
    }

    #[test]
    fn list_folder_pinned_first_then_sort() {
        let mut t = temp_db();
        let make = |t: &mut TestDb, title: &str| {
            t.clock.advance(10);
            let id = create(&mut t.db, DEFAULT_FOLDER_ID).unwrap().summary.id;
            save(&mut t.db, &id, text(title)).unwrap();
            id
        };
        let oldest = make(&mut t, "banana");
        let middle = make(&mut t, "Apple");
        let newest = make(&mut t, "cherry");
        set_pinned(&mut t.db, &oldest, true).unwrap();

        let folder = NoteFilter::Folder(DEFAULT_FOLDER_ID.into());
        let edited = list(&t.db, &folder, NoteSort::Edited).unwrap();
        assert_eq!(ids(&edited), [&oldest, &newest, &middle]);
        assert!(edited[0].pinned);

        let by_title = list(&t.db, &folder, NoteSort::Title).unwrap();
        assert_eq!(ids(&by_title), [&oldest, &middle, &newest]);

        let created = list(&t.db, &folder, NoteSort::Created).unwrap();
        assert_eq!(ids(&created), [&oldest, &newest, &middle]);
    }

    #[test]
    fn pinning_does_not_change_edit_time() {
        let mut t = temp_db();
        let id = create(&mut t.db, DEFAULT_FOLDER_ID).unwrap().summary.id;
        t.clock.advance(50);
        set_pinned(&mut t.db, &id, true).unwrap();
        assert_eq!(get(&t.db, &id).unwrap().summary.updated_at, START_MS);
    }

    #[test]
    fn list_all_excludes_trash_and_trash_lists_only_deleted() {
        let mut t = temp_db();
        let kept = create(&mut t.db, DEFAULT_FOLDER_ID).unwrap().summary.id;
        let gone = create(&mut t.db, DEFAULT_FOLDER_ID).unwrap().summary.id;
        delete(&mut t.db, &gone).unwrap();
        assert_eq!(
            ids(&list(&t.db, &NoteFilter::All, NoteSort::Edited).unwrap()),
            [&kept]
        );
        let trash = list(&t.db, &NoteFilter::Trash, NoteSort::Edited).unwrap();
        assert_eq!(ids(&trash), [&gone]);
        assert_eq!(trash[0].deleted_at, Some(START_MS));
    }

    #[test]
    fn list_tags_requires_all_tags() {
        let mut t = temp_db();
        let both = create(&mut t.db, DEFAULT_FOLDER_ID).unwrap().summary.id;
        let one = create(&mut t.db, DEFAULT_FOLDER_ID).unwrap().summary.id;
        save(&mut t.db, &both, text("#a #b")).unwrap();
        save(&mut t.db, &one, text("#a")).unwrap();
        let filter = NoteFilter::Tags(vec!["a".into(), "B".into()]);
        assert_eq!(
            ids(&list(&t.db, &filter, NoteSort::Edited).unwrap()),
            [&both]
        );
    }

    #[test]
    fn move_to_other_folder() {
        let mut t = temp_db();
        let work = folders::create(&mut t.db, "Work", None).unwrap();
        let id = create(&mut t.db, DEFAULT_FOLDER_ID).unwrap().summary.id;
        move_to(&mut t.db, &id, &work.id).unwrap();
        assert_eq!(get(&t.db, &id).unwrap().summary.folder_id, work.id);
        assert!(matches!(
            move_to(&mut t.db, &id, "nope"),
            Err(Error::NotFound(_))
        ));
    }

    #[test]
    fn delete_to_trash_records_origin() {
        let mut t = temp_db();
        let work = folders::create(&mut t.db, "Work", None).unwrap();
        let id = create(&mut t.db, &work.id).unwrap().summary.id;
        t.clock.advance(5);
        delete(&mut t.db, &id).unwrap();
        let (deleted_at, from): (Option<i64>, Option<String>) =
            t.db.conn()
                .query_row(
                    "SELECT deleted_at, deleted_from_folder_id FROM notes WHERE id = ?1",
                    [&id],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .unwrap();
        assert_eq!(deleted_at, Some(START_MS + 5));
        assert_eq!(from, Some(work.id));
    }

    #[test]
    fn delete_if_empty_removes_only_empty_notes() {
        let mut t = temp_db();
        let empty = create(&mut t.db, DEFAULT_FOLDER_ID).unwrap().summary.id;
        let full = create(&mut t.db, DEFAULT_FOLDER_ID).unwrap().summary.id;
        save(&mut t.db, &full, text("hello #x")).unwrap();
        assert!(delete_if_empty(&mut t.db, &empty).unwrap());
        assert!(!delete_if_empty(&mut t.db, &full).unwrap());
        assert_eq!(note_count(&t), 1);
    }
}

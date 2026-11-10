use rusqlite::{params, OptionalExtension, Transaction};

use super::model::{Folder, DEFAULT_FOLDER_ID};
use crate::shared::db::Db;
use crate::shared::error::{Error, Result};
use crate::shared::ids::new_id;

/// Every folder: the default one first, then each parent's children in order.
pub fn list(db: &Db) -> Result<Vec<Folder>> {
    let mut stmt = db.conn().prepare(
        "SELECT f.id, f.parent_id, f.name, f.sort_index,
                (SELECT count(*) FROM notes n WHERE n.folder_id = f.id AND n.deleted_at IS NULL)
         FROM folders f
         ORDER BY f.id <> ?1, f.parent_id IS NOT NULL, f.parent_id, f.sort_index, f.name",
    )?;
    let folders = stmt
        .query_map([DEFAULT_FOLDER_ID], |row| {
            let id: String = row.get(0)?;
            Ok(Folder {
                is_default: id == DEFAULT_FOLDER_ID,
                id,
                parent_id: row.get(1)?,
                name: row.get(2)?,
                sort_index: row.get(3)?,
                note_count: row.get(4)?,
            })
        })?
        .collect::<std::result::Result<_, _>>()?;
    Ok(folders)
}

/// Creates a folder at the end of its parent's children.
pub fn create(db: &mut Db, name: &str, parent_id: Option<&str>) -> Result<Folder> {
    let name = clean_name(name)?;
    db.tx(|tx, now| {
        if let Some(parent) = parent_id {
            ensure_exists(tx, parent)?;
        }
        ensure_name_free(tx, parent_id, &name, None)?;
        let id = new_id();
        let sort_index: i64 = tx.query_row(
            "SELECT coalesce(max(sort_index), 0) + 1 FROM folders WHERE parent_id IS ?1",
            [parent_id],
            |row| row.get(0),
        )?;
        tx.execute(
            "INSERT INTO folders (id, parent_id, name, sort_index, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
            params![id, parent_id, name, sort_index, now],
        )?;
        Ok(Folder {
            id,
            parent_id: parent_id.map(str::to_owned),
            name,
            sort_index,
            note_count: 0,
            is_default: false,
        })
    })
}

pub fn rename(db: &mut Db, id: &str, name: &str) -> Result<()> {
    let name = clean_name(name)?;
    db.tx(|tx, now| {
        let parent = parent_of(tx, id)?;
        ensure_name_free(tx, parent.as_deref(), &name, Some(id))?;
        tx.execute(
            "UPDATE folders SET name = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, name, now],
        )?;
        Ok(())
    })
}

/// Puts a folder under `parent_id` (or at the top) at position `index` among
/// its new siblings. The default folder always stays first at the top.
pub fn move_to(db: &mut Db, id: &str, parent_id: Option<&str>, index: usize) -> Result<()> {
    if id == DEFAULT_FOLDER_ID {
        return Err(Error::Forbidden("the Notes folder cannot be moved"));
    }
    db.tx(|tx, now| {
        let name: String = tx
            .query_row("SELECT name FROM folders WHERE id = ?1", [id], |row| {
                row.get(0)
            })
            .optional()?
            .ok_or(Error::NotFound("folder"))?;
        if let Some(parent) = parent_id {
            ensure_exists(tx, parent)?;
            if parent == id || ancestors(tx, parent)?.iter().any(|a| a == id) {
                return Err(Error::InvalidInput(
                    "a folder cannot go inside itself".to_owned(),
                ));
            }
        }
        ensure_name_free(tx, parent_id, &name, Some(id))?;

        let mut siblings: Vec<String> = tx
            .prepare(
                "SELECT id FROM folders WHERE parent_id IS ?1 AND id <> ?2 AND id <> ?3
                 ORDER BY sort_index, name",
            )?
            .query_map(params![parent_id, id, DEFAULT_FOLDER_ID], |row| row.get(0))?
            .collect::<std::result::Result<_, _>>()?;
        siblings.insert(index.min(siblings.len()), id.to_owned());
        tx.execute(
            "UPDATE folders SET parent_id = ?2, updated_at = ?3 WHERE id = ?1",
            params![id, parent_id, now],
        )?;
        for (position, sibling) in siblings.iter().enumerate() {
            tx.execute(
                "UPDATE folders SET sort_index = ?2 WHERE id = ?1",
                params![sibling, position as i64 + 1],
            )?;
        }
        Ok(())
    })
}

/// Deletes a folder and its subfolders. Their notes go to Recently Deleted,
/// remembering the folder they came from.
pub fn delete(db: &mut Db, id: &str) -> Result<()> {
    if id == DEFAULT_FOLDER_ID {
        return Err(Error::Forbidden("the Notes folder cannot be deleted"));
    }
    db.tx(|tx, now| {
        ensure_exists(tx, id)?;
        const SUBTREE: &str = "WITH RECURSIVE subtree(id) AS (
                SELECT ?1 UNION ALL
                SELECT f.id FROM folders f JOIN subtree s ON f.parent_id = s.id
            )";
        tx.execute(
            &format!(
                "{SUBTREE}
                 UPDATE notes SET deleted_at = ?2, deleted_from_folder_id = folder_id
                 WHERE deleted_at IS NULL AND folder_id IN (SELECT id FROM subtree)"
            ),
            params![id, now],
        )?;
        tx.execute(
            &format!(
                "{SUBTREE}
                 UPDATE notes SET folder_id = ?2 WHERE folder_id IN (SELECT id FROM subtree)"
            ),
            params![id, DEFAULT_FOLDER_ID],
        )?;
        tx.execute(
            &format!("{SUBTREE} DELETE FROM folders WHERE id IN (SELECT id FROM subtree)"),
            [id],
        )?;
        Ok(())
    })
}

fn clean_name(name: &str) -> Result<String> {
    let name = name.trim();
    if name.is_empty() {
        return Err(Error::InvalidInput("a folder needs a name".to_owned()));
    }
    Ok(name.to_owned())
}

fn ensure_exists(tx: &Transaction, id: &str) -> Result<()> {
    parent_of(tx, id).map(|_| ())
}

fn parent_of(tx: &Transaction, id: &str) -> Result<Option<String>> {
    tx.query_row("SELECT parent_id FROM folders WHERE id = ?1", [id], |row| {
        row.get(0)
    })
    .optional()?
    .ok_or(Error::NotFound("folder"))
}

fn ancestors(tx: &Transaction, id: &str) -> Result<Vec<String>> {
    let ids = tx
        .prepare(
            "WITH RECURSIVE up(id) AS (
                SELECT parent_id FROM folders WHERE id = ?1
                UNION ALL
                SELECT f.parent_id FROM folders f JOIN up ON f.id = up.id
            )
            SELECT id FROM up WHERE id IS NOT NULL",
        )?
        .query_map([id], |row| row.get(0))?
        .collect::<std::result::Result<_, _>>()?;
    Ok(ids)
}

/// Sibling names compare without case, Unicode aware.
fn ensure_name_free(
    tx: &Transaction,
    parent_id: Option<&str>,
    name: &str,
    except: Option<&str>,
) -> Result<()> {
    let wanted = name.to_lowercase();
    let mut stmt = tx.prepare("SELECT id, name FROM folders WHERE parent_id IS ?1")?;
    let mut rows = stmt.query([parent_id])?;
    while let Some(row) = rows.next()? {
        let id: String = row.get(0)?;
        let existing: String = row.get(1)?;
        if Some(id.as_str()) != except && existing.to_lowercase() == wanted {
            return Err(Error::NameTaken);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::error::Error;
    use crate::shared::testing::{insert_note, temp_db, START_MS};

    fn names(db: &Db) -> Vec<String> {
        list(db).unwrap().into_iter().map(|f| f.name).collect()
    }

    #[test]
    fn default_folder_exists() {
        let t = temp_db();
        let folders = list(&t.db).unwrap();
        assert_eq!(folders.len(), 1);
        assert_eq!(folders[0].id, DEFAULT_FOLDER_ID);
        assert!(folders[0].is_default);
        assert_eq!(folders[0].note_count, 0);
    }

    #[test]
    fn create_trims_and_rejects_empty() {
        let mut t = temp_db();
        let folder = create(&mut t.db, "  Ideas ", None).unwrap();
        assert_eq!(folder.name, "Ideas");
        assert!(!folder.is_default);
        assert!(matches!(
            create(&mut t.db, "   ", None),
            Err(Error::InvalidInput(_))
        ));
    }

    #[test]
    fn create_under_missing_parent_not_found() {
        let mut t = temp_db();
        assert!(matches!(
            create(&mut t.db, "A", Some("nope")),
            Err(Error::NotFound(_))
        ));
    }

    #[test]
    fn names_unique_among_siblings_case_insensitive() {
        let mut t = temp_db();
        let work = create(&mut t.db, "Work", None).unwrap();
        create(&mut t.db, "Ideas", None).unwrap();
        assert!(matches!(
            create(&mut t.db, "ideas", None),
            Err(Error::NameTaken)
        ));
        assert!(create(&mut t.db, "Ideas", Some(&work.id)).is_ok());
        assert!(matches!(
            rename(&mut t.db, &work.id, "IDEAS"),
            Err(Error::NameTaken)
        ));
        assert!(rename(&mut t.db, &work.id, "work").is_ok());
    }

    #[test]
    fn note_count_excludes_trash() {
        let t = temp_db();
        insert_note(&t.db, "n1", DEFAULT_FOLDER_ID);
        insert_note(&t.db, "n2", DEFAULT_FOLDER_ID);
        t.db.conn()
            .execute("UPDATE notes SET deleted_at = 1 WHERE id = 'n2'", [])
            .unwrap();
        assert_eq!(list(&t.db).unwrap()[0].note_count, 1);
    }

    #[test]
    fn move_reorders_siblings() {
        let mut t = temp_db();
        create(&mut t.db, "A", None).unwrap();
        create(&mut t.db, "B", None).unwrap();
        let c = create(&mut t.db, "C", None).unwrap();
        move_to(&mut t.db, &c.id, None, 0).unwrap();
        assert_eq!(names(&t.db), ["Notes", "C", "A", "B"]);
    }

    #[test]
    fn move_into_another_folder() {
        let mut t = temp_db();
        let a = create(&mut t.db, "A", None).unwrap();
        let b = create(&mut t.db, "B", None).unwrap();
        move_to(&mut t.db, &b.id, Some(&a.id), 5).unwrap();
        let moved = list(&t.db)
            .unwrap()
            .into_iter()
            .find(|f| f.id == b.id)
            .unwrap();
        assert_eq!(moved.parent_id.as_deref(), Some(a.id.as_str()));
    }

    #[test]
    fn move_into_descendant_refused() {
        let mut t = temp_db();
        let a = create(&mut t.db, "A", None).unwrap();
        let b = create(&mut t.db, "B", Some(&a.id)).unwrap();
        assert!(matches!(
            move_to(&mut t.db, &a.id, Some(&b.id), 0),
            Err(Error::InvalidInput(_))
        ));
        assert!(matches!(
            move_to(&mut t.db, &a.id, Some(&a.id), 0),
            Err(Error::InvalidInput(_))
        ));
    }

    #[test]
    fn default_folder_cannot_be_moved_or_deleted() {
        let mut t = temp_db();
        let a = create(&mut t.db, "A", None).unwrap();
        assert!(matches!(
            delete(&mut t.db, DEFAULT_FOLDER_ID),
            Err(Error::Forbidden(_))
        ));
        assert!(matches!(
            move_to(&mut t.db, DEFAULT_FOLDER_ID, Some(&a.id), 0),
            Err(Error::Forbidden(_))
        ));
    }

    #[test]
    fn delete_moves_subtree_notes_to_trash() {
        let mut t = temp_db();
        let a = create(&mut t.db, "A", None).unwrap();
        let b = create(&mut t.db, "B", Some(&a.id)).unwrap();
        insert_note(&t.db, "n1", &a.id);
        insert_note(&t.db, "n2", &b.id);
        t.clock.advance(10);
        delete(&mut t.db, &a.id).unwrap();

        assert_eq!(names(&t.db), ["Notes"]);
        let rows: Vec<(String, Option<i64>, Option<String>)> =
            t.db.conn()
                .prepare("SELECT id, deleted_at, deleted_from_folder_id FROM notes ORDER BY id")
                .unwrap()
                .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
                .unwrap()
                .collect::<std::result::Result<_, _>>()
                .unwrap();
        assert_eq!(
            rows,
            vec![
                ("n1".to_string(), Some(START_MS + 10), Some(a.id.clone())),
                ("n2".to_string(), Some(START_MS + 10), Some(b.id.clone())),
            ]
        );
    }

    #[test]
    fn rename_missing_folder_not_found() {
        let mut t = temp_db();
        assert!(matches!(
            rename(&mut t.db, "nope", "X"),
            Err(Error::NotFound(_))
        ));
    }
}

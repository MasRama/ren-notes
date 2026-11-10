use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use zeroize::Zeroizing;

use super::crypto::{self, Cost, Key, COST};
use crate::features::notes::{
    self, clamp, link_attachments, summary_from, DocFormat, Note, NoteSummary, SaveNote,
    SUMMARY_COLUMNS,
};
use crate::features::session;
use crate::features::tags::parse_tags;
use crate::shared::db::Db;
use crate::shared::error::{Error, Result};

/// Where the password's salt, cost and check live in the kv table.
const RECORD_KEY: &str = "notes_password";
/// Sealed with the key when the password is set; opening it proves a key.
const CHECK: &[u8] = b"renotes";
const CHECK_BOUND_TO: &str = "notes-password";

/// What the page may know about the password before it is typed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PasswordInfo {
    pub hint: String,
}

#[derive(Serialize, Deserialize)]
struct Record {
    salt: String,
    cost: Cost,
    check: String,
    hint: String,
}

/// What a locked note seals: everything that would give its content away.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Sealed {
    doc_json: String,
    legacy_html: bool,
    plain_text: String,
    snippet: String,
    has_checklist: bool,
    first_image_id: Option<String>,
}

fn record(db: &Db) -> Result<Option<Record>> {
    session::get(db, RECORD_KEY)?
        .map(|value| serde_json::from_value(value).map_err(Error::from))
        .transpose()
}

/// The password's hint, or `None` when no password has been set.
pub fn password_info(db: &Db) -> Result<Option<PasswordInfo>> {
    Ok(record(db)?.map(|r| PasswordInfo { hint: r.hint }))
}

/// Sets the library's notes password, once, and returns its key.
pub fn set_password(db: &mut Db, password: &str, hint: &str) -> Result<Key> {
    if password.trim().is_empty() {
        return Err(Error::InvalidInput("a password is needed".into()));
    }
    if record(db)?.is_some() {
        return Err(Error::Forbidden("a notes password is already set"));
    }
    let salt = crypto::random::<16>();
    let key = crypto::derive(password, &salt, COST)?;
    let record = Record {
        salt: crypto::to_hex(&salt),
        cost: COST,
        check: crypto::to_hex(&crypto::seal(&key, CHECK_BOUND_TO, CHECK)?),
        hint: hint.trim().to_owned(),
    };
    session::set(db, RECORD_KEY, &serde_json::to_value(record)?)?;
    Ok(key)
}

/// The key for `password`, or `WrongPassword`.
pub fn unlock(db: &Db, password: &str) -> Result<Key> {
    let record = record(db)?.ok_or(Error::NotFound("password"))?;
    let key = crypto::derive(password, &crypto::from_hex(&record.salt)?, record.cost)?;
    crypto::unseal(&key, CHECK_BOUND_TO, &crypto::from_hex(&record.check)?)?;
    Ok(key)
}

pub fn is_locked(db: &Db, id: &str) -> Result<bool> {
    db.conn()
        .query_row("SELECT locked FROM notes WHERE id = ?1", [id], |r| r.get(0))
        .optional()?
        .ok_or(Error::NotFound("note"))
}

fn summary(db: &Db, id: &str) -> Result<NoteSummary> {
    Ok(db.conn().query_row(
        &format!("SELECT {SUMMARY_COLUMNS} FROM notes WHERE id = ?1"),
        [id],
        summary_from,
    )?)
}

/// The sealed content of a locked note, opened.
fn unsealed(db: &Db, key: &Key, id: &str) -> Result<Sealed> {
    let (locked, cipher): (bool, Vec<u8>) = db
        .conn()
        .query_row(
            "SELECT locked, cipher FROM notes WHERE id = ?1",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?
        .ok_or(Error::NotFound("note"))?;
    if !locked {
        return Err(Error::InvalidInput("the note is not locked".into()));
    }
    let plain = Zeroizing::new(crypto::unseal(key, id, &cipher)?);
    Ok(serde_json::from_slice(&plain)?)
}

fn seal(key: &Key, id: &str, content: &Sealed) -> Result<Vec<u8>> {
    let plain = Zeroizing::new(serde_json::to_vec(content)?);
    crypto::seal(key, id, &plain)
}

/// Writes what is pending in the write-ahead log into the database, so the
/// text a lock replaced does not linger beside it.
fn flush(db: &Db) -> Result<()> {
    db.conn()
        .query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |_| Ok(()))?;
    Ok(())
}

/// Locks a note: its document, text and preview are sealed; the title stays.
/// Locking is not an edit, so the time stays too.
pub fn lock(db: &mut Db, key: &Key, id: &str) -> Result<NoteSummary> {
    db.tx(|tx, _| {
        let row = tx
            .query_row(
                "SELECT locked, doc_json, doc_format, plain_text, snippet, has_checklist,
                    first_image_id
                 FROM notes WHERE id = ?1 AND deleted_at IS NULL",
                [id],
                |r| {
                    let format: String = r.get(2)?;
                    Ok((
                        r.get::<_, bool>(0)?,
                        Sealed {
                            doc_json: r.get(1)?,
                            legacy_html: format == "legacy_html",
                            plain_text: r.get(3)?,
                            snippet: r.get(4)?,
                            has_checklist: r.get(5)?,
                            first_image_id: r.get(6)?,
                        },
                    ))
                },
            )
            .optional()?;
        let (locked, content) = row.ok_or(Error::NotFound("note"))?;
        if locked {
            return Err(Error::InvalidInput("the note is already locked".into()));
        }
        tx.execute(
            "UPDATE notes SET locked = 1, cipher = ?2, doc_json = '', plain_text = '',
                snippet = '', has_checklist = 0, first_image_id = NULL
             WHERE id = ?1",
            params![id, seal(key, id, &content)?],
        )?;
        tx.execute("DELETE FROM note_tags WHERE note_id = ?1", [id])?;
        Ok(())
    })?;
    flush(db)?;
    summary(db, id)
}

/// A locked note with its document opened.
pub fn open(db: &Db, key: &Key, id: &str) -> Result<Note> {
    let content = unsealed(db, key, id)?;
    Ok(Note {
        summary: summary(db, id)?,
        doc_json: content.doc_json,
        doc_format: if content.legacy_html {
            DocFormat::LegacyHtml
        } else {
            DocFormat::Tiptap
        },
    })
}

/// Saves a locked note, sealing what the editor sends. The title and the
/// links to its attachments stay in the clear.
pub fn save(db: &mut Db, key: &Key, id: &str, mut input: SaveNote) -> Result<NoteSummary> {
    clamp(&mut input);
    if !notes::get(db, id).map(|n| n.summary.deleted_at.is_none())? {
        return Err(Error::NotFound("note"));
    }
    // Opening the old content first proves the key belongs to this note.
    unsealed(db, key, id)?;
    db.tx(|tx, now| {
        let (linked, first_image) = link_attachments(tx, id, &input.attachment_ids)?;
        let content = Sealed {
            doc_json: std::mem::take(&mut input.doc_json),
            legacy_html: false,
            plain_text: std::mem::take(&mut input.plain_text),
            snippet: std::mem::take(&mut input.snippet),
            has_checklist: input.has_checklist,
            first_image_id: first_image,
        };
        tx.execute(
            "UPDATE notes SET cipher = ?2, doc_format = 'tiptap', title = ?3,
                has_attachment = ?4,
                updated_at = CASE WHEN ?6 THEN updated_at ELSE ?5 END
             WHERE id = ?1",
            params![
                id,
                seal(key, id, &content)?,
                input.title,
                linked > 0,
                now,
                input.keep_time
            ],
        )?;
        Ok(())
    })?;
    summary(db, id)
}

/// Takes the lock off a note and puts its content back in the clear. Like
/// locking, this is not an edit.
pub fn remove(db: &mut Db, key: &Key, id: &str) -> Result<NoteSummary> {
    let content = unsealed(db, key, id)?;
    let tags = parse_tags(&content.plain_text);
    db.tx(|tx, _| {
        tx.execute(
            "UPDATE notes SET locked = 0, cipher = x'', doc_json = ?2, doc_format = ?3,
                plain_text = ?4, snippet = ?5, has_checklist = ?6, first_image_id = ?7
             WHERE id = ?1",
            params![
                id,
                content.doc_json,
                if content.legacy_html {
                    "legacy_html"
                } else {
                    "tiptap"
                },
                content.plain_text,
                content.snippet,
                content.has_checklist,
                content.first_image_id
            ],
        )?;
        for tag in &tags {
            tx.execute(
                "INSERT OR IGNORE INTO note_tags (note_id, tag) VALUES (?1, ?2)",
                [id, tag],
            )?;
        }
        Ok(())
    })?;
    summary(db, id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::{notes, search, tags};
    use crate::shared::error::Error;
    use crate::shared::testing::{note_with_text, temp_db, TestDb};

    fn raw(t: &TestDb, id: &str) -> (String, String, String, Vec<u8>) {
        t.db.conn()
            .query_row(
                "SELECT doc_json, plain_text, snippet, cipher FROM notes WHERE id = ?1",
                [id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .unwrap()
    }

    fn input(doc: &str, plain: &str) -> SaveNote {
        SaveNote {
            doc_json: doc.into(),
            title: plain.lines().next().unwrap_or("").into(),
            snippet: plain.lines().nth(1).unwrap_or("").into(),
            plain_text: plain.into(),
            ..Default::default()
        }
    }

    fn locked_note(t: &mut TestDb, key: &Key) -> String {
        let id = note_with_text(&mut t.db, "Bank\nPIN 4821 #money");
        lock(&mut t.db, key, &id).unwrap();
        id
    }

    #[test]
    fn password_is_set_once_and_unlocks_with_the_right_word() {
        let mut t = temp_db();
        assert_eq!(password_info(&t.db).unwrap(), None);
        assert!(matches!(unlock(&t.db, "x"), Err(Error::NotFound(_))));
        set_password(&mut t.db, "hunter2", "the usual").unwrap();
        assert_eq!(
            password_info(&t.db).unwrap(),
            Some(PasswordInfo {
                hint: "the usual".into()
            })
        );
        assert!(unlock(&t.db, "hunter2").is_ok());
        assert!(matches!(
            unlock(&t.db, "hunter3"),
            Err(Error::WrongPassword)
        ));
        assert!(matches!(
            set_password(&mut t.db, "other", ""),
            Err(Error::Forbidden(_))
        ));
    }

    #[test]
    fn empty_password_is_refused() {
        let mut t = temp_db();
        assert!(matches!(
            set_password(&mut t.db, "  ", ""),
            Err(Error::InvalidInput(_))
        ));
        assert_eq!(password_info(&t.db).unwrap(), None);
    }

    #[test]
    fn locking_seals_the_content_and_keeps_the_title() {
        let mut t = temp_db();
        let key = set_password(&mut t.db, "hunter2", "").unwrap();
        let id = note_with_text(&mut t.db, "Bank\nPIN 4821 #money");
        let before = notes::get(&t.db, &id).unwrap().summary.updated_at;
        t.clock.advance(1000);

        let summary = lock(&mut t.db, &key, &id).unwrap();
        assert!(summary.locked);
        assert_eq!(summary.title, "Bank");
        assert_eq!(summary.snippet, "");
        assert_eq!(summary.updated_at, before, "locking is not an edit");
        assert!(is_locked(&t.db, &id).unwrap());

        let (doc, plain, snippet, cipher) = raw(&t, &id);
        assert_eq!(
            (doc.as_str(), plain.as_str(), snippet.as_str()),
            ("", "", "")
        );
        assert!(!cipher.windows(4).any(|w| w == b"4821"));
        assert!(search::search(&t.db, "4821").unwrap().is_empty());
        assert_eq!(search::search(&t.db, "Bank").unwrap().len(), 1);
        assert!(tags::list(&t.db).unwrap().is_empty());
        assert!(matches!(
            lock(&mut t.db, &key, &id),
            Err(Error::InvalidInput(_))
        ));
    }

    #[test]
    fn a_locked_note_opens_only_with_its_key() {
        let mut t = temp_db();
        let key = set_password(&mut t.db, "hunter2", "").unwrap();
        let id = locked_note(&mut t, &key);

        let closed = notes::get(&t.db, &id).unwrap();
        assert!(closed.summary.locked);
        assert_eq!(closed.doc_json, "");

        let again = unlock(&t.db, "hunter2").unwrap();
        let note = open(&t.db, &again, &id).unwrap();
        assert_eq!(note.doc_json, "{}");
        assert!(note.summary.locked);

        let mut other = temp_db();
        let stranger = set_password(&mut other.db, "hunter2", "").unwrap();
        assert!(matches!(
            open(&t.db, &stranger, &id),
            Err(Error::WrongPassword)
        ));
    }

    #[test]
    fn a_sealed_note_cannot_be_passed_off_as_another() {
        let mut t = temp_db();
        let key = set_password(&mut t.db, "hunter2", "").unwrap();
        let first = locked_note(&mut t, &key);
        let second = locked_note(&mut t, &key);
        t.db.conn()
            .execute(
                "UPDATE notes SET cipher = (SELECT cipher FROM notes WHERE id = ?1) WHERE id = ?2",
                [&first, &second],
            )
            .unwrap();
        assert!(matches!(
            open(&t.db, &key, &second),
            Err(Error::WrongPassword)
        ));
    }

    #[test]
    fn saving_a_locked_note_seals_the_new_content() {
        let mut t = temp_db();
        let key = set_password(&mut t.db, "hunter2", "").unwrap();
        let id = locked_note(&mut t, &key);
        t.clock.advance(5000);

        let summary = save(
            &mut t.db,
            &key,
            &id,
            input(r#"{"v":2}"#, "Bank\nPIN 9999 #money"),
        )
        .unwrap();
        assert_eq!(summary.title, "Bank");
        assert_eq!(summary.snippet, "");
        assert_eq!(summary.updated_at, crate::shared::testing::START_MS + 5000);
        let (doc, plain, ..) = raw(&t, &id);
        assert_eq!((doc.as_str(), plain.as_str()), ("", ""));
        assert!(tags::list(&t.db).unwrap().is_empty());
        assert_eq!(open(&t.db, &key, &id).unwrap().doc_json, r#"{"v":2}"#);
    }

    #[test]
    fn the_plain_save_refuses_a_locked_note() {
        let mut t = temp_db();
        let key = set_password(&mut t.db, "hunter2", "").unwrap();
        let id = locked_note(&mut t, &key);
        assert!(matches!(
            notes::save(&mut t.db, &id, input("{}", "Bank\nleaked")),
            Err(Error::Forbidden(_))
        ));
        assert_eq!(raw(&t, &id).1, "");
    }

    #[test]
    fn removing_the_lock_puts_everything_back() {
        let mut t = temp_db();
        let key = set_password(&mut t.db, "hunter2", "").unwrap();
        let id = locked_note(&mut t, &key);

        let summary = remove(&mut t.db, &key, &id).unwrap();
        assert!(!summary.locked);
        assert_eq!(summary.snippet, "PIN 4821 #money");
        let (doc, plain, _, cipher) = raw(&t, &id);
        assert_eq!(doc, "{}");
        assert_eq!(plain, "Bank\nPIN 4821 #money");
        assert!(cipher.is_empty());
        assert_eq!(search::search(&t.db, "4821").unwrap().len(), 1);
        assert_eq!(tags::list(&t.db).unwrap()[0].tag, "money");
        assert!(matches!(
            remove(&mut t.db, &key, &id),
            Err(Error::InvalidInput(_))
        ));
    }

    #[test]
    fn an_untitled_locked_note_is_never_thrown_away_as_empty() {
        let mut t = temp_db();
        let key = set_password(&mut t.db, "hunter2", "").unwrap();
        let id = note_with_text(&mut t.db, "\nonly a body");
        lock(&mut t.db, &key, &id).unwrap();
        assert!(!notes::delete_if_empty(&mut t.db, &id).unwrap());
    }
}

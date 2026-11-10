//! Recently Deleted: notes wait here 30 days before they are gone for good.

use rusqlite::{params, OptionalExtension};

use crate::features::folders::DEFAULT_FOLDER_ID;
use crate::shared::db::Db;
use crate::shared::error::{Error, Result};

pub const DAY_MS: i64 = 24 * 60 * 60 * 1000;
/// How long a deleted note waits before it is removed for good.
pub const KEEP_MS: i64 = 30 * DAY_MS;

/// Puts a deleted note back in the folder it came from, or in Notes when that
/// folder no longer exists. Returns the folder it went to.
pub fn recover(db: &mut Db, id: &str) -> Result<String> {
    db.tx(|tx, _| {
        let from: Option<String> = tx
            .query_row(
                "SELECT deleted_from_folder_id FROM notes WHERE id = ?1 AND deleted_at IS NOT NULL",
                [id],
                |row| row.get(0),
            )
            .optional()?
            .ok_or(Error::NotFound("deleted note"))?;
        let folder = match from {
            Some(folder) => tx
                .query_row("SELECT id FROM folders WHERE id = ?1", [&folder], |row| {
                    row.get(0)
                })
                .optional()?
                .unwrap_or_else(|| DEFAULT_FOLDER_ID.to_owned()),
            None => DEFAULT_FOLDER_ID.to_owned(),
        };
        tx.execute(
            "UPDATE notes SET folder_id = ?2, deleted_at = NULL, deleted_from_folder_id = NULL
             WHERE id = ?1",
            params![id, folder],
        )?;
        Ok(folder)
    })
}

/// Removes one deleted note for good.
pub fn purge(db: &mut Db, id: &str) -> Result<()> {
    let removed = db.conn().execute(
        "DELETE FROM notes WHERE id = ?1 AND deleted_at IS NOT NULL",
        [id],
    )?;
    if removed == 0 {
        return Err(Error::NotFound("deleted note"));
    }
    Ok(())
}

/// Removes every deleted note for good. Returns how many.
pub fn empty(db: &mut Db) -> Result<usize> {
    Ok(db
        .conn()
        .execute("DELETE FROM notes WHERE deleted_at IS NOT NULL", [])?)
}

/// Removes notes deleted more than 30 days ago. Returns how many.
pub fn purge_expired(db: &mut Db) -> Result<usize> {
    let cutoff = db.now() - KEEP_MS;
    Ok(db.conn().execute(
        "DELETE FROM notes WHERE deleted_at IS NOT NULL AND deleted_at < ?1",
        [cutoff],
    )?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::folders::{self, DEFAULT_FOLDER_ID};
    use crate::features::notes::{self, NoteFilter, NoteSort};
    use crate::shared::error::Error;
    use crate::shared::testing::{temp_db, TestDb};

    fn in_trash(t: &TestDb) -> usize {
        notes::list(&t.db, &NoteFilter::Trash, NoteSort::Edited)
            .unwrap()
            .len()
    }

    #[test]
    fn recover_returns_note_to_its_folder() {
        let mut t = temp_db();
        let work = folders::create(&mut t.db, "Work", None).unwrap();
        let id = notes::create(&mut t.db, &work.id).unwrap().summary.id;
        notes::delete(&mut t.db, &id).unwrap();
        assert_eq!(recover(&mut t.db, &id).unwrap(), work.id);
        let note = notes::get(&t.db, &id).unwrap();
        assert_eq!(note.summary.folder_id, work.id);
        assert_eq!(note.summary.deleted_at, None);
    }

    #[test]
    fn recover_into_notes_when_folder_is_gone() {
        let mut t = temp_db();
        let work = folders::create(&mut t.db, "Work", None).unwrap();
        let id = notes::create(&mut t.db, &work.id).unwrap().summary.id;
        folders::delete(&mut t.db, &work.id).unwrap();
        assert_eq!(recover(&mut t.db, &id).unwrap(), DEFAULT_FOLDER_ID);
    }

    #[test]
    fn recover_or_purge_live_note_not_found() {
        let mut t = temp_db();
        let id = notes::create(&mut t.db, DEFAULT_FOLDER_ID)
            .unwrap()
            .summary
            .id;
        assert!(matches!(recover(&mut t.db, &id), Err(Error::NotFound(_))));
        assert!(matches!(purge(&mut t.db, &id), Err(Error::NotFound(_))));
    }

    #[test]
    fn purge_and_empty_remove_for_good() {
        let mut t = temp_db();
        let a = notes::create(&mut t.db, DEFAULT_FOLDER_ID)
            .unwrap()
            .summary
            .id;
        let b = notes::create(&mut t.db, DEFAULT_FOLDER_ID)
            .unwrap()
            .summary
            .id;
        let c = notes::create(&mut t.db, DEFAULT_FOLDER_ID)
            .unwrap()
            .summary
            .id;
        for id in [&a, &b, &c] {
            notes::delete(&mut t.db, id).unwrap();
        }
        purge(&mut t.db, &a).unwrap();
        assert_eq!(in_trash(&t), 2);
        assert_eq!(empty(&mut t.db).unwrap(), 2);
        assert_eq!(in_trash(&t), 0);
    }

    #[test]
    fn purge_expired_after_thirty_days() {
        let mut t = temp_db();
        let old = notes::create(&mut t.db, DEFAULT_FOLDER_ID)
            .unwrap()
            .summary
            .id;
        notes::delete(&mut t.db, &old).unwrap();
        t.clock.advance(DAY_MS);
        let recent = notes::create(&mut t.db, DEFAULT_FOLDER_ID)
            .unwrap()
            .summary
            .id;
        notes::delete(&mut t.db, &recent).unwrap();

        t.clock.advance(29 * DAY_MS);
        assert_eq!(purge_expired(&mut t.db).unwrap(), 0);
        t.clock.advance(1);
        assert_eq!(purge_expired(&mut t.db).unwrap(), 1);
        assert!(notes::get(&t.db, &recent).is_ok());
        assert!(notes::get(&t.db, &old).is_err());
    }
}

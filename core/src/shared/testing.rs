//! Helpers for tests: a library in a temp dir with a clock that stands still.

use std::sync::Arc;

use super::clock::FixedClock;
use super::db::Db;

pub const START_MS: i64 = 1_700_000_000_000;

pub struct TestDb {
    pub db: Db,
    pub clock: Arc<FixedClock>,
    _dir: tempfile::TempDir,
}

pub fn temp_db() -> TestDb {
    let dir = tempfile::tempdir().unwrap();
    let clock = Arc::new(FixedClock::new(START_MS));
    let db = Db::open(&dir.path().join("library.sqlite"), clock.clone()).unwrap();
    TestDb {
        db,
        clock,
        _dir: dir,
    }
}

/// Inserts a bare note row straight into the table, for features that need
/// notes before the notes feature is involved.
pub fn insert_note(db: &Db, id: &str, folder_id: &str) {
    db.conn()
        .execute(
            "INSERT INTO notes (id, folder_id, doc_json, created_at, updated_at)
             VALUES (?1, ?2, '{}', 0, 0)",
            [id, folder_id],
        )
        .unwrap();
}

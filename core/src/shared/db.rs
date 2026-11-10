//! The SQLite connection every feature works through.

use std::path::Path;
use std::sync::Arc;

use rusqlite::{Connection, Transaction};

use super::clock::Clock;
use super::error::Result;
pub use super::migrations::SCHEMA_VERSION;

pub struct Db {
    conn: Connection,
    clock: Arc<dyn Clock>,
}

impl Db {
    /// Opens (or creates) the library file and brings its schema up to date.
    pub fn open(path: &Path, clock: Arc<dyn Clock>) -> Result<Db> {
        let mut conn = Connection::open(path)?;
        conn.pragma_update(None, "journal_mode", "wal")?;
        conn.pragma_update(None, "foreign_keys", true)?;
        conn.pragma_update(None, "synchronous", "normal")?;
        conn.busy_timeout(std::time::Duration::from_secs(5))?;
        super::migrations::run(&mut conn)?;
        Ok(Db { conn, clock })
    }

    pub fn conn(&self) -> &Connection {
        &self.conn
    }

    pub fn now(&self) -> i64 {
        self.clock.now_ms()
    }

    /// Runs `f` in one transaction, handing it the current time.
    pub fn tx<T>(&mut self, f: impl FnOnce(&Transaction, i64) -> Result<T>) -> Result<T> {
        let now = self.clock.now_ms();
        let tx = self.conn.transaction()?;
        let value = f(&tx, now)?;
        tx.commit()?;
        Ok(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::clock::FixedClock;
    use std::sync::Arc;

    fn open(dir: &tempfile::TempDir) -> Db {
        Db::open(
            &dir.path().join("library.sqlite"),
            Arc::new(FixedClock::new(1)),
        )
        .unwrap()
    }

    fn pragma(db: &Db, name: &str) -> String {
        db.conn()
            .query_row(&format!("PRAGMA {name}"), [], |row| {
                row.get::<_, rusqlite::types::Value>(0)
            })
            .map(|value| match value {
                rusqlite::types::Value::Integer(n) => n.to_string(),
                rusqlite::types::Value::Text(t) => t,
                other => format!("{other:?}"),
            })
            .unwrap()
    }

    #[test]
    fn open_creates_schema_version_1() {
        let dir = tempfile::tempdir().unwrap();
        let db = open(&dir);
        assert_eq!(pragma(&db, "user_version"), SCHEMA_VERSION.to_string());
        assert_eq!(SCHEMA_VERSION, 1);
        assert_eq!(pragma(&db, "journal_mode"), "wal");
        assert_eq!(pragma(&db, "foreign_keys"), "1");
    }

    #[test]
    fn open_twice_is_noop() {
        let dir = tempfile::tempdir().unwrap();
        drop(open(&dir));
        let db = open(&dir);
        assert_eq!(pragma(&db, "user_version"), "1");
        let ids: Vec<String> = db
            .conn()
            .prepare("SELECT id FROM folders")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<std::result::Result<_, _>>()
            .unwrap();
        assert_eq!(ids, vec!["notes".to_string()]);
    }

    #[test]
    fn fts_is_available() {
        let dir = tempfile::tempdir().unwrap();
        let db = open(&dir);
        let count: i64 = db
            .conn()
            .query_row(
                "SELECT count(*) FROM notes_fts WHERE notes_fts MATCH 'x*'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(count, 0);
    }
}

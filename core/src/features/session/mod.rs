//! Small JSON values that bring the app back to where it was: the selected
//! note, scroll positions, pane widths, settings.

use rusqlite::{params, Connection, OptionalExtension};

use crate::shared::db::Db;
use crate::shared::error::Result;

pub fn get(db: &Db, key: &str) -> Result<Option<serde_json::Value>> {
    let text: Option<String> = db
        .conn()
        .query_row("SELECT value FROM kv WHERE key = ?1", [key], |row| {
            row.get(0)
        })
        .optional()?;
    Ok(text.map(|t| serde_json::from_str(&t)).transpose()?)
}

pub fn set(db: &mut Db, key: &str, value: &serde_json::Value) -> Result<()> {
    set_in(db.conn(), key, value)
}

/// `set` inside a transaction (or on any connection).
pub(crate) fn set_in(conn: &Connection, key: &str, value: &serde_json::Value) -> Result<()> {
    conn.execute(
        "INSERT INTO kv (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, serde_json::to_string(value)?],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::shared::testing::temp_db;
    use serde_json::json;

    #[test]
    fn session_roundtrip() {
        let mut t = temp_db();
        assert_eq!(get(&t.db, "selection").unwrap(), None);
        set(&mut t.db, "selection", &json!({"noteId": "x"})).unwrap();
        assert_eq!(
            get(&t.db, "selection").unwrap(),
            Some(json!({"noteId": "x"}))
        );
        set(&mut t.db, "selection", &json!({"noteId": "y"})).unwrap();
        assert_eq!(
            get(&t.db, "selection").unwrap(),
            Some(json!({"noteId": "y"}))
        );
    }
}

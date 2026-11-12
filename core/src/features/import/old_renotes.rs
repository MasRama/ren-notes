use std::collections::HashMap;
use std::path::{Path, PathBuf};

use rusqlite::{params, Connection, OpenFlags, Transaction};

use super::html::html_to_text;
use crate::features::folders::DEFAULT_FOLDER_ID;
use crate::features::tags::parse_tags;
use crate::shared::db::Db;
use crate::shared::error::Result;
use crate::shared::ids::new_id;

/// Session key written once the old library has been imported.
pub const IMPORT_MARKER: &str = "import.renotes_v0";

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct ImportReport {
    pub folders: usize,
    pub notes: usize,
}

/// Where the first prototype kept its library. It only ever ran on Linux, so
/// elsewhere there is nothing to import.
pub fn default_old_db_path() -> Option<PathBuf> {
    if !cfg!(target_os = "linux") {
        return None;
    }
    let xdg = std::env::var("XDG_DATA_HOME").ok();
    let home = std::env::var("HOME").unwrap_or_default();
    Some(default_old_db_path_from(xdg.as_deref(), &home))
}

pub fn default_old_db_path_from(xdg_data_home: Option<&str>, home: &str) -> PathBuf {
    let base = match xdg_data_home.filter(|x| !x.is_empty()) {
        Some(xdg) => PathBuf::from(xdg),
        None => PathBuf::from(home).join(".local/share"),
    };
    base.join("renotes").join("notes.db")
}

/// Copies the old prototype's folders and notes into this library, once.
/// Returns `None` when there is nothing to do: already imported, or no old
/// library. The old file is opened read-only.
pub fn import_old_renotes(db: &mut Db, old_db: &Path) -> Result<Option<ImportReport>> {
    if crate::features::session::get(db, IMPORT_MARKER)?.is_some() || !old_db.is_file() {
        return Ok(None);
    }
    let old = Connection::open_with_flags(
        old_db,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )?;
    let old_folders: Vec<(i64, String, Option<i64>, String, i64)> = old
        .prepare("SELECT id, name, parent_id, created_at, sort_order FROM folders ORDER BY sort_order, id")?
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)))?
        .collect::<std::result::Result<_, _>>()?;
    let old_notes: Vec<(Option<i64>, String, String, String, String, bool)> = old
        .prepare(
            "SELECT folder_id, title, body, created_at, modified_at, pinned FROM notes ORDER BY id",
        )?
        .query_map([], |r| {
            Ok((
                r.get(0)?,
                r.get(1)?,
                r.get(2)?,
                r.get(3)?,
                r.get(4)?,
                r.get(5)?,
            ))
        })?
        .collect::<std::result::Result<_, _>>()?;
    drop(old);

    db.tx(|tx, now| {
        let mut ids: HashMap<i64, String> = HashMap::new();
        // Parents before children; folders whose parent never appears go to the top.
        let mut pending = old_folders.clone();
        while !pending.is_empty() {
            let before = pending.len();
            let mut later = Vec::new();
            for folder in pending {
                let (old_id, name, parent, created, sort) = &folder;
                let parent_new = match parent {
                    Some(p) if old_folders.iter().any(|f| f.0 == *p) => match ids.get(p) {
                        Some(id) => Some(id.clone()),
                        None => {
                            later.push(folder);
                            continue;
                        }
                    },
                    _ => None,
                };
                let id = new_id();
                let name = free_name(tx, parent_new.as_deref(), name.trim())?;
                let created = parse_time(created).unwrap_or(now);
                tx.execute(
                    "INSERT INTO folders (id, parent_id, name, sort_index, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
                    params![id, parent_new, name, sort, created],
                )?;
                ids.insert(*old_id, id);
            }
            if later.len() == before {
                break; // a cycle in the old data; leave those folders out
            }
            pending = later;
        }

        for (folder, title, body, created, modified, pinned) in &old_notes {
            let folder_id = folder
                .and_then(|f| ids.get(&f).cloned())
                .unwrap_or_else(|| DEFAULT_FOLDER_ID.to_owned());
            let body_text = html_to_text(body);
            let mut lines = body_text.lines().map(str::trim).filter(|l| !l.is_empty());
            let title = title.trim();
            let (title_text, snippet) = if title.is_empty() {
                (
                    lines.next().unwrap_or("").to_owned(),
                    lines.next().unwrap_or("").to_owned(),
                )
            } else {
                (title.to_owned(), lines.next().unwrap_or("").to_owned())
            };
            let plain_text = if title.is_empty() {
                body_text.clone()
            } else {
                format!("{title}\n{body_text}")
            };
            let legacy_html = if title.is_empty() {
                body.clone()
            } else {
                format!("<h1>{}</h1>{body}", escape_html(title))
            };
            let created = parse_time(created).unwrap_or(now);
            let modified = parse_time(modified).unwrap_or(created);
            let id = new_id();
            tx.execute(
                "INSERT INTO notes (id, folder_id, doc_json, doc_format, title, snippet, plain_text,
                    pinned, created_at, updated_at)
                 VALUES (?1, ?2, ?3, 'legacy_html', ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    id,
                    folder_id,
                    legacy_html,
                    clip(&title_text, 200),
                    clip(&snippet, 300),
                    plain_text,
                    pinned,
                    created,
                    modified
                ],
            )?;
            for tag in parse_tags(&plain_text) {
                tx.execute(
                    "INSERT INTO note_tags (note_id, tag) VALUES (?1, ?2)",
                    [&id, &tag],
                )?;
            }
        }

        tx.execute(
            "INSERT INTO kv (key, value) VALUES (?1, ?2)",
            params![IMPORT_MARKER, serde_json::json!({ "at": now }).to_string()],
        )?;
        Ok(Some(ImportReport {
            folders: ids.len(),
            notes: old_notes.len(),
        }))
    })
}

/// `name`, or `name 2`, `name 3`… when a sibling already has it (any case).
fn free_name(tx: &Transaction, parent: Option<&str>, name: &str) -> Result<String> {
    let name = if name.is_empty() { "Folder" } else { name };
    let taken: Vec<String> = tx
        .prepare("SELECT lower(name) FROM folders WHERE parent_id IS ?1")?
        .query_map([parent], |r| r.get::<_, String>(0))?
        .collect::<std::result::Result<_, _>>()?;
    let taken: Vec<String> = taken.into_iter().map(|t| t.to_lowercase()).collect();
    let mut candidate = name.to_owned();
    let mut n = 2;
    while taken.contains(&candidate.to_lowercase()) {
        candidate = format!("{name} {n}");
        n += 1;
    }
    Ok(candidate)
}

/// "YYYY-MM-DD HH:MM:SS" in UTC (SQLite's datetime('now')) to Unix ms.
fn parse_time(text: &str) -> Option<i64> {
    let (date, time) = text.trim().split_once(' ')?;
    let mut d = date.split('-').map(|p| p.parse::<i64>());
    let (y, m, day) = (d.next()?.ok()?, d.next()?.ok()?, d.next()?.ok()?);
    let mut t = time.split(':').map(|p| p.parse::<i64>());
    let (hh, mm, ss) = (t.next()?.ok()?, t.next()?.ok()?, t.next()?.ok()?);
    // Days from civil (Howard Hinnant's algorithm).
    let y = if m <= 2 { y - 1 } else { y };
    let era = y.div_euclid(400);
    let yoe = y - era * 400;
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146_097 + doe - 719_468;
    Some(((days * 24 + hh) * 60 + mm) * 60_000 + ss * 1000)
}

fn clip(text: &str, max: usize) -> String {
    text.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(max)
        .collect()
}

fn escape_html(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::folders::{self, DEFAULT_FOLDER_ID};
    use crate::features::notes::{self, DocFormat, NoteFilter, NoteSort};
    use crate::features::session;
    use crate::shared::testing::{temp_db, TestDb};
    use rusqlite::Connection;

    /// A library in the old app's exact schema.
    fn old_db(t: &TestDb) -> std::path::PathBuf {
        let path = t.dir().join("old-notes.db");
        let conn = Connection::open(&path).unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE folders (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
                parent_id INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now')),
                sort_order INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, folder_id INTEGER,
                title TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                modified_at TEXT NOT NULL DEFAULT (datetime('now')),
                pinned INTEGER NOT NULL DEFAULT 0, locked INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0);
            CREATE TABLE session (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            INSERT INTO folders VALUES (3, 'API', NULL, '2026-08-08 10:20:02', 1);
            INSERT INTO folders VALUES (4, 'Keys', 3, '2026-08-08 10:21:00', 1);
            INSERT INTO folders VALUES (5, 'notes', NULL, '2026-08-09 07:12:31', 2);
            INSERT INTO notes VALUES (1, NULL, '', 'loose<div>second line</div>',
                '2026-08-08 08:19:35', '2026-08-08 10:10:07', 0, 0, 0);
            INSERT INTO notes VALUES (2, 3, 'Meta <API>', 'token #work<div><br></div><div><b>more</b></div>',
                '2026-08-08 10:20:05', '2026-09-13 08:41:36', 1, 0, 0);
            INSERT INTO notes VALUES (3, 4, 'Nested', 'x', '2026-08-10 00:00:00', '2026-08-10 00:00:01', 0, 0, 0);
            INSERT INTO notes VALUES (4, 99, 'Orphan', 'y', '2026-08-11 00:00:00', '2026-08-11 00:00:00', 0, 0, 0);
            "#,
        )
        .unwrap();
        path
    }

    #[test]
    fn imports_folders_and_notes_once() {
        let mut t = temp_db();
        let old = old_db(&t);
        let before = std::fs::read(&old).unwrap();

        let report = import_old_renotes(&mut t.db, &old).unwrap().unwrap();
        assert_eq!(
            report,
            ImportReport {
                folders: 3,
                notes: 4
            }
        );
        assert_eq!(std::fs::read(&old).unwrap(), before);

        let all = folders::list(&t.db).unwrap();
        let api = all.iter().find(|f| f.name == "API").unwrap();
        let keys = all.iter().find(|f| f.name == "Keys").unwrap();
        assert_eq!(keys.parent_id.as_deref(), Some(api.id.as_str()));
        // "notes" clashes with the built-in "Notes" folder.
        assert!(all.iter().any(|f| f.name == "notes 2"));

        let list = notes::list(&t.db, &NoteFilter::All, NoteSort::Created).unwrap();
        assert_eq!(list.len(), 4);
        let meta = list.iter().find(|n| n.title == "Meta <API>").unwrap();
        assert!(meta.pinned);
        assert_eq!(meta.folder_id, api.id);
        assert_eq!(meta.snippet, "token #work");
        assert_eq!(meta.created_at, 1_786_184_405_000); // 2026-08-08 10:20:05 UTC
        assert_eq!(meta.updated_at, 1_789_288_896_000); // 2026-09-13 08:41:36 UTC
        let note = notes::get(&t.db, &meta.id).unwrap();
        assert_eq!(note.doc_format, DocFormat::LegacyHtml);
        assert!(note
            .doc_json
            .starts_with("<h1>Meta &lt;API&gt;</h1>token #work"));
        assert_eq!(
            notes::list(
                &t.db,
                &NoteFilter::Tags(vec!["work".into()]),
                NoteSort::Edited
            )
            .unwrap()
            .len(),
            1
        );

        let loose = list.iter().find(|n| n.title == "loose").unwrap();
        assert_eq!(loose.folder_id, DEFAULT_FOLDER_ID);
        assert_eq!(loose.snippet, "second line");
        let orphan = list.iter().find(|n| n.title == "Orphan").unwrap();
        assert_eq!(orphan.folder_id, DEFAULT_FOLDER_ID);

        assert!(session::get(&t.db, IMPORT_MARKER).unwrap().is_some());
        assert_eq!(import_old_renotes(&mut t.db, &old).unwrap(), None);
        assert_eq!(
            notes::list(&t.db, &NoteFilter::All, NoteSort::Edited)
                .unwrap()
                .len(),
            4
        );
    }

    #[test]
    fn missing_old_library_is_nothing_to_do() {
        let mut t = temp_db();
        let missing = t.dir().join("nope.db");
        assert_eq!(import_old_renotes(&mut t.db, &missing).unwrap(), None);
        assert!(session::get(&t.db, IMPORT_MARKER).unwrap().is_none());
    }

    #[test]
    fn old_db_path_follows_xdg() {
        assert_eq!(
            default_old_db_path_from(Some("/x"), "/h"),
            std::path::Path::new("/x/renotes/notes.db")
        );
        assert_eq!(
            default_old_db_path_from(None, "/h"),
            std::path::Path::new("/h/.local/share/renotes/notes.db")
        );
    }
}

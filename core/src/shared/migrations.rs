//! Schema migrations, counted by `PRAGMA user_version`.

use rusqlite::Connection;

use super::error::Result;

pub const SCHEMA_VERSION: i32 = 1;

/// Every migration, in order. Entry `n` takes the schema from `n` to `n + 1`.
const MIGRATIONS: &[&str] = &[V1];

pub fn run(conn: &mut Connection) -> Result<()> {
    let current: i32 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(current.max(0) as usize) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", index as i32 + 1)?;
        tx.commit()?;
    }
    Ok(())
}

const V1: &str = r#"
CREATE TABLE folders (
    id          TEXT PRIMARY KEY,
    parent_id   TEXT REFERENCES folders(id),
    name        TEXT NOT NULL,
    sort_index  INTEGER NOT NULL DEFAULT 0,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
);

CREATE TABLE notes (
    id                      TEXT PRIMARY KEY,
    folder_id               TEXT NOT NULL REFERENCES folders(id),
    doc_json                TEXT NOT NULL,
    doc_format              TEXT NOT NULL DEFAULT 'tiptap'
                            CHECK (doc_format IN ('tiptap', 'legacy_html')),
    title                   TEXT NOT NULL DEFAULT '',
    snippet                 TEXT NOT NULL DEFAULT '',
    plain_text              TEXT NOT NULL DEFAULT '',
    first_image_id          TEXT,
    has_checklist           INTEGER NOT NULL DEFAULT 0,
    has_attachment          INTEGER NOT NULL DEFAULT 0,
    pinned                  INTEGER NOT NULL DEFAULT 0,
    created_at              INTEGER NOT NULL,
    updated_at              INTEGER NOT NULL,
    deleted_at              INTEGER,
    deleted_from_folder_id  TEXT
);
CREATE INDEX notes_by_folder ON notes(folder_id, deleted_at);
CREATE INDEX notes_by_updated ON notes(updated_at);

CREATE VIRTUAL TABLE notes_fts USING fts5(
    title, plain_text,
    content = 'notes', content_rowid = 'rowid',
    tokenize = 'unicode61 remove_diacritics 2'
);
CREATE TRIGGER notes_fts_insert AFTER INSERT ON notes BEGIN
    INSERT INTO notes_fts(rowid, title, plain_text)
    VALUES (new.rowid, new.title, new.plain_text);
END;
CREATE TRIGGER notes_fts_delete AFTER DELETE ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, plain_text)
    VALUES ('delete', old.rowid, old.title, old.plain_text);
END;
CREATE TRIGGER notes_fts_update AFTER UPDATE OF title, plain_text ON notes BEGIN
    INSERT INTO notes_fts(notes_fts, rowid, title, plain_text)
    VALUES ('delete', old.rowid, old.title, old.plain_text);
    INSERT INTO notes_fts(rowid, title, plain_text)
    VALUES (new.rowid, new.title, new.plain_text);
END;

CREATE TABLE attachments (
    id          TEXT PRIMARY KEY,
    mime        TEXT NOT NULL,
    file_name   TEXT NOT NULL,
    byte_size   INTEGER NOT NULL,
    width       INTEGER,
    height      INTEGER,
    created_at  INTEGER NOT NULL
);

CREATE TABLE note_attachments (
    note_id        TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    attachment_id  TEXT NOT NULL REFERENCES attachments(id),
    PRIMARY KEY (note_id, attachment_id)
);

CREATE TABLE note_tags (
    note_id  TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag      TEXT NOT NULL,
    PRIMARY KEY (note_id, tag)
);
CREATE INDEX note_tags_by_tag ON note_tags(tag);

CREATE TABLE smart_folders (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    rules_json  TEXT NOT NULL,
    sort_index  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE kv (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
);

INSERT OR IGNORE INTO folders (id, parent_id, name, sort_index, created_at, updated_at)
VALUES ('notes', NULL, 'Notes', 0, 0, 0);
"#;

# Architecture

This file is the authority on how Renotes is built. When code and this file
disagree, one of them is wrong: fix the code, or change this file in the same
commit.

## Two halves, one boundary

```
Vue page (app/src) ──Tauri commands──▶ renotes-app (app/src-tauri) ──▶ renotes-core (core/)
                                                                         │
                                                       ~/.local/share/ren-notes
```

- **`renotes-core`** owns all logic and all I/O: the SQLite library, search,
  attachments on disk, tags, the trash, importing. It has no Tauri
  dependency, so every feature is tested on its own.
- **`renotes-app`** is the window, the menu and thin commands that call the
  core. No logic of its own.
- **The page** only draws, edits and animates. It never touches the disk.

## Repository layout

The code is organised by feature, not by layer: one folder per feature, a
small public boundary, private internals, and a thin composition layer.

```
core/src/app/        composition: the Library that opens the data dir
core/src/features/   folders, notes, tags, session
core/src/shared/     database and migrations, clock, ids, errors, paths
core/tests/          integration tests
```

### Feature rules

- A feature exposes what others may use from its `mod.rs`; everything else
  stays private to the folder.
- Features talk to each other only through those public items.
- Shared code holds no feature knowledge.

## Data

The library lives in `$XDG_DATA_HOME/ren-notes` (by default
`~/.local/share/ren-notes`): `library.sqlite` in WAL mode with foreign keys
on, `attachments/` and `thumbs/`. Ids are lowercase ULIDs and times are Unix
milliseconds.

### The core's features

- **folders**: a tree under the built-in Notes folder (id `notes`), which
  cannot be moved or deleted. Sibling names are unique without regard to
  case. Deleting a folder sends the notes of its whole subtree to Recently
  Deleted.
- **notes**: a note stores the editor's JSON document (`doc_format`
  `tiptap`; notes imported from the old app start as `legacy_html` and are
  converted when first opened). The page derives title, snippet, plain text
  and checklist state from the document on every save; the core caps them,
  reads `#tags` from the plain text and links only attachments it knows.
  Deleting sets `deleted_at` and remembers the folder. Pinning is not an
  edit and leaves the edit time alone.
- **tags**: `parse_tags` reads `#tags` (a letter required, lowercased).
- **session**: JSON values in the `kv` table that bring the app back to
  where it was.

### Schema

One migration per schema version, counted by `PRAGMA user_version`. The
`notes_fts` FTS5 table indexes title and plain text and is kept in sync by
triggers; nothing writes to it directly.

### Tests

Each feature tests itself against a real database in a temp dir, with a
`FixedClock` so times are exact (`shared::testing`).

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
core/src/features/   one folder per feature
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

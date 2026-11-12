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
- **`renotes-app`** is the window, thin commands that call the core, and
  the `renotes://` protocol that serves attachments and thumbnails. No
  logic of its own. There is no native menu bar: menus and shortcuts live
  in the page, as they do in the Mac toolbar.
- **The page** only draws, edits and animates. It never touches the disk.

## Repository layout

The code is organised by feature, not by layer: one folder per feature, a
small public boundary, private internals, and a thin composition layer.

```
core/src/app/        composition: the Library that opens the data dir
core/src/features/   folders, notes, tags, trash, search, smart_folders,
                     attachments, import, session
core/src/shared/     database and migrations, clock, ids, errors, paths
core/tests/          integration tests

app/src-tauri/src/   commands/ (one file per area), protocol.rs, main.rs
app/src/app/         the window shell, the Store, shared context
app/src/features/    sidebar, note-list, editor, smart-folders
app/src/shared/      ipc (Tauri client, in-memory API, demo data), ui,
                     dates, tags, keyboard, icons
```

### The page

- The **Store** (`app/src/app/store.ts`) owns what the window shows: the
  source (folder, smart folder, tags, Recently Deleted), the list, the
  selection and the session. It is the only part that calls the API;
  components read its state and call its methods.
- The **editor** is Tiptap. Opening a note never saves it; edits save
  through `Autosave` (debounced, flushed before leaving a note or closing
  the window).
- `shared/ipc/api.ts` is the boundary: `tauri.ts` talks to the app,
  `memory.ts` is an in-memory library for tests and the browser demo.

### Feature rules

- A feature exposes what others may use from its `mod.rs`; everything else
  stays private to the folder.
- Features talk to each other only through those public items.
- Shared code holds no feature knowledge.

## Data

The library lives in `$XDG_DATA_HOME/ren-notes` (by default
`~/.local/share/ren-notes`) on Linux and in `%APPDATA%\Renotes` on Windows: `library.sqlite` in WAL mode with foreign keys
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

## Platforms

Linux and Windows share every feature; what differs lives behind
`cfg(target_os)` in the app crate and `shared/platform.ts` in the page.

| | Linux | Windows |
| --- | --- | --- |
| Webview | WebKitGTK | WebView2 |
| Window frame | GTK draws the shadow and resize edges (`frame.rs`); the page rounds the corners | the system's shadow and corners; no page rounding |
| Window buttons | Mac lights at the top left | caption buttons at the top right (`CaptionButtons.vue`) |
| Translucent sidebar | the window is transparent | Mica (Windows 11) |
| Focus dimming | GTK window state | Tauri's `Focused` event |
| Window size | `window_size.rs` (the plugin grows the window by the GTK shadow) | the window-state plugin |
| `renotes` protocol | `renotes://localhost/...` | `http://renotes.localhost/...` |
| Link cards | libsoup | ureq over SChannel |
| Wallpaper tint | GNOME settings | `SPI_GETDESKWALLPAPER`, or the desktop colour |
| Package | `.deb` | per-user NSIS installer (`tauri.windows.conf.json`) |

The first prototype's import runs on Linux only; it never ran elsewhere.
Windows is built and exercised on CI (`.github/workflows/windows.yml` and
`tools/windows/`), which uploads screenshots of each smoke step.

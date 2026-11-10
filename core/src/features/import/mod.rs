//! Bringing notes over from the first Renotes prototype, whose library is
//! `~/.local/share/renotes/notes.db`. That file is only ever read.

mod html;
mod old_renotes;

pub use old_renotes::{default_old_db_path, import_old_renotes, ImportReport, IMPORT_MARKER};

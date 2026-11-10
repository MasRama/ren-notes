//! Notes: the document, the fields derived from it, pinning and the trash.

mod derive;
mod model;
mod store;

pub use model::{DocFormat, Note, NoteFilter, NoteSort, NoteSummary, SaveNote, EMPTY_DOC};
pub use store::{create, delete, delete_if_empty, get, list, move_to, save, set_pinned};

//! Notes: the document, the fields derived from it, pinning and the trash.

mod derive;
mod model;
mod store;

pub(crate) use derive::clamp;
pub use model::{DocFormat, Note, NoteFilter, NoteSort, NoteSummary, SaveNote, EMPTY_DOC};
pub use store::{create, delete, delete_if_empty, get, list, move_to, save, set_pinned};
pub(crate) use store::{link_attachments, list_where, order_for, summary_from, SUMMARY_COLUMNS};

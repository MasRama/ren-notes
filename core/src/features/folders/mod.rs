//! Folders: a tree, with the built-in "Notes" folder that always exists.

mod model;
mod store;

pub use model::{Folder, DEFAULT_FOLDER_ID};
pub use store::{create, delete, list, move_to, rename};

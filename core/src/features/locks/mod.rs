//! Locked notes: one password for the library, as on the Mac. A locked
//! note keeps its title in the clear; its document, text and preview are
//! sealed with a key made from the password, and it leaves search and tags.

mod crypto;
mod store;

pub use crypto::Key;
pub use store::{
    is_locked, lock, open, password_info, remove, save, set_password, unlock, PasswordInfo,
};

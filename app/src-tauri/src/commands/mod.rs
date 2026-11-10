//! Thin commands over the core, one module per feature. Every command is
//! `async` so it runs off the main thread; the library sits behind a mutex.

pub mod attachments;
pub mod folders;
pub mod library;
pub mod links;
pub mod notes;

use std::sync::{Mutex, MutexGuard};

use renotes_core::app::Library;
use serde::Serialize;

pub struct AppState {
    library: Mutex<Library>,
}

impl AppState {
    pub fn new(library: Library) -> AppState {
        AppState {
            library: Mutex::new(library),
        }
    }

    /// The library; a panic in another command does not lock it for good.
    pub fn lock(&self) -> MutexGuard<'_, Library> {
        self.library.lock().unwrap_or_else(|e| e.into_inner())
    }
}

/// What the page gets when a command fails: a stable code and a message.
#[derive(Debug, Serialize)]
pub struct CmdError {
    code: &'static str,
    message: String,
}

impl From<renotes_core::shared::error::Error> for CmdError {
    fn from(e: renotes_core::shared::error::Error) -> CmdError {
        CmdError {
            code: e.code(),
            message: e.to_string(),
        }
    }
}

impl CmdError {
    pub fn invalid(message: impl Into<String>) -> CmdError {
        CmdError {
            code: "invalid_input",
            message: message.into(),
        }
    }
}

pub type CmdResult<T> = Result<T, CmdError>;

//! Locked notes: the password, opening and closing them, and the lock on a
//! note. While they are open the key sits in `AppState`.

use renotes_core::app::Library;
use renotes_core::features::locks;
use renotes_core::features::notes::NoteSummary;
use renotes_core::shared::error::Error;
use serde::Serialize;
use tauri::State;

use super::{AppState, CmdResult};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LockState {
    /// Whether a notes password has been set.
    pub has_password: bool,
    pub hint: String,
    /// Whether locked notes are open (the password was typed).
    pub open: bool,
}

/// Runs `f` with the library and the key, or gives the error a closed locked
/// note gives. The library is always taken before the key, as `notes_get`
/// and `notes_save` do, so two commands never wait on each other.
fn with_key<T>(
    state: &AppState,
    f: impl FnOnce(&mut Library, &locks::Key) -> renotes_core::shared::error::Result<T>,
) -> CmdResult<T> {
    let mut library = state.lock();
    let key = state.key();
    let key = key.as_ref().ok_or(Error::Forbidden(CLOSED))?;
    Ok(f(&mut library, key)?)
}

pub const CLOSED: &str = "locked notes are closed";

#[tauri::command]
pub async fn locks_state(state: State<'_, AppState>) -> CmdResult<LockState> {
    let info = locks::password_info(state.lock().db())?;
    Ok(LockState {
        has_password: info.is_some(),
        hint: info.map(|i| i.hint).unwrap_or_default(),
        open: state.key().is_some(),
    })
}

/// Sets the notes password; locked notes are open afterwards.
#[tauri::command]
pub async fn locks_set_password(
    state: State<'_, AppState>,
    password: String,
    hint: String,
) -> CmdResult<()> {
    let mut library = state.lock();
    let key = locks::set_password(library.db_mut(), &password, &hint)?;
    *state.key() = Some(key);
    Ok(())
}

/// Opens locked notes with the password.
#[tauri::command]
pub async fn locks_open(state: State<'_, AppState>, password: String) -> CmdResult<()> {
    let library = state.lock();
    let key = locks::unlock(library.db(), &password)?;
    *state.key() = Some(key);
    Ok(())
}

/// Closes every locked note: the key is forgotten.
#[tauri::command]
pub async fn locks_close(state: State<'_, AppState>) -> CmdResult<()> {
    state.key().take();
    Ok(())
}

#[tauri::command]
pub async fn notes_lock(state: State<'_, AppState>, id: String) -> CmdResult<NoteSummary> {
    with_key(&state, |library, key| {
        locks::lock(library.db_mut(), key, &id)
    })
}

#[tauri::command]
pub async fn notes_remove_lock(state: State<'_, AppState>, id: String) -> CmdResult<NoteSummary> {
    with_key(&state, |library, key| {
        locks::remove(library.db_mut(), key, &id)
    })
}

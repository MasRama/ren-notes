use renotes_core::features::locks;
use renotes_core::features::notes::{self, Note, NoteFilter, NoteSort, NoteSummary, SaveNote};
use renotes_core::shared::error::Error;
use tauri::State;

use super::locks::CLOSED;
use super::{AppState, CmdResult};

#[tauri::command]
pub async fn notes_list(
    state: State<'_, AppState>,
    filter: NoteFilter,
    sort: NoteSort,
) -> CmdResult<Vec<NoteSummary>> {
    Ok(notes::list(state.lock().db(), &filter, sort)?)
}

/// A note; a locked one comes opened while locked notes are open, and with
/// an empty document while they are closed.
#[tauri::command]
pub async fn notes_get(state: State<'_, AppState>, id: String) -> CmdResult<Note> {
    let library = state.lock();
    let note = notes::get(library.db(), &id)?;
    if !note.summary.locked {
        return Ok(note);
    }
    match state.key().as_ref() {
        Some(key) => Ok(locks::open(library.db(), key, &id)?),
        None => Ok(note),
    }
}

#[tauri::command]
pub async fn notes_create(state: State<'_, AppState>, folder_id: String) -> CmdResult<Note> {
    Ok(notes::create(state.lock().db_mut(), &folder_id)?)
}

#[tauri::command]
pub async fn notes_save(
    state: State<'_, AppState>,
    id: String,
    input: SaveNote,
) -> CmdResult<NoteSummary> {
    let mut library = state.lock();
    if !locks::is_locked(library.db(), &id)? {
        return Ok(notes::save(library.db_mut(), &id, input)?);
    }
    let key = state.key();
    let key = key.as_ref().ok_or(Error::Forbidden(CLOSED))?;
    Ok(locks::save(library.db_mut(), key, &id, input)?)
}

#[tauri::command]
pub async fn notes_move(
    state: State<'_, AppState>,
    id: String,
    folder_id: String,
) -> CmdResult<()> {
    Ok(notes::move_to(state.lock().db_mut(), &id, &folder_id)?)
}

#[tauri::command]
pub async fn notes_set_pinned(
    state: State<'_, AppState>,
    id: String,
    pinned: bool,
) -> CmdResult<()> {
    Ok(notes::set_pinned(state.lock().db_mut(), &id, pinned)?)
}

#[tauri::command]
pub async fn notes_delete(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    Ok(notes::delete(state.lock().db_mut(), &id)?)
}

#[tauri::command]
pub async fn notes_delete_if_empty(state: State<'_, AppState>, id: String) -> CmdResult<bool> {
    Ok(notes::delete_if_empty(state.lock().db_mut(), &id)?)
}

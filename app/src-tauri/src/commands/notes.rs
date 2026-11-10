use renotes_core::features::notes::{self, Note, NoteFilter, NoteSort, NoteSummary, SaveNote};
use tauri::State;

use super::{AppState, CmdResult};

#[tauri::command]
pub async fn notes_list(
    state: State<'_, AppState>,
    filter: NoteFilter,
    sort: NoteSort,
) -> CmdResult<Vec<NoteSummary>> {
    Ok(notes::list(state.lock().db(), &filter, sort)?)
}

#[tauri::command]
pub async fn notes_get(state: State<'_, AppState>, id: String) -> CmdResult<Note> {
    Ok(notes::get(state.lock().db(), &id)?)
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
    Ok(notes::save(state.lock().db_mut(), &id, input)?)
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

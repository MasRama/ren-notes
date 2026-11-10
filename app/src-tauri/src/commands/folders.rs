use renotes_core::features::folders::{self, Folder};
use tauri::State;

use super::{AppState, CmdResult};

#[tauri::command]
pub async fn folders_list(state: State<'_, AppState>) -> CmdResult<Vec<Folder>> {
    Ok(folders::list(state.lock().db())?)
}

#[tauri::command]
pub async fn folders_create(
    state: State<'_, AppState>,
    name: String,
    parent_id: Option<String>,
) -> CmdResult<Folder> {
    Ok(folders::create(
        state.lock().db_mut(),
        &name,
        parent_id.as_deref(),
    )?)
}

#[tauri::command]
pub async fn folders_rename(state: State<'_, AppState>, id: String, name: String) -> CmdResult<()> {
    Ok(folders::rename(state.lock().db_mut(), &id, &name)?)
}

#[tauri::command]
pub async fn folders_move(
    state: State<'_, AppState>,
    id: String,
    parent_id: Option<String>,
    index: usize,
) -> CmdResult<()> {
    Ok(folders::move_to(
        state.lock().db_mut(),
        &id,
        parent_id.as_deref(),
        index,
    )?)
}

#[tauri::command]
pub async fn folders_delete(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    Ok(folders::delete(state.lock().db_mut(), &id)?)
}

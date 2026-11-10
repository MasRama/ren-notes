//! Trash, search, tags, smart folders, session, the old app's import and
//! the desktop's tint.

use renotes_core::features::import::{default_old_db_path, import_old_renotes, ImportReport};
use renotes_core::features::notes::{NoteSort, NoteSummary};
use renotes_core::features::smart_folders::{self, Rules, SmartFolder};
use renotes_core::features::tags::{self, TagCount};
use renotes_core::features::{search as fts, session, trash};
use tauri::State;

use super::{AppState, CmdResult};

#[tauri::command]
pub async fn trash_recover(state: State<'_, AppState>, id: String) -> CmdResult<String> {
    Ok(trash::recover(state.lock().db_mut(), &id)?)
}

#[tauri::command]
pub async fn trash_purge(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    Ok(trash::purge(state.lock().db_mut(), &id)?)
}

#[tauri::command]
pub async fn trash_empty(state: State<'_, AppState>) -> CmdResult<usize> {
    Ok(trash::empty(state.lock().db_mut())?)
}

#[tauri::command]
pub async fn search(state: State<'_, AppState>, query: String) -> CmdResult<Vec<NoteSummary>> {
    Ok(fts::search(state.lock().db(), &query)?)
}

#[tauri::command]
pub async fn tags_list(state: State<'_, AppState>) -> CmdResult<Vec<TagCount>> {
    Ok(tags::list(state.lock().db())?)
}

#[tauri::command]
pub async fn smart_folders_list(state: State<'_, AppState>) -> CmdResult<Vec<SmartFolder>> {
    Ok(smart_folders::list(state.lock().db())?)
}

#[tauri::command]
pub async fn smart_folders_create(
    state: State<'_, AppState>,
    name: String,
    rules: Rules,
) -> CmdResult<SmartFolder> {
    Ok(smart_folders::create(state.lock().db_mut(), &name, rules)?)
}

#[tauri::command]
pub async fn smart_folders_update(
    state: State<'_, AppState>,
    id: String,
    name: String,
    rules: Rules,
) -> CmdResult<()> {
    Ok(smart_folders::update(
        state.lock().db_mut(),
        &id,
        &name,
        rules,
    )?)
}

#[tauri::command]
pub async fn smart_folders_delete(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    Ok(smart_folders::delete(state.lock().db_mut(), &id)?)
}

#[tauri::command]
pub async fn smart_folders_notes(
    state: State<'_, AppState>,
    id: String,
    sort: NoteSort,
) -> CmdResult<Vec<NoteSummary>> {
    Ok(smart_folders::list_notes(state.lock().db(), &id, sort)?)
}

#[tauri::command]
pub async fn session_get(
    state: State<'_, AppState>,
    key: String,
) -> CmdResult<Option<serde_json::Value>> {
    Ok(session::get(state.lock().db(), &key)?)
}

#[tauri::command]
pub async fn session_set(
    state: State<'_, AppState>,
    key: String,
    value: serde_json::Value,
) -> CmdResult<()> {
    Ok(session::set(state.lock().db_mut(), &key, &value)?)
}

/// Imports the first prototype's library, once; `None` when there is
/// nothing (left) to import.
#[tauri::command]
pub async fn import_old(state: State<'_, AppState>) -> CmdResult<Option<ImportReport>> {
    let path = default_old_db_path();
    if !path.is_file() {
        return Ok(None);
    }
    Ok(import_old_renotes(state.lock().db_mut(), &path)?)
}

/// The wallpaper's average colour, or `None` when it cannot be read.
#[tauri::command]
pub async fn desktop_tint() -> Option<String> {
    crate::wallpaper::tint()
}

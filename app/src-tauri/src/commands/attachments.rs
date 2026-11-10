use percent_encoding::percent_decode_str;
use renotes_core::features::attachments::{self, Attachment};
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, State};
use tauri_plugin_opener::OpenerExt;

use super::{AppState, CmdError, CmdResult};

/// Adds a file; its bytes are the raw request body and its name is the
/// URI-encoded `x-file-name` header.
#[tauri::command]
pub async fn attachments_add(
    state: State<'_, AppState>,
    request: Request<'_>,
) -> CmdResult<Attachment> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(CmdError::invalid("expected the file's bytes"));
    };
    let name = request
        .headers()
        .get("x-file-name")
        .and_then(|v| v.to_str().ok())
        .map(|v| percent_decode_str(v).decode_utf8_lossy().into_owned())
        .unwrap_or_else(|| "file".to_owned());
    let mut library = state.lock();
    let root = library.root().to_owned();
    Ok(attachments::add(&root, library.db_mut(), bytes, &name)?)
}

#[tauri::command]
pub async fn attachments_get(
    state: State<'_, AppState>,
    id: String,
) -> CmdResult<Option<Attachment>> {
    Ok(attachments::get(state.lock().db(), &id)?)
}

/// Opens the file with the system's app for its type.
#[tauri::command]
pub async fn attachments_open(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> CmdResult<()> {
    let path = {
        let library = state.lock();
        attachments::file_path(library.root(), library.db(), &id)?
    };
    app.opener()
        .open_path(path.to_string_lossy(), None::<&str>)
        .map_err(|e| CmdError::invalid(e.to_string()))
}

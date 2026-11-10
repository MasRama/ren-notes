//! Renotes' window: one main window, single instance, its size and place
//! remembered, the core behind commands and the renotes:// protocol.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
#[cfg(target_os = "linux")]
mod frame;
mod protocol;

use std::time::Duration;

use renotes_core::app::Library;
use renotes_core::features::{attachments, import, trash};
use renotes_core::shared::paths::data_dir;
use tauri::http::{Response, StatusCode};
use tauri::{Manager, WebviewWindow};

use commands::AppState;

/// Housekeeping done at start and then every hour.
const HOUSEKEEPING_EVERY: Duration = Duration::from_secs(60 * 60);

fn main() {
    let root = data_dir();
    let mut library = Library::open(&root).expect("open the library");
    first_start(&mut library);

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                show(&window);
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new(library))
        .register_asynchronous_uri_scheme_protocol("renotes", |ctx, request, responder| {
            let app = ctx.app_handle().clone();
            let path = request.uri().path().to_owned();
            std::thread::spawn(move || {
                let state = app.state::<AppState>();
                let served = protocol::resolve(&state.lock(), &path);
                let response = served
                    .and_then(|s| std::fs::read(&s.path).ok().map(|bytes| (s.mime, bytes)))
                    .map(|(mime, bytes)| {
                        Response::builder()
                            .header("Content-Type", mime)
                            .header("Cache-Control", "max-age=31536000, immutable")
                            .body(bytes)
                    })
                    .unwrap_or_else(|| {
                        Response::builder()
                            .status(StatusCode::NOT_FOUND)
                            .body(Vec::new())
                    })
                    .expect("a valid response");
                responder.respond(response);
            });
        })
        .setup(|app| {
            #[cfg(target_os = "linux")]
            if let Some(window) = app.get_webview_window("main") {
                frame::apply(&window);
            }
            let handle = app.handle().clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(HOUSEKEEPING_EVERY);
                let state = handle.state::<AppState>();
                housekeeping(&mut state.lock());
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::folders::folders_list,
            commands::folders::folders_create,
            commands::folders::folders_rename,
            commands::folders::folders_move,
            commands::folders::folders_delete,
            commands::notes::notes_list,
            commands::notes::notes_get,
            commands::notes::notes_create,
            commands::notes::notes_save,
            commands::notes::notes_move,
            commands::notes::notes_set_pinned,
            commands::notes::notes_delete,
            commands::notes::notes_delete_if_empty,
            commands::library::trash_recover,
            commands::library::trash_purge,
            commands::library::trash_empty,
            commands::library::search,
            commands::library::tags_list,
            commands::library::smart_folders_list,
            commands::library::smart_folders_create,
            commands::library::smart_folders_update,
            commands::library::smart_folders_delete,
            commands::library::smart_folders_notes,
            commands::library::session_get,
            commands::library::session_set,
            commands::library::import_old,
            commands::attachments::attachments_add,
            commands::attachments::attachments_get,
            commands::attachments::attachments_open,
        ])
        .run(tauri::generate_context!())
        .expect("run Renotes");
}

/// The old prototype's notes come over once; then the usual housekeeping.
fn first_start(library: &mut Library) {
    let old = import::default_old_db_path();
    if old.is_file() {
        if let Err(e) = import::import_old_renotes(library.db_mut(), &old) {
            eprintln!("renotes: importing {} failed: {e}", old.display());
        }
    }
    housekeeping(library);
}

fn housekeeping(library: &mut Library) {
    if let Err(e) = trash::purge_expired(library.db_mut()) {
        eprintln!("renotes: emptying old deleted notes failed: {e}");
    }
    let root = library.root().to_owned();
    if let Err(e) = attachments::collect_garbage(&root, library.db_mut()) {
        eprintln!("renotes: removing unused attachments failed: {e}");
    }
}

fn show(window: &WebviewWindow) {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

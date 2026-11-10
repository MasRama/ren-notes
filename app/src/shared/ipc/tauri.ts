import { invoke } from "@tauri-apps/api/core";
import type { Api } from "./api";

/** The real API: Tauri commands named `<feature>_<action>`. */
export function tauriApi(): Api {
  return {
    foldersList: () => invoke("folders_list"),
    foldersCreate: (name, parentId) => invoke("folders_create", { name, parentId }),
    foldersRename: (id, name) => invoke("folders_rename", { id, name }),
    foldersMove: (id, parentId, index) => invoke("folders_move", { id, parentId, index }),
    foldersDelete: (id) => invoke("folders_delete", { id }),

    notesList: (filter, sort) => invoke("notes_list", { filter, sort }),
    notesGet: (id) => invoke("notes_get", { id }),
    notesCreate: (folderId) => invoke("notes_create", { folderId }),
    notesSave: (id, input) => invoke("notes_save", { id, input }),
    notesMove: (id, folderId) => invoke("notes_move", { id, folderId }),
    notesSetPinned: (id, pinned) => invoke("notes_set_pinned", { id, pinned }),
    notesDelete: (id) => invoke("notes_delete", { id }),
    notesDeleteIfEmpty: (id) => invoke("notes_delete_if_empty", { id }),

    trashRecover: (id) => invoke("trash_recover", { id }),
    trashPurge: (id) => invoke("trash_purge", { id }),
    trashEmpty: () => invoke("trash_empty"),

    search: (query) => invoke("search", { query }),
    tagsList: () => invoke("tags_list"),

    smartFoldersList: () => invoke("smart_folders_list"),
    smartFoldersCreate: (name, rules) => invoke("smart_folders_create", { name, rules }),
    smartFoldersUpdate: (id, name, rules) => invoke("smart_folders_update", { id, name, rules }),
    smartFoldersDelete: (id) => invoke("smart_folders_delete", { id }),
    smartFoldersNotes: (id, sort) => invoke("smart_folders_notes", { id, sort }),

    // Bytes travel as the raw request body; the name rides in a header.
    attachmentsAdd: (bytes, fileName) =>
      invoke("attachments_add", bytes, {
        headers: { "x-file-name": encodeURIComponent(fileName) },
      }),
    attachmentsGet: (id) => invoke("attachments_get", { id }),
    attachmentsOpen: (id) => invoke("attachments_open", { id }),
    attachmentUrl: (id) => `renotes://localhost/attachment/${id}`,
    thumbUrl: (id) => `renotes://localhost/thumb/${id}`,

    sessionGet: (key) => invoke("session_get", { key }),
    sessionSet: (key, value) => invoke("session_set", { key, value }),

    importOld: () => invoke("import_old"),
    desktopTint: () => invoke("desktop_tint"),
  };
}

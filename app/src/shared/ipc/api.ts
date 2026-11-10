import type {
  Attachment,
  Folder,
  ImportReport,
  LockState,
  LinkPreview,
  Note,
  NoteFilter,
  NoteSort,
  NoteSummary,
  Rules,
  SaveNote,
  SmartFolder,
  TagCount,
} from "./types";

/** Everything the page asks of the core. Two implementations: Tauri, and an
 * in-memory one for tests and for viewing the page in a browser. */
export interface Api {
  foldersList(): Promise<Folder[]>;
  foldersCreate(name: string, parentId: string | null): Promise<Folder>;
  foldersRename(id: string, name: string): Promise<void>;
  foldersMove(id: string, parentId: string | null, index: number): Promise<void>;
  foldersDelete(id: string): Promise<void>;

  notesList(filter: NoteFilter, sort: NoteSort): Promise<NoteSummary[]>;
  notesGet(id: string): Promise<Note>;
  notesCreate(folderId: string): Promise<Note>;
  notesSave(id: string, input: SaveNote): Promise<NoteSummary>;
  notesMove(id: string, folderId: string): Promise<void>;
  notesSetPinned(id: string, pinned: boolean): Promise<void>;
  notesDelete(id: string): Promise<void>;
  notesDeleteIfEmpty(id: string): Promise<boolean>;

  locksState(): Promise<LockState>;
  /** Sets the notes password, once; locked notes are open afterwards. */
  locksSetPassword(password: string, hint: string): Promise<void>;
  /** Replaces the notes password; fails with `wrong_password` when `old` is
   * not it. Locked notes are open afterwards. */
  locksChangePassword(old: string, password: string, hint: string): Promise<void>;
  /** Opens locked notes; fails with `wrong_password`. */
  locksOpen(password: string): Promise<void>;
  /** Closes locked notes: their content is sealed until opened again. */
  locksClose(): Promise<void>;
  notesLock(id: string): Promise<NoteSummary>;
  notesRemoveLock(id: string): Promise<NoteSummary>;

  trashRecover(id: string): Promise<string>;
  trashPurge(id: string): Promise<void>;
  trashEmpty(): Promise<number>;

  search(query: string): Promise<NoteSummary[]>;
  tagsList(): Promise<TagCount[]>;

  smartFoldersList(): Promise<SmartFolder[]>;
  smartFoldersCreate(name: string, rules: Rules): Promise<SmartFolder>;
  smartFoldersUpdate(id: string, name: string, rules: Rules): Promise<void>;
  smartFoldersDelete(id: string): Promise<void>;
  smartFoldersNotes(id: string, sort: NoteSort): Promise<NoteSummary[]>;

  attachmentsAdd(bytes: Uint8Array, fileName: string): Promise<Attachment>;
  attachmentsGet(id: string): Promise<Attachment | null>;
  attachmentsOpen(id: string): Promise<void>;
  attachmentUrl(id: string): string;
  thumbUrl(id: string): string;

  sessionGet<T>(key: string): Promise<T | null>;
  sessionSet(key: string, value: unknown): Promise<void>;

  importOld(): Promise<ImportReport | null>;

  /** A web page's title, site and picture, or null when it cannot be read. */
  linkPreview(url: string): Promise<LinkPreview | null>;

  /** The wallpaper's average colour (`#rrggbb`), or null when unknown. */
  desktopTint(): Promise<string | null>;
}

let current: Api | null = null;

export function setApi(api: Api): void {
  current = api;
}

export function api(): Api {
  if (!current) throw new Error("the API is not set up yet");
  return current;
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

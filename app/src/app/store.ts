import { reactive } from "vue";
import type { Api } from "../shared/ipc/api";
import {
  DEFAULT_FOLDER_ID,
  type CoreError,
  type Folder,
  type LockState,
  type Note,
  type NoteFilter,
  type NoteSort,
  type NoteSummary,
  type Rules,
  type SmartFolder,
  type TagCount,
} from "../shared/ipc/types";

/** What the note list shows. */
export type Source =
  | { kind: "folder"; id: string }
  | { kind: "smart"; id: string }
  | { kind: "tags"; tags: string[] }
  | { kind: "trash" };

export type View = "list" | "gallery";
export type Pane = "sidebar" | "list" | "editor";
export type Theme = "system" | "light" | "dark";

/** What is remembered between runs (key `ui`). */
export interface Session {
  source: Source;
  selectedId: string | null;
  view: View;
  sidebarShown: boolean;
  sidebarWidth: number;
  listWidth: number;
  /** Sort per source key; edited time when unset. */
  sorts: Record<string, NoteSort>;
  groupByDate: boolean;
  theme: Theme;
  /** Checked items move to the bottom of their checklist. */
  sinkChecked: boolean;
  /** The sidebar lets the desktop show through (blurred by the desktop,
   * when it blurs behind windows). */
  translucentSidebar: boolean;
  /** Minutes without typing or clicking before locked notes close; 0 never. */
  lockAfter: number;
  collapsed: string[];
}

const NOTES: Source = { kind: "folder", id: DEFAULT_FOLDER_ID };

export const DEFAULT_SESSION: Session = {
  source: NOTES,
  selectedId: null,
  view: "list",
  sidebarShown: true,
  sidebarWidth: 220,
  listWidth: 300,
  sorts: {},
  groupByDate: true,
  theme: "system",
  sinkChecked: true,
  translucentSidebar: false,
  lockAfter: 15,
  collapsed: [],
};

export function sourceKey(source: Source): string {
  switch (source.kind) {
    case "folder":
    case "smart":
      return `${source.kind}:${source.id}`;
    case "tags":
      return `tags:${source.tags.join(",")}`;
    default:
      return "trash";
  }
}

export function sameSource(a: Source, b: Source): boolean {
  return sourceKey(a) === sourceKey(b);
}

function isCoreError(e: unknown, code: CoreError["code"]): boolean {
  return typeof e === "object" && e !== null && (e as CoreError).code === code;
}

export interface State extends Session {
  folders: Folder[];
  smartFolders: SmartFolder[];
  tags: TagCount[];
  notes: NoteSummary[];
  /** Search text; while set, the list shows results from every note. */
  query: string;
  /** Searched words, for highlighting. */
  terms: string[];
  focus: Pane;
  /** Gallery: the note opened full width, if any. */
  galleryOpen: boolean;
  /** Bumped to ask the editor to take focus. */
  focusEditor: number;
  /** A folder whose name is being typed in the sidebar. */
  renamingFolder: string | null;
  /** A short message at the bottom (a failed save, an import). */
  notice: string | null;
  /** The notes password: set or not, and whether locked notes are open. */
  locks: LockState;
  ready: boolean;
}

/** The page's state and everything the UI does to it. Components read
 * `state` and call methods; only the store talks to the API. */
export class Store {
  readonly state: State;
  /** Set by the editor: saves what is typed before the note changes. */
  beforeLeave: (() => Promise<void>) | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;
  private listToken = 0;
  /** Every live note's title, for links between notes. */
  private titles = new Map<string, string>();

  constructor(
    readonly api: Api,
    readonly now: () => number = () => Date.now(),
  ) {
    this.state = reactive({
      ...DEFAULT_SESSION,
      folders: [],
      smartFolders: [],
      tags: [],
      notes: [],
      query: "",
      terms: [],
      focus: "list",
      galleryOpen: false,
      focusEditor: 0,
      renamingFolder: null,
      notice: null,
      locks: { hasPassword: false, hint: "", open: false },
      ready: false,
    }) as State;
  }

  // ---- start ------------------------------------------------------------

  async init(): Promise<void> {
    const saved = (await this.api.sessionGet<Partial<Session>>("ui")) ?? {};
    Object.assign(this.state, DEFAULT_SESSION, saved);
    await Promise.all([this.refreshSidebar(), this.refreshTitles(), this.refreshLocks()]);
    if (!this.sourceExists(this.state.source)) {
      this.state.source = NOTES;
      this.state.selectedId = null;
    }
    await this.loadNotes();
    if (!this.state.notes.some((n) => n.id === this.state.selectedId)) {
      this.state.selectedId = this.state.notes[0]?.id ?? null;
    }
    this.state.ready = true;
  }

  private sourceExists(source: Source): boolean {
    if (source.kind === "folder") return this.state.folders.some((f) => f.id === source.id);
    if (source.kind === "smart") return this.state.smartFolders.some((f) => f.id === source.id);
    if (source.kind === "tags") return source.tags.length > 0;
    return true;
  }

  async refreshSidebar(): Promise<void> {
    const [folders, smartFolders, tags] = await Promise.all([
      this.api.foldersList(),
      this.api.smartFoldersList(),
      this.api.tagsList(),
    ]);
    Object.assign(this.state, { folders, smartFolders, tags });
  }

  async refreshTitles(): Promise<void> {
    const all = await this.api.notesList({ kind: "all" }, "title");
    this.titles = new Map(all.map((n) => [n.id, n.title]));
  }

  /** A live note's title; undefined once it is deleted. */
  noteTitle(id: string): string | undefined {
    return this.titles.get(id);
  }

  // ---- the list ---------------------------------------------------------

  get sort(): NoteSort {
    return this.state.sorts[sourceKey(this.state.source)] ?? "edited";
  }

  get selected(): NoteSummary | null {
    return this.state.notes.find((n) => n.id === this.state.selectedId) ?? null;
  }

  get inTrash(): boolean {
    return this.state.source.kind === "trash" && !this.state.query;
  }

  /** The list's heading: folder name, smart folder name, tags, or search. */
  get title(): string {
    const s = this.state.source;
    if (this.state.query) return "Search";
    if (s.kind === "folder") return this.state.folders.find((f) => f.id === s.id)?.name ?? "Notes";
    if (s.kind === "smart") return this.state.smartFolders.find((f) => f.id === s.id)?.name ?? "";
    if (s.kind === "tags") return s.tags.map((t) => `#${t}`).join(" ");
    return "Recently Deleted";
  }

  async loadNotes(): Promise<void> {
    const token = ++this.listToken;
    const s = this.state.source;
    let notes: NoteSummary[];
    if (this.state.query.trim()) {
      notes = await this.api.search(this.state.query);
    } else if (s.kind === "smart") {
      notes = await this.api.smartFoldersNotes(s.id, this.sort);
    } else {
      const filter: NoteFilter =
        s.kind === "folder" ? { kind: "folder", value: s.id } : s.kind === "tags" ? { kind: "tags", value: s.tags } : { kind: "trash" };
      notes = await this.api.notesList(filter, this.sort);
    }
    if (token === this.listToken) this.state.notes = notes;
  }

  /** Saves what is typed and drops the note if it was left empty. */
  private async leave(): Promise<void> {
    await this.beforeLeave?.();
    const id = this.state.selectedId;
    const note = this.selected;
    if (!id || !note || note.deletedAt !== null) return;
    if (note.title.trim() || note.hasAttachment) return;
    if (await this.api.notesDeleteIfEmpty(id)) {
      this.state.notes = this.state.notes.filter((n) => n.id !== id);
      if (this.state.selectedId === id) this.state.selectedId = null;
      void this.refreshSidebar();
    }
  }

  async select(id: string | null): Promise<void> {
    if (id === this.state.selectedId) return;
    await this.leave();
    this.state.selectedId = id;
    this.persist();
  }

  /** Up/Down in the list. */
  async step(delta: number): Promise<void> {
    const notes = this.state.notes;
    if (!notes.length) return;
    const at = notes.findIndex((n) => n.id === this.state.selectedId);
    const next = at < 0 ? 0 : Math.min(notes.length - 1, Math.max(0, at + delta));
    await this.select(notes[next].id);
  }

  async selectSource(source: Source): Promise<void> {
    await this.leave();
    this.state.source = source;
    this.state.query = "";
    this.state.terms = [];
    this.state.galleryOpen = false;
    await this.loadNotes();
    this.state.selectedId = this.state.notes[0]?.id ?? null;
    this.persist();
  }

  async toggleTag(tag: string): Promise<void> {
    const s = this.state.source;
    const current = s.kind === "tags" ? s.tags : [];
    const tags = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    await this.selectSource(tags.length ? { kind: "tags", tags } : NOTES);
  }

  async search(query: string): Promise<void> {
    if (!query.trim() && !this.state.query) return;
    this.state.query = query;
    this.state.terms = query
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean);
    await this.loadNotes();
    if (!this.state.notes.some((n) => n.id === this.state.selectedId)) {
      this.state.selectedId = this.state.notes[0]?.id ?? null;
    }
  }

  async setSort(sort: NoteSort): Promise<void> {
    this.state.sorts = { ...this.state.sorts, [sourceKey(this.state.source)]: sort };
    await this.loadNotes();
    this.persist();
  }

  toggleTranslucentSidebar(): void {
    this.state.translucentSidebar = !this.state.translucentSidebar;
    this.persist();
  }

  setView(view: View): void {
    this.state.view = view;
    this.state.galleryOpen = false;
    this.persist();
  }

  // ---- notes ------------------------------------------------------------

  async newNote(): Promise<Note> {
    await this.leave();
    const s = this.state.source;
    const folderId = s.kind === "folder" ? s.id : DEFAULT_FOLDER_ID;
    if (s.kind !== "folder" || this.state.query) {
      this.state.source = { kind: "folder", id: folderId };
      this.state.query = "";
      this.state.terms = [];
      await this.loadNotes();
    }
    const note = await this.api.notesCreate(folderId);
    const { docJson: _d, docFormat: _f, ...summary } = note;
    this.titles.set(note.id, note.title);
    const pinned = this.state.notes.filter((n) => n.pinned).length;
    this.state.notes.splice(this.sort === "title" ? 0 : pinned, 0, summary);
    this.state.selectedId = note.id;
    if (this.state.view === "gallery") this.state.galleryOpen = true;
    this.state.focus = "editor";
    this.state.focusEditor++;
    this.persist();
    void this.refreshSidebar();
    return note;
  }

  /** The editor saved: show the new title and snippet, and re-sort. */
  noteSaved(summary: NoteSummary): void {
    if (summary.deletedAt === null) this.titles.set(summary.id, summary.title);
    const notes = this.state.notes;
    const at = notes.findIndex((n) => n.id === summary.id);
    if (at < 0) return;
    const before = notes[at];
    notes[at] = summary;
    if (this.sort === "edited" && summary.updatedAt !== before.updatedAt && !this.state.query) {
      notes.splice(at, 1);
      const top = summary.pinned ? 0 : notes.filter((n) => n.pinned).length;
      notes.splice(top, 0, summary);
    }
    void this.api.tagsList().then((tags) => (this.state.tags = tags));
  }

  private removeFromList(id: string): void {
    const notes = this.state.notes;
    const at = notes.findIndex((n) => n.id === id);
    if (at < 0) return;
    notes.splice(at, 1);
    if (this.state.selectedId === id) {
      this.state.selectedId = (notes[at] ?? notes[at - 1])?.id ?? null;
      this.state.galleryOpen = false;
    }
  }

  /** Moves a note to Recently Deleted, or deletes it for good from there. */
  async deleteNote(id: string): Promise<void> {
    const note = this.state.notes.find((n) => n.id === id);
    if (note?.deletedAt != null) await this.api.trashPurge(id);
    else await this.api.notesDelete(id);
    this.titles.delete(id);
    this.removeFromList(id);
    this.persist();
    await this.refreshSidebar();
  }

  async recover(id: string): Promise<void> {
    await this.api.trashRecover(id);
    this.removeFromList(id);
    await Promise.all([this.refreshSidebar(), this.refreshTitles()]);
  }

  async emptyTrash(): Promise<void> {
    await this.api.trashEmpty();
    this.state.notes = this.state.notes.filter((n) => n.deletedAt === null);
    this.state.selectedId = this.state.notes[0]?.id ?? null;
    await this.refreshSidebar();
  }

  /** Opens a linked note, showing its folder when the list does not have it. */
  async openNote(id: string): Promise<void> {
    if (!this.state.notes.some((n) => n.id === id) || this.inTrash) {
      const note = await this.api.notesGet(id).catch(() => null);
      if (!note || note.deletedAt !== null) {
        this.state.notice = "This note has been deleted.";
        return;
      }
      await this.selectSource({ kind: "folder", id: note.folderId });
    }
    await this.select(id);
    if (this.state.view === "gallery") this.state.galleryOpen = true;
  }

  async setPinned(id: string, pinned: boolean): Promise<void> {
    await this.api.notesSetPinned(id, pinned);
    await this.loadNotes();
  }

  async moveNote(id: string, folderId: string): Promise<void> {
    await this.api.notesMove(id, folderId);
    const s = this.state.source;
    if (s.kind === "folder" && s.id !== folderId) this.removeFromList(id);
    await this.refreshSidebar();
  }

  // ---- locked notes -----------------------------------------------------

  async refreshLocks(): Promise<void> {
    this.state.locks = await this.api.locksState();
  }

  /** Sets the notes password; locked notes are open afterwards. */
  async setNotesPassword(password: string, hint: string): Promise<void> {
    await this.api.locksSetPassword(password, hint);
    await this.refreshLocks();
  }

  /** Replaces the notes password, saving what is typed first; false when
   * `old` is wrong. Locked notes are open afterwards. */
  async changeNotesPassword(old: string, password: string, hint: string): Promise<boolean> {
    await this.beforeLeave?.();
    try {
      await this.api.locksChangePassword(old, password, hint);
    } catch (e) {
      if (isCoreError(e, "wrong_password")) return false;
      throw e;
    }
    await this.refreshLocks();
    return true;
  }

  setLockAfter(minutes: number): void {
    this.state.lockAfter = minutes;
    this.persist();
  }

  /** Opens locked notes; false when the password is wrong. */
  async openLocked(password: string): Promise<boolean> {
    try {
      await this.api.locksOpen(password);
    } catch (e) {
      if (isCoreError(e, "wrong_password")) return false;
      throw e;
    }
    await this.refreshLocks();
    return true;
  }

  /** Saves what is typed, then seals every locked note again. */
  async closeLocked(): Promise<void> {
    await this.beforeLeave?.();
    await this.api.locksClose();
    await this.refreshLocks();
  }

  /** Shows a summary the core changed without an edit (a lock). */
  private replaceSummary(summary: NoteSummary): void {
    const at = this.state.notes.findIndex((n) => n.id === summary.id);
    if (at >= 0) this.state.notes[at] = summary;
  }

  async lockNote(id: string): Promise<void> {
    await this.beforeLeave?.();
    this.replaceSummary(await this.api.notesLock(id));
    await this.refreshSidebar();
  }

  async removeLock(id: string): Promise<void> {
    await this.beforeLeave?.();
    this.replaceSummary(await this.api.notesRemoveLock(id));
    await this.refreshSidebar();
  }

  // ---- folders ----------------------------------------------------------

  /** Creates "New Folder" (or "New Folder 2", …) and starts renaming it. */
  async newFolder(parentId: string | null): Promise<Folder> {
    for (let n = 1; ; n++) {
      const name = n === 1 ? "New Folder" : `New Folder ${n}`;
      try {
        const folder = await this.api.foldersCreate(name, parentId);
        await this.refreshSidebar();
        await this.selectSource({ kind: "folder", id: folder.id });
        this.state.renamingFolder = folder.id;
        return folder;
      } catch (e) {
        if (!isCoreError(e, "name_taken") || n > 200) throw e;
      }
    }
  }

  async renameFolder(id: string, name: string): Promise<void> {
    this.state.renamingFolder = null;
    const folder = this.state.folders.find((f) => f.id === id);
    if (!folder || !name.trim() || name.trim() === folder.name) return;
    try {
      await this.api.foldersRename(id, name);
    } catch (e) {
      if (isCoreError(e, "name_taken")) this.state.notice = `The name “${name.trim()}” is already taken.`;
      else throw e;
    }
    await this.refreshSidebar();
  }

  async moveFolder(id: string, parentId: string | null, index: number): Promise<void> {
    await this.api.foldersMove(id, parentId, index);
    await this.refreshSidebar();
  }

  async deleteFolder(id: string): Promise<void> {
    const ids = new Set([id]);
    for (let grew = true; grew; ) {
      grew = false;
      for (const f of this.state.folders) {
        if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
          ids.add(f.id);
          grew = true;
        }
      }
    }
    await this.api.foldersDelete(id);
    const s = this.state.source;
    await Promise.all([this.refreshSidebar(), this.refreshTitles()]);
    if (s.kind === "folder" && ids.has(s.id)) await this.selectSource(NOTES);
    else await this.loadNotes();
  }

  toggleCollapsed(id: string): void {
    const c = this.state.collapsed;
    this.state.collapsed = c.includes(id) ? c.filter((x) => x !== id) : [...c, id];
    this.persist();
  }

  // ---- smart folders ----------------------------------------------------

  async saveSmartFolder(id: string | null, name: string, rules: Rules): Promise<void> {
    if (id) await this.api.smartFoldersUpdate(id, name, rules);
    else id = (await this.api.smartFoldersCreate(name, rules)).id;
    await this.refreshSidebar();
    await this.selectSource({ kind: "smart", id });
  }

  async deleteSmartFolder(id: string): Promise<void> {
    await this.api.smartFoldersDelete(id);
    await this.refreshSidebar();
    const s = this.state.source;
    if (s.kind === "smart" && s.id === id) await this.selectSource(NOTES);
  }

  // ---- session ----------------------------------------------------------

  session(): Session {
    const s = this.state;
    return {
      source: s.source,
      selectedId: s.selectedId,
      view: s.view,
      sidebarShown: s.sidebarShown,
      sidebarWidth: s.sidebarWidth,
      listWidth: s.listWidth,
      sorts: s.sorts,
      groupByDate: s.groupByDate,
      theme: s.theme,
      sinkChecked: s.sinkChecked,
      translucentSidebar: s.translucentSidebar,
      lockAfter: s.lockAfter,
      collapsed: s.collapsed,
    };
  }

  /** Remembers the session a moment after the last change. */
  persist(): void {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => void this.persistNow(), 400);
  }

  async persistNow(): Promise<void> {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = null;
    await this.api.sessionSet("ui", JSON.parse(JSON.stringify(this.session())));
  }
}

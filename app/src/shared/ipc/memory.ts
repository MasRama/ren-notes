import type { Api } from "./api";
import { parseTags } from "../tags";
import {
  DEFAULT_FOLDER_ID,
  type Attachment,
  type Folder,
  type LinkPreview,
  type Note,
  type NoteFilter,
  type NoteSort,
  type NoteSummary,
  type Rules,
  type SmartFolder,
} from "./types";

const DAY = 24 * 60 * 60 * 1000;
const EMPTY_DOC = '{"type":"doc","content":[{"type":"paragraph"}]}';

interface StoredNote extends Note {
  plainText: string;
  tags: string[];
  attachmentIds: string[];
  deletedFrom: string | null;
  /** A locked note's content, kept aside as the core seals it. */
  sealed: Sealed | null;
}

interface Sealed {
  docJson: string;
  plainText: string;
  snippet: string;
  hasChecklist: boolean;
  tags: string[];
  firstImageId: string | null;
}

function fail(code: string, message: string): never {
  throw { code, message };
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** An Api kept in memory, with the core's rules where the page depends on
 * them. Used by tests and to view the page in a plain browser. */
export class MemoryApi implements Api {
  folders: Folder[] = [
    { id: DEFAULT_FOLDER_ID, parentId: null, name: "Notes", sortIndex: 0, noteCount: 0, isDefault: true },
  ];
  notes: StoredNote[] = [];
  smart: SmartFolder[] = [];
  attachments = new Map<string, Attachment & { url: string }>();
  kv = new Map<string, unknown>();
  /** What desktopTint() answers; the demo takes it from ?tint=. */
  tint: string | null = null;
  now: () => number = () => Date.now();
  private seq = 0;

  id(): string {
    this.seq += 1;
    return `m${String(this.seq).padStart(6, "0")}`;
  }

  private summary(n: StoredNote): NoteSummary {
    const { docJson: _d, docFormat: _f, plainText: _p, tags: _t, attachmentIds: _a, deletedFrom: _r, sealed: _s, ...s } =
      n;
    return { ...s };
  }

  /** The notes password; kept plain, as this API is for tests and the demo. */
  password: { word: string; hint: string } | null = null;
  locksOpenNow = false;

  async locksState() {
    return { hasPassword: !!this.password, hint: this.password?.hint ?? "", open: this.locksOpenNow };
  }
  async locksSetPassword(password: string, hint: string) {
    if (!password.trim()) fail("invalid_input", "a password is needed");
    if (this.password) fail("forbidden", "a notes password is already set");
    this.password = { word: password, hint: hint.trim() };
    this.locksOpenNow = true;
  }
  async locksOpen(password: string) {
    if (!this.password) fail("not_found", "password not found");
    if (password !== this.password.word) fail("wrong_password", "wrong password");
    this.locksOpenNow = true;
  }
  async locksClose() {
    this.locksOpenNow = false;
  }
  private keyed(): void {
    if (!this.locksOpenNow) fail("forbidden", "locked notes are closed");
  }
  async notesLock(id: string) {
    this.keyed();
    const n = this.find(id);
    if (n.deletedAt !== null) fail("not_found", "note not found");
    if (n.locked) fail("invalid_input", "the note is already locked");
    const { docJson, plainText, snippet, hasChecklist, tags, firstImageId } = n;
    Object.assign(n, {
      locked: true,
      sealed: { docJson, plainText, snippet, hasChecklist, tags, firstImageId },
      docJson: "",
      plainText: "",
      snippet: "",
      hasChecklist: false,
      tags: [],
      firstImageId: null,
    });
    return this.summary(n);
  }
  async notesRemoveLock(id: string) {
    this.keyed();
    const n = this.find(id);
    if (!n.locked || !n.sealed) fail("invalid_input", "the note is not locked");
    Object.assign(n, { ...n.sealed, locked: false, sealed: null });
    return this.summary(n);
  }

  private find(id: string): StoredNote {
    return this.notes.find((n) => n.id === id) ?? fail("not_found", "note not found");
  }

  private sorted(list: StoredNote[], sort: NoteSort): NoteSummary[] {
    const key = (n: StoredNote) => (sort === "created" ? n.createdAt : n.updatedAt);
    return [...list]
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (sort === "title") return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
        return key(b) - key(a) || b.id.localeCompare(a.id);
      })
      .map((n) => this.summary(n));
  }

  async foldersList() {
    return this.folders.map((f) => ({
      ...f,
      noteCount: this.notes.filter((n) => n.folderId === f.id && n.deletedAt === null).length,
    }));
  }
  async foldersCreate(name: string, parentId: string | null) {
    const clean = name.trim();
    if (!clean) fail("invalid_input", "a folder needs a name");
    if (this.folders.some((f) => f.parentId === parentId && fold(f.name) === fold(clean))) {
      fail("name_taken", "that name is already taken");
    }
    const siblings = this.folders.filter((f) => f.parentId === parentId);
    const folder: Folder = {
      id: this.id(),
      parentId,
      name: clean,
      sortIndex: Math.max(0, ...siblings.map((f) => f.sortIndex)) + 1,
      noteCount: 0,
      isDefault: false,
    };
    this.folders.push(folder);
    return folder;
  }
  async foldersRename(id: string, name: string) {
    const folder = this.folders.find((f) => f.id === id) ?? fail("not_found", "folder not found");
    const clean = name.trim();
    if (!clean) fail("invalid_input", "a folder needs a name");
    if (this.folders.some((f) => f.id !== id && f.parentId === folder.parentId && fold(f.name) === fold(clean))) {
      fail("name_taken", "that name is already taken");
    }
    folder.name = clean;
  }
  async foldersMove(id: string, parentId: string | null, index: number) {
    const folder = this.folders.find((f) => f.id === id) ?? fail("not_found", "folder not found");
    let up = parentId;
    while (up) {
      if (up === id) fail("invalid_input", "a folder cannot go inside itself");
      up = this.folders.find((f) => f.id === up)?.parentId ?? null;
    }
    folder.parentId = parentId;
    const siblings = this.folders
      .filter((f) => f.parentId === parentId && f.id !== id && !f.isDefault)
      .sort((a, b) => a.sortIndex - b.sortIndex);
    siblings.splice(Math.min(index, siblings.length), 0, folder);
    siblings.forEach((f, i) => (f.sortIndex = i + 1));
  }
  async foldersDelete(id: string) {
    if (id === DEFAULT_FOLDER_ID) fail("forbidden", "the Notes folder cannot be deleted");
    const subtree = new Set([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const f of this.folders) {
        if (f.parentId && subtree.has(f.parentId) && !subtree.has(f.id)) {
          subtree.add(f.id);
          grew = true;
        }
      }
    }
    for (const n of this.notes) {
      if (!subtree.has(n.folderId)) continue;
      if (n.deletedAt === null) {
        n.deletedAt = this.now();
        n.deletedFrom = n.folderId;
      }
      n.folderId = DEFAULT_FOLDER_ID;
    }
    this.folders = this.folders.filter((f) => !subtree.has(f.id));
  }

  async notesList(filter: NoteFilter, sort: NoteSort) {
    if (filter.kind === "trash") {
      return this.notes
        .filter((n) => n.deletedAt !== null)
        .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
        .map((n) => this.summary(n));
    }
    const live = this.notes.filter((n) => n.deletedAt === null);
    if (filter.kind === "folder") return this.sorted(live.filter((n) => n.folderId === filter.value), sort);
    if (filter.kind === "tags") {
      const wanted = filter.value.map((t) => t.toLowerCase());
      return this.sorted(live.filter((n) => wanted.every((t) => n.tags.includes(t))), sort);
    }
    return this.sorted(live, sort);
  }
  async notesGet(id: string) {
    const n = this.find(id);
    const docJson = n.locked && this.locksOpenNow ? n.sealed!.docJson : n.docJson;
    return { ...this.summary(n), docJson, docFormat: n.docFormat };
  }
  async notesCreate(folderId: string) {
    if (!this.folders.some((f) => f.id === folderId)) fail("not_found", "folder not found");
    const now = this.now();
    const n: StoredNote = {
      id: this.id(),
      folderId,
      title: "",
      snippet: "",
      firstImageId: null,
      pinned: false,
      hasChecklist: false,
      hasAttachment: false,
      locked: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      docJson: EMPTY_DOC,
      docFormat: "tiptap",
      plainText: "",
      tags: [],
      attachmentIds: [],
      deletedFrom: null,
      sealed: null,
    };
    this.notes.push(n);
    return this.notesGet(n.id);
  }
  async notesSave(id: string, input: import("./types").SaveNote) {
    const n = this.find(id);
    if (n.deletedAt !== null) fail("not_found", "note not found");
    const known = input.attachmentIds.filter((a) => this.attachments.has(a));
    if (n.locked) {
      this.keyed();
      Object.assign(n, {
        title: input.title.replace(/\s+/g, " ").trim().slice(0, 200),
        sealed: {
          docJson: input.docJson,
          plainText: input.plainText,
          snippet: input.snippet.replace(/\s+/g, " ").trim().slice(0, 300),
          hasChecklist: input.hasChecklist,
          tags: parseTags(input.plainText),
          firstImageId: known.find((a) => this.attachments.get(a)?.mime.startsWith("image/")) ?? null,
        },
        attachmentIds: known,
        hasAttachment: known.length > 0,
        updatedAt: input.keepTime ? n.updatedAt : this.now(),
      });
      return this.summary(n);
    }
    Object.assign(n, {
      docJson: input.docJson,
      docFormat: "tiptap",
      title: input.title.replace(/\s+/g, " ").trim().slice(0, 200),
      snippet: input.snippet.replace(/\s+/g, " ").trim().slice(0, 300),
      plainText: input.plainText,
      hasChecklist: input.hasChecklist,
      tags: parseTags(input.plainText),
      attachmentIds: known,
      hasAttachment: known.length > 0,
      firstImageId: known.find((a) => this.attachments.get(a)?.mime.startsWith("image/")) ?? null,
      updatedAt: input.keepTime ? n.updatedAt : this.now(),
    });
    return this.summary(n);
  }
  async notesMove(id: string, folderId: string) {
    if (!this.folders.some((f) => f.id === folderId)) fail("not_found", "folder not found");
    this.find(id).folderId = folderId;
  }
  async notesSetPinned(id: string, pinned: boolean) {
    this.find(id).pinned = pinned;
  }
  async notesDelete(id: string) {
    const n = this.find(id);
    if (n.deletedAt !== null) fail("not_found", "note not found");
    n.deletedAt = this.now();
    n.deletedFrom = n.folderId;
  }
  async notesDeleteIfEmpty(id: string) {
    const n = this.notes.find((x) => x.id === id);
    if (!n || n.locked || n.title.trim() || n.plainText.trim() || n.hasAttachment) return false;
    this.notes = this.notes.filter((x) => x.id !== id);
    return true;
  }

  async trashRecover(id: string) {
    const n = this.find(id);
    if (n.deletedAt === null) fail("not_found", "deleted note not found");
    const folder =
      n.deletedFrom && this.folders.some((f) => f.id === n.deletedFrom) ? n.deletedFrom : DEFAULT_FOLDER_ID;
    Object.assign(n, { folderId: folder, deletedAt: null, deletedFrom: null });
    return folder;
  }
  async trashPurge(id: string) {
    if (this.find(id).deletedAt === null) fail("not_found", "deleted note not found");
    this.notes = this.notes.filter((n) => n.id !== id);
  }
  async trashEmpty() {
    const before = this.notes.length;
    this.notes = this.notes.filter((n) => n.deletedAt === null);
    return before - this.notes.length;
  }

  async search(query: string) {
    const words = fold(query).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    if (!words.length) return [];
    const hits = this.notes.filter((n) => {
      if (n.deletedAt !== null) return false;
      const tokens = fold(`${n.title} ${n.plainText}`).split(/[^\p{L}\p{N}]+/u);
      return words.every((w) => tokens.some((t) => t.startsWith(w)));
    });
    const inTitle = (n: StoredNote) => words.some((w) => fold(n.title).includes(w));
    hits.sort((a, b) => Number(inTitle(b)) - Number(inTitle(a)) || b.updatedAt - a.updatedAt);
    return hits.map((n) => this.summary(n));
  }
  async tagsList() {
    const counts = new Map<string, number>();
    for (const n of this.notes) {
      if (n.deletedAt !== null) continue;
      for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([tag, count]) => ({ tag, count }));
  }

  async smartFoldersList() {
    return [...this.smart];
  }
  async smartFoldersCreate(name: string, rules: Rules) {
    if (!name.trim()) fail("invalid_input", "a smart folder needs a name");
    const folder = { id: this.id(), name: name.trim(), rules, sortIndex: this.smart.length + 1 };
    this.smart.push(folder);
    return folder;
  }
  async smartFoldersUpdate(id: string, name: string, rules: Rules) {
    const f = this.smart.find((s) => s.id === id) ?? fail("not_found", "smart folder not found");
    Object.assign(f, { name: name.trim(), rules });
  }
  async smartFoldersDelete(id: string) {
    this.smart = this.smart.filter((s) => s.id !== id);
  }
  async smartFoldersNotes(id: string, sort: NoteSort) {
    const f = this.smart.find((s) => s.id === id) ?? fail("not_found", "smart folder not found");
    const r = f.rules;
    const now = this.now();
    return this.sorted(
      this.notes.filter((n) => {
        if (n.deletedAt !== null) return false;
        if (r.tags.length) {
          const has = r.tags.map((t) => n.tags.includes(t));
          if (r.tagMatch === "all" ? !has.every(Boolean) : !has.some(Boolean)) return false;
        }
        if (r.editedWithinDays !== null && n.updatedAt < now - r.editedWithinDays * DAY) return false;
        if (r.createdWithinDays !== null && n.createdAt < now - r.createdWithinDays * DAY) return false;
        if (r.hasChecklist && !n.hasChecklist) return false;
        if (r.hasAttachment && !n.hasAttachment) return false;
        if (r.pinned && !n.pinned) return false;
        return true;
      }),
      sort,
    );
  }

  async attachmentsAdd(bytes: Uint8Array, fileName: string) {
    const isImage = /\.(png|jpe?g|gif|webp)$/i.test(fileName);
    const mime = isImage ? `image/${fileName.split(".").pop()!.toLowerCase().replace("jpg", "jpeg")}` : "application/octet-stream";
    const id = this.id();
    const url = URL.createObjectURL(new Blob([bytes.slice()], { type: mime }));
    const a = { id, mime, fileName, byteSize: bytes.length, width: null, height: null, url };
    this.attachments.set(id, a);
    return { id, mime, fileName, byteSize: bytes.length, width: null, height: null };
  }
  /** Registers a picture by URL, for demo data. */
  addPictureUrl(url: string, fileName: string, width: number, height: number): string {
    const id = this.id();
    this.attachments.set(id, { id, mime: "image/jpeg", fileName, byteSize: 1, width, height, url });
    return id;
  }
  async attachmentsGet(id: string) {
    const a = this.attachments.get(id);
    if (!a) return null;
    const { url: _u, ...rest } = a;
    return rest;
  }
  async attachmentsOpen() {}
  attachmentUrl(id: string) {
    return this.attachments.get(id)?.url ?? "";
  }
  thumbUrl(id: string) {
    return this.attachmentUrl(id);
  }

  async sessionGet<T>(key: string) {
    return (this.kv.get(key) as T | undefined) ?? null;
  }
  async sessionSet(key: string, value: unknown) {
    this.kv.set(key, value);
  }

  async importOld() {
    return null;
  }

  /** What linkPreview() answers, by address; the demo fills it. */
  previews = new Map<string, LinkPreview>();
  async linkPreview(url: string) {
    return this.previews.get(url) ?? null;
  }

  async desktopTint() {
    return this.tint;
  }
}

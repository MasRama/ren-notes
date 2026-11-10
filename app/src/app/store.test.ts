import { beforeEach, describe, expect, it } from "vitest";
import { MemoryApi } from "../shared/ipc/memory";
import { DEFAULT_FOLDER_ID } from "../shared/ipc/types";
import { Store } from "./store";

let mem: MemoryApi;
let clock: number;
let store: Store;

async function noteIn(folderId: string, title: string) {
  const n = await mem.notesCreate(folderId);
  clock += 1000;
  await mem.notesSave(n.id, {
    docJson: "{}",
    title,
    snippet: "",
    plainText: `${title}\n`,
    hasChecklist: false,
    attachmentIds: [],
  });
  return n.id;
}

beforeEach(async () => {
  mem = new MemoryApi();
  clock = Date.UTC(2026, 10, 10, 9);
  mem.now = () => clock;
  store = new Store(mem, () => clock);
});

describe("Store", () => {
  it("opens the Notes folder and selects the newest note on first start", async () => {
    await noteIn(DEFAULT_FOLDER_ID, "older");
    const newer = await noteIn(DEFAULT_FOLDER_ID, "newer");
    await store.init();
    expect(store.state.source).toEqual({ kind: "folder", id: DEFAULT_FOLDER_ID });
    expect(store.state.notes.map((n) => n.title)).toEqual(["newer", "older"]);
    expect(store.state.selectedId).toBe(newer);
  });

  it("resumes the saved source, note and view", async () => {
    const work = await mem.foldersCreate("Work", null);
    const a = await noteIn(work.id, "a");
    await noteIn(work.id, "b");
    await mem.sessionSet("ui", { source: { kind: "folder", id: work.id }, selectedId: a, view: "gallery" });
    await store.init();
    expect(store.state.source).toEqual({ kind: "folder", id: work.id });
    expect(store.state.selectedId).toBe(a);
    expect(store.state.view).toBe("gallery");
  });

  it("falls back to Notes when the saved folder is gone", async () => {
    await mem.sessionSet("ui", { source: { kind: "folder", id: "gone" }, selectedId: "x" });
    await store.init();
    expect(store.state.source).toEqual({ kind: "folder", id: DEFAULT_FOLDER_ID });
    expect(store.state.selectedId).toBeNull();
  });

  it("puts a new note at the top of the selected folder and selects it", async () => {
    const work = await mem.foldersCreate("Work", null);
    await noteIn(work.id, "old");
    await store.init();
    await store.selectSource({ kind: "folder", id: work.id });
    const created = await store.newNote();
    expect(created.folderId).toBe(work.id);
    expect(store.state.notes[0].id).toBe(created.id);
    expect(store.state.selectedId).toBe(created.id);
  });

  it("files a new note under Notes when a tag, smart folder or trash is shown", async () => {
    await store.init();
    await store.selectSource({ kind: "trash" });
    const created = await store.newNote();
    expect(created.folderId).toBe(DEFAULT_FOLDER_ID);
    expect(store.state.source).toEqual({ kind: "folder", id: DEFAULT_FOLDER_ID });
  });

  it("drops an empty note when you leave it", async () => {
    await noteIn(DEFAULT_FOLDER_ID, "kept");
    await store.init();
    const blank = await store.newNote();
    await store.select(store.state.notes[1].id);
    expect(store.state.notes.map((n) => n.id)).not.toContain(blank.id);
    expect(mem.notes.some((n) => n.id === blank.id)).toBe(false);
  });

  it("flushes the editor before leaving a note", async () => {
    const a = await noteIn(DEFAULT_FOLDER_ID, "a");
    await noteIn(DEFAULT_FOLDER_ID, "b");
    await store.init();
    const order: string[] = [];
    store.beforeLeave = async () => {
      order.push("flush");
    };
    await store.select(a);
    expect(order).toEqual(["flush"]);
  });

  it("moves an edited note to the top when sorted by edit time", async () => {
    const a = await noteIn(DEFAULT_FOLDER_ID, "a");
    await noteIn(DEFAULT_FOLDER_ID, "b");
    await store.init();
    clock += 5000;
    const saved = await mem.notesSave(a, {
      docJson: "{}",
      title: "a2",
      snippet: "",
      plainText: "a2",
      hasChecklist: false,
      attachmentIds: [],
    });
    store.noteSaved(saved);
    expect(store.state.notes.map((n) => n.title)).toEqual(["a2", "b"]);
  });

  it("selects the next note after deleting the selected one", async () => {
    const c = await noteIn(DEFAULT_FOLDER_ID, "c");
    const b = await noteIn(DEFAULT_FOLDER_ID, "b");
    const a = await noteIn(DEFAULT_FOLDER_ID, "a");
    await store.init();
    await store.select(b);
    await store.deleteNote(b);
    expect(store.state.notes.map((n) => n.id)).toEqual([a, c]);
    expect(store.state.selectedId).toBe(c);
    await store.deleteNote(c);
    expect(store.state.selectedId).toBe(a);
  });

  it("searches every note and goes back to the folder when the query is cleared", async () => {
    const work = await mem.foldersCreate("Work", null);
    await noteIn(work.id, "grocery list");
    await noteIn(DEFAULT_FOLDER_ID, "other");
    await store.init();
    await store.search("groc");
    expect(store.state.notes.map((n) => n.title)).toEqual(["grocery list"]);
    await store.search("");
    expect(store.state.notes.map((n) => n.title)).toEqual(["other"]);
  });

  it("moves the selection with the arrow keys", async () => {
    const b = await noteIn(DEFAULT_FOLDER_ID, "b");
    const a = await noteIn(DEFAULT_FOLDER_ID, "a");
    await store.init();
    expect(store.state.selectedId).toBe(a);
    await store.step(1);
    expect(store.state.selectedId).toBe(b);
    await store.step(1);
    expect(store.state.selectedId).toBe(b);
    await store.step(-1);
    expect(store.state.selectedId).toBe(a);
  });

  it("names a new folder New Folder, then New Folder 2", async () => {
    await store.init();
    const one = await store.newFolder(null);
    const two = await store.newFolder(null);
    expect([one.name, two.name]).toEqual(["New Folder", "New Folder 2"]);
    expect(store.state.folders.map((f) => f.name)).toContain("New Folder 2");
  });

  it("shows a new folder right away, so a new note lands in it", async () => {
    await store.init();
    const folder = await store.newFolder(null);
    expect(store.state.source).toEqual({ kind: "folder", id: folder.id });
    const note = await store.newNote();
    expect(note.folderId).toBe(folder.id);
  });

  it("shows Notes again when the shown folder is deleted", async () => {
    const work = await mem.foldersCreate("Work", null);
    await store.init();
    await store.selectSource({ kind: "folder", id: work.id });
    await store.deleteFolder(work.id);
    expect(store.state.source).toEqual({ kind: "folder", id: DEFAULT_FOLDER_ID });
  });

  it("toggles tags into an AND filter", async () => {
    await store.init();
    await store.toggleTag("work");
    expect(store.state.source).toEqual({ kind: "tags", tags: ["work"] });
    await store.toggleTag("urgent");
    expect(store.state.source).toEqual({ kind: "tags", tags: ["work", "urgent"] });
    await store.toggleTag("work");
    await store.toggleTag("urgent");
    expect(store.state.source).toEqual({ kind: "folder", id: DEFAULT_FOLDER_ID });
  });

  it("remembers the session", async () => {
    await store.init();
    await store.selectSource({ kind: "trash" });
    store.setView("gallery");
    await store.persistNow();
    expect(await mem.sessionGet("ui")).toMatchObject({ source: { kind: "trash" }, view: "gallery" });
  });

  it("keeps the sidebar opaque until it is made translucent, and remembers that", async () => {
    await store.init();
    expect(store.state.translucentSidebar).toBe(false);
    store.toggleTranslucentSidebar();
    await store.persistNow();
    expect(await mem.sessionGet("ui")).toMatchObject({ translucentSidebar: true });
  });

  it("opens a linked note, going to its folder when the list does not show it", async () => {
    const folder = await mem.foldersCreate("Trips", null);
    const target = await noteIn(folder.id, "Trip budget");
    await noteIn(DEFAULT_FOLDER_ID, "Plan");
    await store.init();
    await store.openNote(target);
    expect(store.state.source).toEqual({ kind: "folder", id: folder.id });
    expect(store.state.selectedId).toBe(target);
  });

  it("says so when a linked note has been deleted", async () => {
    const gone = await noteIn(DEFAULT_FOLDER_ID, "Old plan");
    const here = await noteIn(DEFAULT_FOLDER_ID, "Plan");
    await mem.notesDelete(gone);
    await store.init();
    await store.openNote(gone);
    expect(store.state.selectedId).toBe(here);
    expect(store.state.notice).toBe("This note has been deleted.");
  });

  it("knows every note's title for links, and keeps it current", async () => {
    const a = await noteIn(DEFAULT_FOLDER_ID, "Trip");
    await store.init();
    expect(store.noteTitle(a)).toBe("Trip");
    store.noteSaved({ ...store.state.notes[0], title: "Trip budget" });
    expect(store.noteTitle(a)).toBe("Trip budget");
    await store.deleteNote(a);
    expect(store.noteTitle(a)).toBeUndefined();
  });

  describe("locked notes", () => {
    async function noteWithTag() {
      const n = await mem.notesCreate(DEFAULT_FOLDER_ID);
      await mem.notesSave(n.id, {
        docJson: '{"secret":true}',
        title: "Bank",
        snippet: "PIN 4821",
        plainText: "Bank\nPIN 4821 #money",
        hasChecklist: false,
        attachmentIds: [],
      });
      return n.id;
    }

    it("sets the password once and opens with the right one only", async () => {
      await store.init();
      expect(store.state.locks).toEqual({ hasPassword: false, hint: "", open: false });
      await store.setNotesPassword("hunter2", "the usual");
      expect(store.state.locks).toEqual({ hasPassword: true, hint: "the usual", open: true });
      await store.closeLocked();
      expect(store.state.locks.open).toBe(false);
      expect(await store.openLocked("nope")).toBe(false);
      expect(store.state.locks.open).toBe(false);
      expect(await store.openLocked("hunter2")).toBe(true);
      expect(store.state.locks.open).toBe(true);
    });

    it("locks a note, saving what was typed first, and takes it out of tags", async () => {
      const id = await noteWithTag();
      await store.init();
      await store.setNotesPassword("hunter2", "");
      let flushed = 0;
      store.beforeLeave = async () => void flushed++;
      await store.lockNote(id);
      expect(flushed).toBe(1);
      expect(store.state.notes[0]).toMatchObject({ id, locked: true, snippet: "" });
      expect(store.state.tags).toEqual([]);
      expect(await mem.search("4821")).toEqual([]);
    });

    it("gives the content back when the lock is removed", async () => {
      const id = await noteWithTag();
      await store.init();
      await store.setNotesPassword("hunter2", "");
      await store.lockNote(id);
      await store.removeLock(id);
      expect(store.state.notes[0]).toMatchObject({ id, locked: false, snippet: "PIN 4821" });
      expect(store.state.tags.map((t) => t.tag)).toEqual(["money"]);
      expect((await mem.notesGet(id)).docJson).toBe('{"secret":true}');
    });

    it("changes the password, saving what was typed first", async () => {
      const id = await noteWithTag();
      await store.init();
      await store.setNotesPassword("hunter2", "");
      await store.lockNote(id);
      let flushed = 0;
      store.beforeLeave = async () => void flushed++;
      expect(await store.changeNotesPassword("nope", "new", "")).toBe(false);
      expect(await store.changeNotesPassword("hunter2", "new", "fresh")).toBe(true);
      expect(flushed).toBe(2);
      expect(store.state.locks).toEqual({ hasPassword: true, hint: "fresh", open: true });
      expect((await mem.notesGet(id)).docJson).toBe('{"secret":true}');
    });

    it("closing locked notes saves first and seals them again", async () => {
      const id = await noteWithTag();
      await store.init();
      await store.setNotesPassword("hunter2", "");
      await store.lockNote(id);
      let flushed = 0;
      store.beforeLeave = async () => void flushed++;
      await store.closeLocked();
      expect(flushed).toBe(1);
      expect((await mem.notesGet(id)).docJson).toBe("");
      await expect(mem.notesSave(id, { docJson: "{}", title: "Bank", snippet: "", plainText: "Bank", hasChecklist: false, attachmentIds: [] })).rejects.toMatchObject({ code: "forbidden" });
    });
  });
});

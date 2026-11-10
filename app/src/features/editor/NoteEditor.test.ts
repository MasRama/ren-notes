import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";
import { StoreKey } from "../../app/context";
import { Store } from "../../app/store";
import { setApi } from "../../shared/ipc/api";
import { MemoryApi } from "../../shared/ipc/memory";
import { DEFAULT_FOLDER_ID } from "../../shared/ipc/types";
import NoteEditor from "./NoteEditor.vue";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
let unmount: (() => void) | null = null;
afterEach(() => unmount?.());

async function open(docJson: string, docFormat: "tiptap" | "legacy_html" = "tiptap") {
  const mem = new MemoryApi();
  setApi(mem);
  const n = await mem.notesCreate(DEFAULT_FOLDER_ID);
  const stored = mem.notes.find((x) => x.id === n.id)!;
  Object.assign(stored, { docJson, docFormat, title: "Old", updatedAt: 1000, createdAt: 1000 });
  const store = new Store(mem);
  await store.init();
  const el = document.createElement("div");
  document.body.append(el);
  const app = createApp(defineComponent({ render: () => h(NoteEditor, { findTerms: null }) }));
  app.provide(StoreKey, store);
  app.mount(el);
  unmount = () => app.unmount();
  await nextTick();
  await wait(500);
  return { mem, stored, el, store };
}

describe("NoteEditor", () => {
  it("opening a note does not change its edit time", async () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Old" }] },
        { type: "paragraph", content: [{ type: "text", text: "body" }] },
      ],
    };
    const { stored } = await open(JSON.stringify(doc));
    expect(stored.updatedAt).toBe(1000);
  });

  it("converts an imported note once, keeping its edit time", async () => {
    const { stored } = await open("<h1>Old</h1><div>line</div>", "legacy_html");
    expect(stored.docFormat).toBe("tiptap");
    expect(stored.updatedAt).toBe(1000);
    expect(stored.plainText).toContain("line");
  });

  it("opens with the cursor in text, not a picture selected", async () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "Old" }] },
        { type: "image", attrs: { attachmentId: "x" } },
      ],
    };
    const { el } = await open(JSON.stringify(doc));
    expect(el.querySelector(".ProseMirror-selectednode")).toBeNull();
  });

  it("puts the cursor in a new note made in an empty folder", async () => {
    const { mem, el, store } = await open('{"type":"doc","content":[]}');
    const empty = await mem.foldersCreate("Ideas", null);
    await store.selectSource({ kind: "folder", id: empty.id });
    await wait(100);
    await store.newNote();
    await wait(300);
    expect(el.querySelector(".ProseMirror")?.contains(document.activeElement)).toBe(true);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";
import { currentEditor, signals, StoreKey } from "../../app/context";
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

  it("folding a heading is saved without changing the edit time", async () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Pack" }] },
        { type: "paragraph", content: [{ type: "text", text: "jackets" }] },
      ],
    };
    const { stored } = await open(JSON.stringify(doc));
    currentEditor.value!.commands.toggleFold(0);
    await wait(500);
    expect(JSON.parse(stored.docJson).content[0].attrs.collapsed).toBe(true);
    expect(stored.updatedAt).toBe(1000);
  });

  it("turns an address pasted on an empty line into a link card", async () => {
    const url = "https://example.com/trip";
    const doc = { type: "doc", content: [{ type: "paragraph" }] };
    const { mem, stored, el } = await open(JSON.stringify(doc));
    mem.previews.set(url, { url, title: "Weekend in Lembang", site: "Example", imageId: null });
    const view = currentEditor.value!.view;
    view.focus();
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", url);
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", { value: clipboardData });
    view.dom.dispatchEvent(paste);
    await wait(500);
    expect(el.querySelector(".rn-link-card .rn-link-title")?.textContent).toBe("Weekend in Lembang");
    expect(JSON.parse(stored.docJson).content[0]).toMatchObject({ type: "linkCard", attrs: { url } });
  });

  it("offers notes after >> and links the one chosen with the keyboard", async () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "See " }] }] };
    const { mem, stored, el, store } = await open(JSON.stringify(doc));
    const other = await mem.notesCreate(DEFAULT_FOLDER_ID);
    await mem.notesSave(other.id, { docJson: "{}", title: "Trip budget", snippet: "", plainText: "Trip budget", hasChecklist: false, attachmentIds: [] });
    await store.refreshTitles();
    const e = currentEditor.value!;
    e.commands.focus("end");
    for (const ch of ">>trip") e.commands.insertContent(ch);
    await wait(100);
    const items = [...document.querySelectorAll(".rn-link-picker .item")].map((x) => x.textContent?.trim());
    expect(items).toEqual(["Trip budget"]);
    e.view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await wait(500);
    expect(document.querySelector(".rn-link-picker")).toBeNull();
    expect(el.querySelector(".rn-note-link")?.textContent).toBe("Trip budget");
    expect(JSON.parse(stored.docJson).content[0].content[1]).toEqual({
      type: "noteLink",
      attrs: { id: other.id, title: "Trip budget" },
    });
  });

  it("draws a new drawing from the toolbar and saves its strokes", async () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Map" }] }] };
    const { stored, el } = await open(JSON.stringify(doc));
    currentEditor.value!.commands.focus("end");
    signals.newSketch++;
    await wait(50);
    const paper = document.querySelector<SVGSVGElement>(".sketch-sheet svg.paper")!;
    const at = (type: string, x: number) =>
      paper.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: 10, pointerId: 1, bubbles: true, button: 0 }));
    at("pointerdown", 10);
    at("pointermove", 60);
    at("pointerup", 60);
    document.querySelector<HTMLElement>(".sketch-sheet .done")!.click();
    await wait(500);
    expect(document.querySelector(".sketch-sheet")).toBeNull();
    expect(el.querySelectorAll(".rn-sketch path")).toHaveLength(1);
    expect(JSON.parse(stored.docJson).content[1]).toMatchObject({
      type: "sketch",
      attrs: { strokes: [{ tool: "pen", color: "ink" }] },
    });
  });

  it("drops a new drawing that is cancelled before anything is drawn", async () => {
    const doc = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Map" }] }] };
    const { el } = await open(JSON.stringify(doc));
    currentEditor.value!.commands.focus("end");
    signals.newSketch++;
    await wait(50);
    document.querySelector<HTMLElement>(".sketch-sheet .cancel")!.click();
    await wait(50);
    expect(document.querySelector(".sketch-sheet")).toBeNull();
    expect(el.querySelector(".rn-sketch")).toBeNull();
  });
});

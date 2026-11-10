import { afterEach, describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import { noteExtensions } from "./index";
import { foldedBlocks } from "./folding";

const editors: Editor[] = [];
function make(content: object | string) {
  const editor = new Editor({
    extensions: noteExtensions({
      attachmentUrl: (id) => `renotes://localhost/attachment/${id}`,
      openAttachment: () => {},
      toggleChecked: () => false,
    }),
    content,
  });
  editors.push(editor);
  return editor;
}
afterEach(() => editors.splice(0).forEach((e) => e.destroy()));

const h = (level: number, text: string, collapsed = false): JSONContent => ({
  type: "heading",
  attrs: { level, collapsed },
  content: [{ type: "text", text }],
});
const p = (text: string): JSONContent => ({ type: "paragraph", content: [{ type: "text", text }] });
const doc = (...content: JSONContent[]) => ({ type: "doc", content });

/** Where the heading that is the index-th top-level block starts. */
function posOf(editor: Editor, index: number) {
  let pos = 0;
  for (let i = 0; i < index; i++) pos += editor.state.doc.child(i).nodeSize;
  return pos;
}

describe("foldedBlocks", () => {
  it("hides a collapsed heading's section, up to the next heading as big or bigger", () => {
    const editor = make(
      doc(h(1, "Trip"), h(2, "Pack", true), p("jackets"), h(3, "Food"), p("coffee"), h(2, "Route"), p("north")),
    );
    expect([...foldedBlocks(editor.state.doc).keys()]).toEqual([2, 3, 4]);
    expect(foldedBlocks(editor.state.doc).get(4)).toBe(1);
  });

  it("hides nothing without a collapsed heading", () => {
    const editor = make(doc(h(1, "Trip"), p("jackets")));
    expect(foldedBlocks(editor.state.doc).size).toBe(0);
  });
});

describe("folding headings", () => {
  it("collapses and expands a heading without touching the undo history", () => {
    const editor = make(doc(h(1, "Trip"), h(2, "Pack"), p("jackets")));
    editor.commands.toggleFold(posOf(editor, 1));
    expect(editor.state.doc.child(1).attrs.collapsed).toBe(true);
    expect(editor.view.dom.querySelectorAll(".rn-folded")).toHaveLength(1);
    expect(editor.can().undo()).toBe(false);
    editor.commands.toggleFold(posOf(editor, 1));
    expect(editor.state.doc.child(1).attrs.collapsed).toBe(false);
    expect(editor.view.dom.querySelectorAll(".rn-folded")).toHaveLength(0);
  });

  it("keeps the collapsed state through HTML, and writes nothing for open headings", () => {
    const editor = make(doc(h(2, "Pack", true), p("jackets"), h(2, "Route")));
    const html = editor.getHTML();
    expect(html).toContain('<h2 data-collapsed="true">Pack</h2>');
    expect(html).toContain("<h2>Route</h2>");
    expect(make(html).state.doc.child(0).attrs.collapsed).toBe(true);
  });

  it("only offers to fold headings with something under them", () => {
    const editor = make(doc(h(1, "Trip"), h(2, "Pack"), p("jackets"), h(2, "Route")));
    const toggles = [...editor.view.dom.querySelectorAll(".rn-fold")].map((t) => t.parentElement?.textContent);
    expect(toggles).toEqual(["Trip", "Pack"]);
  });

  it("opens the section the cursor moves into", () => {
    const editor = make(doc(h(2, "Pack", true), p("jackets")));
    editor.commands.setTextSelection(posOf(editor, 1) + 2);
    expect(editor.state.doc.child(0).attrs.collapsed).toBe(false);
  });

  it("does not hand the collapsed state to the second half of a split heading", () => {
    const editor = make(doc(h(2, "Pack list", true), p("jackets")));
    editor.commands.setTextSelection(5);
    editor.view.dom.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(editor.state.doc.child(1).textContent).toBe(" list");
    expect(editor.state.doc.child(0).attrs.collapsed).toBe(true);
    expect(editor.state.doc.child(1).attrs.collapsed).toBe(false);
  });
});

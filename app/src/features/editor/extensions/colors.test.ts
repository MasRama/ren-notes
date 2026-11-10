import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import { noteExtensions } from "./index";

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

const marksOf = (editor: Editor) => editor.getJSON().content?.[0].content?.[0].marks;

describe("text highlights", () => {
  it("highlights the selection in purple, the Mac's first colour", () => {
    const editor = make("<p>remember this</p>");
    editor.chain().setTextSelection({ from: 1, to: 9 }).toggleHighlight().run();
    expect(marksOf(editor)).toEqual([{ type: "highlight", attrs: { color: "purple" } }]);
  });

  it("changes the colour of a highlight and removes it again", () => {
    const editor = make("<p>remember this</p>");
    editor.chain().setTextSelection({ from: 1, to: 9 }).setHighlight("mint").run();
    expect(marksOf(editor)).toEqual([{ type: "highlight", attrs: { color: "mint" } }]);
    expect(editor.isActive("highlight", { color: "mint" })).toBe(true);
    editor.chain().setTextSelection({ from: 1, to: 9 }).unsetHighlight().run();
    expect(marksOf(editor)).toBeUndefined();
  });

  it("keeps the colour through HTML", () => {
    const editor = make("<p>remember this</p>");
    editor.chain().setTextSelection({ from: 1, to: 9 }).setHighlight("orange").run();
    const html = editor.getHTML();
    expect(html).toContain('<mark data-color="orange">remember</mark>');
    expect(marksOf(make(html))).toEqual([{ type: "highlight", attrs: { color: "orange" } }]);
  });

  it("reads a highlight of an unknown colour as purple", () => {
    expect(marksOf(make("<p><mark>pasted</mark></p>"))).toEqual([{ type: "highlight", attrs: { color: "purple" } }]);
    expect(marksOf(make('<p><mark data-color="teal">pasted</mark></p>'))).toEqual([
      { type: "highlight", attrs: { color: "purple" } },
    ]);
  });
});

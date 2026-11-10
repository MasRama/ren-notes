import { afterEach, describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import { noteExtensions } from "./index";

const editors: Editor[] = [];
function make(content: object | string) {
  const opened: string[] = [];
  const editor = new Editor({
    extensions: noteExtensions({
      attachmentUrl: (id) => `renotes://localhost/attachment/${id}`,
      openAttachment: (id) => opened.push(id),
      toggleChecked: () => false,
    }),
    content,
  });
  editors.push(editor);
  return { editor, opened };
}
afterEach(() => editors.splice(0).forEach((e) => e.destroy()));

describe("note schema", () => {
  it("applies the Mac paragraph styles", () => {
    const { editor } = make("<p>hello</p>");
    editor.commands.setTextStyle("title");
    expect(editor.getJSON().content?.[0]).toMatchObject({ type: "heading", attrs: { level: 1 } });
    editor.commands.setTextStyle("monospaced");
    expect(editor.getJSON().content?.[0].type).toBe("codeBlock");
    editor.commands.setTextStyle("body");
    expect(editor.getJSON().content?.[0].type).toBe("paragraph");
  });

  it("cycles a paragraph through dashed and plain lists", () => {
    const { editor } = make("<p>item</p>");
    editor.commands.toggleDashedList();
    expect(editor.getJSON().content?.[0]).toMatchObject({ type: "bulletList", attrs: { dashed: true } });
    expect(editor.getHTML()).toContain('data-style="dash"');
    editor.commands.toggleDashedList();
    expect(editor.getJSON().content?.[0].type).toBe("paragraph");
  });

  it("serves pictures by attachment id", () => {
    const { editor } = make({
      type: "doc",
      content: [{ type: "image", attrs: { attachmentId: "abc", size: "small" } }],
    });
    const html = editor.getHTML();
    expect(html).toContain('src="renotes://localhost/attachment/abc"');
    expect(html).toContain('data-size="small"');
  });

  it("keeps file attachments as cards that round-trip through HTML", () => {
    const attrs = { id: "f1", fileName: "report.pdf", mime: "application/pdf", byteSize: 2048 };
    const { editor } = make({ type: "doc", content: [{ type: "attachment", attrs }] });
    const again = make(editor.getHTML()).editor;
    expect(again.getJSON().content?.[0]).toMatchObject({ type: "attachment", attrs });
  });

  it("inserts a 3×3 table", () => {
    const { editor } = make("<p></p>");
    editor.commands.insertNoteTable();
    const table = editor.getJSON().content?.find((n) => n.type === "table") as JSONContent | undefined;
    expect(table?.content).toHaveLength(3);
    expect(table?.content?.[0].content).toHaveLength(3);
  });
});

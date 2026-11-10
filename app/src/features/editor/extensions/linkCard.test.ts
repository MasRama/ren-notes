import { afterEach, describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import { noteExtensions } from "./index";
import { pastedUrl } from "./linkCard";

const editors: Editor[] = [];
const opened: string[] = [];
function make(content: object | string) {
  const editor = new Editor({
    extensions: noteExtensions({
      attachmentUrl: (id) => `renotes://localhost/attachment/${id}`,
      openAttachment: () => {},
      openLink: (url) => opened.push(url),
      toggleChecked: () => false,
    }),
    content,
  });
  editors.push(editor);
  return editor;
}
afterEach(() => {
  editors.splice(0).forEach((e) => e.destroy());
  opened.length = 0;
});

const URL_ = "https://example.com/trip";
const preview = { url: URL_, title: "Weekend in Lembang", site: "Example", imageId: "pic1" };
const linked = (text: string): JSONContent => ({
  type: "paragraph",
  content: [{ type: "text", text, marks: [{ type: "link", attrs: { href: text } }] }],
});
const p = (text: string): JSONContent => ({ type: "paragraph", content: [{ type: "text", text }] });
const doc = (...content: JSONContent[]) => ({ type: "doc", content });

describe("pastedUrl", () => {
  it("takes a web address pasted on its own", () => {
    expect(pastedUrl("  https://example.com/trip?x=1 \n")).toBe("https://example.com/trip?x=1");
    expect(pastedUrl("http://example.com")).toBe("http://example.com");
  });
  it("leaves text, other schemes and several words alone", () => {
    expect(pastedUrl("see https://example.com")).toBeNull();
    expect(pastedUrl("https://a.com https://b.com")).toBeNull();
    expect(pastedUrl("file:///etc/passwd")).toBeNull();
    expect(pastedUrl("javascript:alert(1)")).toBeNull();
    expect(pastedUrl("https://")).toBeNull();
  });
});

describe("link cards", () => {
  it("turn the line holding a pasted address into a card", () => {
    const editor = make(doc(p("Ideas"), linked(URL_), p("after")));
    expect(editor.commands.showLinkPreview(preview)).toBe(true);
    expect(editor.getJSON().content?.map((n) => n.type)).toEqual(["paragraph", "linkCard", "paragraph"]);
    expect(editor.getJSON().content?.[1].attrs).toEqual(preview);
  });

  it("leave the line alone once it holds more than the address", () => {
    const editor = make(doc(p(`${URL_} is where we stay`)));
    expect(editor.commands.showLinkPreview(preview)).toBe(false);
    expect(editor.getJSON().content?.[0].type).toBe("paragraph");
  });

  it("show the title, the site and the picture, and open the page on click", () => {
    const editor = make(doc({ type: "linkCard", attrs: preview }));
    const card = editor.view.dom.querySelector(".rn-link-card")!;
    expect(card.querySelector(".rn-link-title")?.textContent).toBe("Weekend in Lembang");
    expect(card.querySelector(".rn-link-site")?.textContent).toBe("Example");
    expect(card.querySelector("img")?.getAttribute("src")).toBe("renotes://localhost/attachment/pic1");
    card.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(opened).toEqual([URL_]);
  });

  it("go back to a plain link", () => {
    const editor = make(doc(p("Ideas"), { type: "linkCard", attrs: preview }));
    editor.commands.showAsLink(editor.state.doc.child(0).nodeSize);
    expect(editor.getJSON().content?.[1]).toMatchObject(linked(URL_));
  });

  it("round-trip through HTML", () => {
    const editor = make(doc({ type: "linkCard", attrs: preview }));
    const again = make(editor.getHTML());
    expect(again.getJSON().content?.[0]).toEqual({ type: "linkCard", attrs: preview });
  });
});

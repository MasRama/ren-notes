import { afterEach, describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import { noteExtensions, type EditorOptions } from "./index";
import { linkTrigger, titleMatches, type NoteLinkQuery } from "./noteLink";

const editors: Editor[] = [];
function make(content: object | string, options: Partial<EditorOptions> = {}) {
  const editor = new Editor({
    extensions: noteExtensions({
      attachmentUrl: () => "",
      openAttachment: () => {},
      toggleChecked: () => false,
      ...options,
    }),
    content,
  });
  editors.push(editor);
  return editor;
}
afterEach(() => editors.splice(0).forEach((e) => e.destroy()));

const p = (...content: JSONContent[]): JSONContent => ({ type: "paragraph", content });
const t = (text: string): JSONContent => ({ type: "text", text });
const link = (id: string, title: string): JSONContent => ({ type: "noteLink", attrs: { id, title } });
const doc = (...content: JSONContent[]) => ({ type: "doc", content });

function typeAtEnd(editor: Editor, text: string) {
  editor.commands.focus("end");
  for (const ch of text) editor.commands.insertContent(ch);
}

describe("linkTrigger", () => {
  it("finds >> and the words typed after it, up to the cursor", () => {
    const editor = make(doc(p(t("See >>trip bud"))));
    editor.commands.focus("end");
    const end = editor.state.selection.from;
    expect(linkTrigger(editor.state)).toEqual({ from: end - ">>trip bud".length, to: end, text: "trip bud" });
  });
  it("is not there without >>, after a line break in the query, or in code", () => {
    const plain = make(doc(p(t("a > b"))));
    plain.commands.focus("end");
    expect(linkTrigger(plain.state)).toBeNull();
    const code = make(doc({ type: "codeBlock", content: [t("x >>y")] }));
    code.commands.focus("end");
    expect(linkTrigger(code.state)).toBeNull();
  });
});

describe("titleMatches", () => {
  it("matches titles by what is typed, ignoring case, accents and punctuation", () => {
    expect(titleMatches("Wi-Fi at the studio", "wif")).toBe(true);
    expect(titleMatches("Café notes", "cafe n")).toBe(true);
    expect(titleMatches("Trip budget", "")).toBe(true);
    expect(titleMatches("Trip budget", "plan")).toBe(false);
  });
});

describe("NoteLink", () => {
  it("tells the picker what is typed after >>, and when it is gone", () => {
    const seen: (NoteLinkQuery | null)[] = [];
    const editor = make(doc(p(t("Plan "))), { noteLinks: { onQuery: (q) => seen.push(q) } });
    typeAtEnd(editor, ">>tr");
    expect(seen.filter(Boolean).at(-1)?.text).toBe("tr");
    editor.commands.insertContent(" ");
    editor.commands.setTextSelection(1);
    expect(seen.at(-1)).toBeNull();
  });

  it("puts the chosen note in place of >> and what followed it", () => {
    const editor = make(doc(p(t("Plan "))));
    typeAtEnd(editor, ">>tri");
    const q = linkTrigger(editor.state)!;
    editor.commands.insertNoteLink({ id: "n1", title: "Trip budget" }, q);
    expect(editor.getJSON().content?.[0].content).toEqual([
      t("Plan "),
      link("n1", "Trip budget"),
      t(" "),
    ]);
    expect(editor.getText()).toBe("Plan Trip budget ");
  });

  it("shows the linked note's current title and opens it on click", () => {
    const opened: string[] = [];
    const editor = make(doc(p(t("See "), link("n1", "Old title"))), {
      noteLinks: { noteTitle: (id) => (id === "n1" ? "Trip budget" : undefined), openNote: (id) => opened.push(id) },
    });
    const el = editor.view.dom.querySelector<HTMLElement>(".rn-note-link")!;
    expect(el.textContent).toBe("Trip budget");
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(opened).toEqual(["n1"]);
  });

  it("keeps the stored title, dimmed, for a note that is gone", () => {
    const editor = make(doc(p(link("gone", "Old plan"))), { noteLinks: { noteTitle: () => undefined } });
    const el = editor.view.dom.querySelector<HTMLElement>(".rn-note-link")!;
    expect(el.textContent).toBe("Old plan");
    expect(el.classList.contains("missing")).toBe(true);
  });

  it("round-trips through HTML", () => {
    const editor = make(doc(p(link("n1", "Trip budget"))));
    const html = editor.getHTML();
    const again = make(html);
    expect(again.getJSON().content?.[0].content).toEqual([link("n1", "Trip budget")]);
  });
});

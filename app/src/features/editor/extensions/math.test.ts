import { afterEach, describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import { noteExtensions } from "./index";
import { evaluate, formatNumber, solveLines } from "./math";

describe("evaluate", () => {
  const none = new Map<string, number>();
  it("follows the usual order of operations", () => {
    expect(evaluate("2 + 3 * 4", none)).toBe(14);
    expect(evaluate("(2 + 3) * 4", none)).toBe(20);
    expect(evaluate("2 ^ 3 ^ 2", none)).toBe(512);
    expect(evaluate("-2 ^ 2", none)).toBe(-4);
    expect(evaluate("10 / 4", none)).toBe(2.5);
    expect(evaluate("7 × 6 ÷ 3", none)).toBe(14);
  });
  it("reads percentages, functions and variables", () => {
    expect(evaluate("200 * 15%", none)).toBe(30);
    expect(evaluate("sqrt(16) + abs(-2)", none)).toBe(6);
    expect(evaluate("rent * 2", new Map([["rent", 500]]))).toBe(1000);
  });
  it("gives nothing for what is not a sum", () => {
    expect(evaluate("2 +", none)).toBeNull();
    expect(evaluate("lunch + 2", none)).toBeNull();
    expect(evaluate("1 / 0", none)).toBeNull();
    expect(evaluate("", none)).toBeNull();
    expect(evaluate("2 3", none)).toBeNull();
  });
});

describe("formatNumber", () => {
  it("groups thousands and drops float noise", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatNumber(0.1 + 0.2)).toBe("0.3");
    expect(formatNumber(-2.5)).toBe("-2.5");
  });
});

describe("solveLines", () => {
  it("answers a line ending in =, after the words before the sum", () => {
    expect(solveLines(["12 * 3 =", "Total: 5 + 3 =", "just words"])).toEqual([36, 8, null]);
  });
  it("carries variables down the note", () => {
    expect(solveLines(["rent = 500", "food = 120 * 4", "rent + food =", "x = rent / 2 ="])).toEqual([
      null,
      null,
      980,
      250,
    ]);
  });
  it("leaves a plain number or an unknown word alone", () => {
    expect(solveLines(["Meeting at 10 =", "Weekend ="])).toEqual([null, null]);
  });
  it("uses only variables set above the line", () => {
    expect(solveLines(["a + 1 =", "a = 2"])).toEqual([null, null]);
  });
});

const editors: Editor[] = [];
function make(content: object) {
  const editor = new Editor({
    extensions: noteExtensions({ attachmentUrl: () => "", openAttachment: () => {}, toggleChecked: () => false }),
    content,
  });
  editors.push(editor);
  return editor;
}
afterEach(() => editors.splice(0).forEach((e) => e.destroy()));
const p = (text: string): JSONContent => ({ type: "paragraph", content: [{ type: "text", text }] });

describe("MathResults", () => {
  it("shows each answer right after its = without putting it in the note", () => {
    const editor = make({ type: "doc", content: [p("price = 20"), p("price * 3 ="), p("hello")] });
    const results = [...editor.view.dom.querySelectorAll(".rn-math-result")];
    expect(results.map((r) => r.getAttribute("data-result"))).toEqual(["60"]);
    expect(results[0].textContent).toBe("=");
    expect(editor.getText()).not.toContain("60");
  });
  it("puts no uneditable node in the line, so the caret moves through it freely", () => {
    const editor = make({ type: "doc", content: [p("1 + 2 =")] });
    expect(editor.view.dom.querySelector("[contenteditable=false]")).toBeNull();
  });
  it("updates as the sum is typed", () => {
    const editor = make({ type: "doc", content: [p("2 + 2")] });
    expect(editor.view.dom.querySelector(".rn-math-result")).toBeNull();
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, " =");
    expect(editor.view.dom.querySelector(".rn-math-result")?.getAttribute("data-result")).toBe("4");
  });
  it("leaves code alone", () => {
    const editor = make({
      type: "doc",
      content: [{ type: "codeBlock", content: [{ type: "text", text: "1 + 1 =" }] }],
    });
    expect(editor.view.dom.querySelector(".rn-math-result")).toBeNull();
  });
});

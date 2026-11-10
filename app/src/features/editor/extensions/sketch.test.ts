import { afterEach, describe, expect, it } from "vitest";
import { Editor, type JSONContent } from "@tiptap/core";
import { noteExtensions, type EditorOptions } from "./index";
import { addPoint, eraseAt, strokePath, toCanvas, SKETCH_WIDTH, type Stroke } from "./sketch";

const line = (...points: number[]): Stroke => ({ tool: "pen", color: "ink", points });

describe("strokePath", () => {
  it("draws a tap as a dot, two points as a line, more as a smooth curve", () => {
    expect(strokePath([10, 20])).toBe("M10 20l0.01 0");
    expect(strokePath([10, 20, 30, 40])).toBe("M10 20L30 40");
    expect(strokePath([0, 0, 10, 10, 20, 0, 30, 10])).toBe("M0 0Q10 10 15 5Q20 0 25 5L30 10");
  });
});

describe("addPoint", () => {
  it("rounds points and skips ones too close to the last", () => {
    const points: number[] = [];
    addPoint(points, 10.04, 20.06);
    addPoint(points, 10.3, 20.2);
    addPoint(points, 14, 20);
    expect(points).toEqual([10, 20.1, 14, 20]);
  });
});

describe("eraseAt", () => {
  it("removes whole strokes the eraser touches, as the Mac's object eraser does", () => {
    const strokes = [line(0, 0, 100, 0), line(0, 50, 100, 50), line(200, 200)];
    expect(eraseAt(strokes, 50, 4, 6)).toEqual([strokes[1], strokes[2]]);
    expect(eraseAt(strokes, 203, 203, 6)).toEqual([strokes[0], strokes[1]]);
    expect(eraseAt(strokes, 50, 25, 6)).toBe(strokes);
  });
});

describe("toCanvas", () => {
  it("maps a pointer to the drawing's own units", () => {
    const rect = { left: 100, top: 50, width: 500, height: 250 };
    expect(toCanvas(350, 175, rect)).toEqual({ x: SKETCH_WIDTH / 2, y: 250 });
  });
});

const editors: Editor[] = [];
function make(content: object | string, options: Partial<EditorOptions> = {}) {
  const editor = new Editor({
    extensions: noteExtensions({ attachmentUrl: () => "", openAttachment: () => {}, toggleChecked: () => false, ...options }),
    content,
  });
  editors.push(editor);
  return editor;
}
afterEach(() => editors.splice(0).forEach((e) => e.destroy()));
const sketch = (strokes: Stroke[]): JSONContent => ({ type: "sketch", attrs: { strokes, height: 500 } });
const doc = (...content: JSONContent[]) => ({ type: "doc", content });

describe("Sketch", () => {
  it("draws its strokes in the note and opens for drawing on click", () => {
    const opened: number[] = [];
    const editor = make(doc(sketch([line(0, 0, 50, 50), { tool: "marker", color: "yellow", points: [5, 5, 60, 5] }])), {
      editSketch: (pos) => opened.push(pos),
    });
    const paths = [...editor.view.dom.querySelectorAll(".rn-sketch path")];
    expect(paths.map((p) => p.getAttribute("class"))).toEqual(["pen ink", "marker yellow"]);
    editor.view.dom.querySelector(".rn-sketch")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(opened).toEqual([0]);
  });

  it("puts a new empty drawing in and selects it", () => {
    const editor = make(doc({ type: "paragraph", content: [{ type: "text", text: "Plan" }] }));
    editor.commands.focus("end");
    expect(editor.commands.insertSketch()).toBe(true);
    const { selection } = editor.state;
    expect(editor.state.doc.nodeAt(selection.from)?.type.name).toBe("sketch");
  });

  it("redraws when its strokes change", () => {
    const editor = make(doc(sketch([])));
    expect(editor.view.dom.querySelectorAll(".rn-sketch path")).toHaveLength(0);
    editor.commands.setSketch(0, [line(1, 1, 9, 9)]);
    expect(editor.view.dom.querySelectorAll(".rn-sketch path")).toHaveLength(1);
  });

  it("round-trips through HTML", () => {
    const strokes = [line(1, 2, 3, 4)];
    const editor = make(doc(sketch(strokes)));
    const again = make(editor.getHTML());
    expect(again.getJSON().content?.[0]).toEqual(sketch(strokes));
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { sortChecklistAt, toggleCheckedAt } from "./checklist";

let editor: Editor | null = null;
afterEach(() => editor?.destroy());

function make(items: [string, boolean][]) {
  editor = new Editor({
    extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true })],
    content: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "List" }] },
        {
          type: "taskList",
          content: items.map(([text, checked]) => ({
            type: "taskItem",
            attrs: { checked },
            content: [{ type: "paragraph", content: [{ type: "text", text }] }],
          })),
        },
      ],
    },
  });
  return editor;
}

function items(e: Editor): string[] {
  const out: string[] = [];
  e.state.doc.descendants((node) => {
    if (node.type.name === "taskItem") out.push(`${node.attrs.checked ? "x" : " "} ${node.textContent}`);
  });
  return out;
}

/** Position inside the n-th task item's text. */
function posOf(e: Editor, n: number): number {
  let seen = -1;
  let found = -1;
  e.state.doc.descendants((node, pos) => {
    if (node.type.name === "taskItem" && ++seen === n) found = pos + 2;
  });
  return found;
}

describe("checklists", () => {
  it("moves checked items below unchecked ones, keeping order", () => {
    const e = make([
      ["a", true],
      ["b", false],
      ["c", true],
      ["d", false],
    ]);
    expect(sortChecklistAt(e.view, posOf(e, 0))).toBe(true);
    expect(items(e)).toEqual(["  b", "  d", "x a", "x c"]);
  });

  it("does nothing when already in order", () => {
    const e = make([
      ["a", false],
      ["b", true],
    ]);
    expect(sortChecklistAt(e.view, posOf(e, 0))).toBe(false);
    expect(sortChecklistAt(e.view, 1)).toBe(false);
  });

  it("toggling an item checks it and can sort the list", () => {
    const e = make([
      ["a", false],
      ["b", false],
    ]);
    expect(toggleCheckedAt(e.view, posOf(e, 0), true)).toBe(true);
    expect(items(e)).toEqual(["  b", "x a"]);
    expect(toggleCheckedAt(e.view, posOf(e, 1), false)).toBe(true);
    expect(items(e)).toEqual(["  b", "  a"]);
  });

  it("undoes a check and its move in one step", () => {
    const e = make([
      ["a", false],
      ["b", false],
    ]);
    toggleCheckedAt(e.view, posOf(e, 0), true);
    e.commands.undo();
    expect(items(e)).toEqual(["  a", "  b"]);
  });
});

describe("SinkChecked", () => {
  async function withSink(enabled: boolean, list: [string, boolean][]) {
    const { SinkChecked } = await import("./checklist");
    editor = new Editor({
      extensions: [StarterKit, TaskList, TaskItem.configure({ nested: true }), SinkChecked.configure({ enabled: () => enabled })],
      content: {
        type: "doc",
        content: [
          {
            type: "taskList",
            content: list.map(([text, checked]) => ({
              type: "taskItem",
              attrs: { checked },
              content: [{ type: "paragraph", content: [{ type: "text", text }] }],
            })),
          },
        ],
      },
    });
    return editor;
  }

  function checkFirst(e: Editor) {
    let at = -1;
    e.state.doc.descendants((node, pos) => {
      if (at < 0 && node.type.name === "taskItem") at = pos;
    });
    const node = e.state.doc.nodeAt(at)!;
    e.view.dispatch(e.state.tr.setNodeMarkup(at, undefined, { ...node.attrs, checked: true }));
  }

  it("moves an item checked by a click below the unchecked ones, in one undo step", async () => {
    const e = await withSink(true, [["milk", false], ["eggs", false], ["done", true]]);
    checkFirst(e);
    expect(items(e)).toEqual(["  eggs", "x milk", "x done"]);
    e.commands.undo();
    expect(items(e)).toEqual(["  milk", "  eggs", "x done"]);
  });

  it("leaves the order alone when the setting is off", async () => {
    const e = await withSink(false, [["milk", false], ["eggs", false]]);
    checkFirst(e);
    expect(items(e)).toEqual(["x milk", "  eggs"]);
  });
});

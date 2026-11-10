import { describe, expect, it } from "vitest";
import { deriveFields } from "./derive";

const p = (text?: string) => ({ type: "paragraph", content: text ? [{ type: "text", text }] : undefined });

describe("deriveFields", () => {
  it("title is the first non-empty line, snippet the lines after it", () => {
    const doc = {
      type: "doc",
      content: [
        p(),
        { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: "  Trip  " }] },
        p("Pack "),
        p(),
        p("bags"),
      ],
    };
    const fields = deriveFields(doc);
    expect(fields.title).toBe("Trip");
    expect(fields.snippet).toBe("Pack bags");
    expect(fields.plainText).toBe("\n  Trip  \nPack \n\nbags");
    expect(fields.hasChecklist).toBe(false);
    expect(fields.attachmentIds).toEqual([]);
  });

  it("finds checklists, hard breaks, tables and attachments", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "a" }, { type: "hardBreak" }, { type: "text", text: "b" }] },
        {
          type: "taskList",
          content: [{ type: "taskItem", attrs: { checked: false }, content: [p("milk")] }],
        },
        { type: "image", attrs: { attachmentId: "img1" } },
        { type: "attachment", attrs: { id: "file1", fileName: "x.pdf" } },
        { type: "image", attrs: { attachmentId: "img1" } },
        {
          type: "table",
          content: [{ type: "tableRow", content: [{ type: "tableCell", content: [p("cell")] }] }],
        },
      ],
    };
    const fields = deriveFields(doc);
    expect(fields.title).toBe("a");
    expect(fields.snippet).toBe("b milk cell");
    expect(fields.plainText).toBe("a\nb\nmilk\ncell");
    expect(fields.hasChecklist).toBe(true);
    expect(fields.attachmentIds).toEqual(["img1", "file1"]);
  });

  it("an empty document has nothing", () => {
    expect(deriveFields({ type: "doc", content: [p()] })).toEqual({
      title: "",
      snippet: "",
      plainText: "",
      hasChecklist: false,
      attachmentIds: [],
    });
  });
});

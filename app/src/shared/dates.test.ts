import { describe, expect, it } from "vitest";
import { editorDate, groupNotes, listTime } from "./dates";
import type { NoteSummary } from "./ipc/types";

const now = new Date(2026, 10, 10, 17, 41).getTime(); // 10 Nov 2026, 17:41 local

function note(id: string, updated: Date, pinned = false): NoteSummary {
  return {
    id,
    folderId: "notes",
    title: id,
    snippet: "",
    firstImageId: null,
    pinned,
    hasChecklist: false,
    hasAttachment: false,
    createdAt: updated.getTime(),
    updatedAt: updated.getTime(),
    deletedAt: null,
  };
}

describe("groupNotes", () => {
  it("groups like the Mac: pinned, recent days, months, then years", () => {
    const notes = [
      note("pin", new Date(2020, 0, 1), true),
      note("today", new Date(2026, 10, 10, 0, 5)),
      note("yesterday", new Date(2026, 10, 9, 23, 59)),
      note("week", new Date(2026, 10, 4)),
      note("month", new Date(2026, 9, 15)),
      note("september", new Date(2026, 8, 30)),
      note("old", new Date(2025, 11, 31)),
    ];
    const groups = groupNotes(notes, { now, by: "updatedAt", byDate: true });
    expect(groups.map((g) => [g.label, g.notes.map((n) => n.id)])).toEqual([
      ["Pinned", ["pin"]],
      ["Today", ["today"]],
      ["Yesterday", ["yesterday"]],
      ["Previous 7 Days", ["week"]],
      ["Previous 30 Days", ["month"]],
      ["September", ["september"]],
      ["2025", ["old"]],
    ]);
  });

  it("without date groups keeps pinned apart and the rest as Notes", () => {
    const notes = [note("a", new Date(2026, 1, 1)), note("p", new Date(2026, 1, 2), true)];
    const groups = groupNotes(notes, { now, by: "updatedAt", byDate: false });
    expect(groups.map((g) => [g.label, g.notes.map((n) => n.id)])).toEqual([
      ["Pinned", ["p"]],
      ["Notes", ["a"]],
    ]);
  });

  it("leaves out empty groups", () => {
    expect(groupNotes([], { now, by: "updatedAt", byDate: true })).toEqual([]);
  });
});

describe("listTime", () => {
  it("shows the time today, Yesterday, a weekday this week, else the date", () => {
    expect(listTime(new Date(2026, 10, 10, 9, 5).getTime(), now, "en-GB")).toBe("9:05");
    expect(listTime(new Date(2026, 10, 9, 9, 5).getTime(), now, "en-GB")).toBe("Yesterday");
    expect(listTime(new Date(2026, 10, 5, 9, 5).getTime(), now, "en-GB")).toBe("Thursday");
    expect(listTime(new Date(2026, 9, 1).getTime(), now, "en-GB")).toBe("01/10/2026");
  });
});

describe("editorDate", () => {
  it("reads like the Mac's header", () => {
    expect(editorDate(now, "en-GB")).toBe("10 November 2026 at 17:41");
  });
});

import { describe, expect, it } from "vitest";
import { highlightParts } from "./actions";

describe("highlightParts", () => {
  it("marks searched word prefixes and keeps the rest", () => {
    expect(highlightParts("Grocery list for Monday", ["groc", "mon"])).toEqual([
      { text: "Groc", match: true },
      { text: "ery list for ", match: false },
      { text: "Mon", match: true },
      { text: "day", match: false },
    ]);
  });

  it("is the whole text when nothing is searched", () => {
    expect(highlightParts("plain", [])).toEqual([{ text: "plain", match: false }]);
  });
});

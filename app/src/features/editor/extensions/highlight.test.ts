import { describe, expect, it } from "vitest";
import { findMatches } from "./highlight";

describe("findMatches", () => {
  it("finds every term, ignoring case and accents, as word prefixes", () => {
    expect(findMatches("Café and cafeteria; the CAFE", ["cafe"])).toEqual([
      { from: 0, to: 4 },
      { from: 9, to: 13 },
      { from: 24, to: 28 },
    ]);
  });
  it("only at the start of words", () => {
    expect(findMatches("decafe", ["cafe"])).toEqual([]);
  });
  it("merges several terms in text order", () => {
    expect(findMatches("buy milk eggs", ["eggs", "milk"])).toEqual([
      { from: 4, to: 8 },
      { from: 9, to: 13 },
    ]);
  });
  it("no terms, no matches", () => {
    expect(findMatches("anything", [])).toEqual([]);
  });
});

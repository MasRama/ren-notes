import { describe, expect, it } from "vitest";
import { findTags, parseTags } from "./tags";

// The same cases as the core's parse_tags: both sides must agree.
describe("parseTags", () => {
  it("keeps each tag once, lowercased", () => {
    expect(parseTags("Plan #Work and #work later")).toEqual(["work"]);
  });
  it("takes dashes, underscores and Unicode letters", () => {
    expect(parseTags("#ide-baru #to_do #ünïcode")).toEqual(["ide-baru", "to_do", "ünïcode"]);
  });
  it("ignores # inside words and bare hashes", () => {
    expect(parseTags("a#b x.com/#anchor ## #")).toEqual([]);
  });
  it("needs a letter", () => {
    expect(parseTags("#123 #2026plan")).toEqual(["2026plan"]);
  });
  it("drops trailing punctuation", () => {
    expect(parseTags("ends #work, and #home.")).toEqual(["work", "home"]);
    expect(parseTags("#draft- #wip_")).toEqual(["draft", "wip"]);
  });
  it("starts after brackets and quotes", () => {
    expect(parseTags('(#paren) "#quote"')).toEqual(["paren", "quote"]);
  });
});

describe("findTags", () => {
  it("gives the range of each tag including the #", () => {
    expect(findTags("hi #work, #x1")).toEqual([
      { from: 3, to: 8, tag: "work" },
      { from: 10, to: 13, tag: "x1" },
    ]);
  });
});

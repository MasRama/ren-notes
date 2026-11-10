import { describe, expect, it } from "vitest";
import type { Folder } from "../../shared/ipc/types";
import { flattenFolders, subtree } from "./tree";

const f = (id: string, parentId: string | null, sortIndex: number, isDefault = false): Folder => ({
  id,
  parentId,
  name: id,
  sortIndex,
  noteCount: 0,
  isDefault,
});

const folders = [f("work", null, 1), f("notes", null, 5, true), f("b", "work", 1), f("a", "work", 0), f("deep", "a", 0)];

describe("flattenFolders", () => {
  it("lists Notes first, then folders depth first in their order", () => {
    expect(flattenFolders(folders, []).map((n) => `${n.depth}${n.folder.id}`)).toEqual(["0notes", "0work", "1a", "2deep", "1b"]);
  });

  it("hides what is inside a collapsed folder", () => {
    const rows = flattenFolders(folders, ["work"]);
    expect(rows.map((n) => n.folder.id)).toEqual(["notes", "work"]);
    expect(rows[1].hasChildren).toBe(true);
  });
});

describe("subtree", () => {
  it("is a folder and all folders inside it", () => {
    expect([...subtree(folders, "work")].sort()).toEqual(["a", "b", "deep", "work"]);
  });
});

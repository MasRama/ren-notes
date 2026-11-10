import { describe, expect, it } from "vitest";
import { shortcut } from "./keyboard";

const key = (k: string, mods: Partial<Record<"ctrl" | "shift" | "alt" | "meta", boolean>> = {}) => ({
  key: k,
  ctrlKey: !!mods.ctrl,
  shiftKey: !!mods.shift,
  altKey: !!mods.alt,
  metaKey: !!mods.meta,
});

describe("shortcut", () => {
  it("maps the Mac's Notes commands with Ctrl for Cmd", () => {
    expect(shortcut(key("n", { ctrl: true }))).toBe("newNote");
    expect(shortcut(key("N", { ctrl: true, shift: true }))).toBe("newFolder");
    expect(shortcut(key("f", { ctrl: true }))).toBe("search");
    expect(shortcut(key("f", { ctrl: true, alt: true }))).toBe("findInNote");
    expect(shortcut(key("s", { ctrl: true, alt: true }))).toBe("toggleSidebar");
    expect(shortcut(key("1", { ctrl: true }))).toBe("listView");
    expect(shortcut(key("2", { ctrl: true }))).toBe("galleryView");
  });

  it("leaves plain typing and editor shortcuts alone", () => {
    expect(shortcut(key("n"))).toBeNull();
    expect(shortcut(key("b", { ctrl: true }))).toBeNull();
    expect(shortcut(key("t", { ctrl: true, shift: true }))).toBeNull();
    expect(shortcut(key("n", { ctrl: true, meta: true }))).toBeNull();
  });
});

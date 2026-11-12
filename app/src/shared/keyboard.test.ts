import { describe, expect, it } from "vitest";
import { browserKey, inDialog, shortcut } from "./keyboard";

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

  it("lets AltGr type, though Windows reports it as Ctrl+Alt", () => {
    const altGr = { ...key("s", { ctrl: true, alt: true }), getModifierState: (m: string) => m === "AltGraph" };
    expect(shortcut(altGr)).toBeNull();
  });
});

describe("browserKey", () => {
  it("catches reload and print", () => {
    expect(browserKey(key("F5"))).toBe(true);
    expect(browserKey(key("r", { ctrl: true }))).toBe(true);
    expect(browserKey(key("R", { ctrl: true, shift: true }))).toBe(true);
    expect(browserKey(key("p", { ctrl: true }))).toBe(true);
  });

  it("leaves typing alone", () => {
    expect(browserKey(key("r"))).toBe(false);
    expect(browserKey(key("p", { shift: true }))).toBe(false);
    expect(browserKey(key("r", { ctrl: true, alt: true }))).toBe(false);
  });
});

describe("inDialog", () => {
  it("tells keys typed in a dialog from keys typed in the panes", () => {
    document.body.innerHTML = `
      <form role="dialog"><input id="a" /></form>
      <div role="alertdialog"><button id="b"></button></div>
      <div class="list"><input id="c" /></div>`;
    const at = (id: string) => document.getElementById(id);
    expect(inDialog(at("a"))).toBe(true);
    expect(inDialog(at("b"))).toBe(true);
    expect(inDialog(at("c"))).toBe(false);
    expect(inDialog(window)).toBe(false);
    expect(inDialog(null)).toBe(false);
  });
});

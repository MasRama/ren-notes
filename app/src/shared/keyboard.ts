/** App-wide commands; editor formatting keys live in the editor. */
export type Command =
  | "newNote"
  | "newFolder"
  | "search"
  | "findInNote"
  | "toggleSidebar"
  | "listView"
  | "galleryView";

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
}

const MAP: Record<string, Command> = {
  "ctrl+n": "newNote",
  "ctrl+shift+n": "newFolder",
  "ctrl+f": "search",
  "ctrl+alt+f": "findInNote",
  "ctrl+alt+s": "toggleSidebar",
  "ctrl+1": "listView",
  "ctrl+2": "galleryView",
};

/** The command for a key press, with Ctrl in place of the Mac's Cmd. */
export function shortcut(e: KeyLike): Command | null {
  if (!e.ctrlKey || e.metaKey) return null;
  const parts = ["ctrl"];
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  parts.push(e.key.toLowerCase());
  return MAP[parts.join("+")] ?? null;
}

/** Whether a key was typed inside a dialog or sheet, which keeps its own
 * keys (Tab moves between its fields, not between the panes). */
export function inDialog(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('[role="dialog"], [role="alertdialog"]');
}

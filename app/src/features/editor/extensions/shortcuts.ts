import { Extension } from "@tiptap/core";

export type TextStyle = "title" | "heading" | "subheading" | "body" | "monospaced";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    noteStyles: {
      /** One of the Mac's paragraph styles. */
      setTextStyle: (style: TextStyle) => ReturnType;
      /** A 3×3 table, like the Mac's Table button. */
      insertNoteTable: () => ReturnType;
    };
  }
}

export interface ShortcutOptions {
  /** Toggle the checklist item at the selection (wired by the editor). */
  toggleChecked: () => boolean;
}

/** The Mac's Notes shortcuts, with Ctrl in place of Cmd. */
export const NoteShortcuts = Extension.create<ShortcutOptions>({
  name: "noteShortcuts",
  addOptions() {
    return { toggleChecked: () => false };
  },
  addCommands() {
    return {
      setTextStyle:
        (style) =>
        ({ chain }) => {
          const c = chain().focus();
          switch (style) {
            case "title":
              return c.setHeading({ level: 1 }).run();
            case "heading":
              return c.setHeading({ level: 2 }).run();
            case "subheading":
              return c.setHeading({ level: 3 }).run();
            case "monospaced":
              return c.setCodeBlock().run();
            default:
              return c.setParagraph().run();
          }
        },
      insertNoteTable:
        () =>
        ({ chain }) =>
          chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: false }).run(),
    };
  },
  addKeyboardShortcuts() {
    return {
      "Mod-Shift-t": () => this.editor.commands.setTextStyle("title"),
      "Mod-Shift-h": () => this.editor.commands.setTextStyle("heading"),
      "Mod-Shift-j": () => this.editor.commands.setTextStyle("subheading"),
      "Mod-Shift-b": () => this.editor.commands.setTextStyle("body"),
      "Mod-Shift-m": () => this.editor.commands.setTextStyle("monospaced"),
      "Mod-Shift-l": () => this.editor.chain().focus().toggleTaskList().run(),
      "Mod-Shift-u": () => this.options.toggleChecked(),
      "Mod-Alt-t": () => this.editor.commands.insertNoteTable(),
      "Mod-Shift-7": () => this.editor.chain().focus().toggleBulletList().run(),
      "Mod-Shift-8": () => this.editor.chain().focus().toggleDashedList().run(),
      "Mod-Shift-9": () => this.editor.chain().focus().toggleOrderedList().run(),
      "Mod-'": () => this.editor.chain().focus().toggleBlockquote().run(),
    };
  },
});

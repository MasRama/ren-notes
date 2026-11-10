import { Mark, mergeAttributes } from "@tiptap/core";

/** The Mac's highlight colours, in the order its Format menu lists them. */
export const HIGHLIGHT_COLORS = ["purple", "pink", "orange", "mint", "blue"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

const isColor = (c: unknown): c is HighlightColor => HIGHLIGHT_COLORS.includes(c as HighlightColor);

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    highlight: {
      /** Highlights the selection in this colour. */
      setHighlight: (color: HighlightColor) => ReturnType;
      /** Highlights the selection, purple unless a colour is given, or removes it. */
      toggleHighlight: (color?: HighlightColor) => ReturnType;
      unsetHighlight: () => ReturnType;
    };
  }
}

/** Coloured text on a tint of the same colour, as on the Mac. Stored as
 * `<mark data-color>`; any other `<mark>` reads as purple. */
export const NoteHighlight = Mark.create({
  name: "highlight",
  addAttributes() {
    return {
      color: {
        default: "purple",
        parseHTML: (el) => {
          const color = el.getAttribute("data-color");
          return isColor(color) ? color : "purple";
        },
        renderHTML: (attrs) => ({ "data-color": isColor(attrs.color) ? attrs.color : "purple" }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "mark" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["mark", mergeAttributes(HTMLAttributes), 0];
  },
  addCommands() {
    return {
      setHighlight:
        (color) =>
        ({ commands }) =>
          commands.setMark(this.name, { color }),
      toggleHighlight:
        (color = "purple") =>
        ({ commands }) =>
          commands.toggleMark(this.name, { color }),
      unsetHighlight:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
    };
  },
  addKeyboardShortcuts() {
    return { "Mod-Shift-e": () => this.editor.commands.toggleHighlight() };
  },
});

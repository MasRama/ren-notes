import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

/** Set on transactions that only fold or unfold, which are not edits: they
 * stay out of the undo history and leave the note's edit time alone. */
export const FOLD_META = "noteFold";

/** Whether these transactions changed nothing but folds. */
export const onlyFolds = (trs: readonly Transaction[]) =>
  trs.filter((tr) => tr.docChanged).every((tr) => tr.getMeta(FOLD_META));

/** The top-level blocks a collapsed heading hides, each mapped to the index
 * of the heading hiding it. A section runs to the next heading as big or
 * bigger, as on the Mac. */
export function foldedBlocks(doc: PMNode): Map<number, number> {
  const hidden = new Map<number, number>();
  let fold: { index: number; level: number } | null = null;
  doc.forEach((node, _offset, index) => {
    const level = node.type.name === "heading" ? (node.attrs.level as number) : null;
    if (fold && (level === null || level > fold.level)) {
      hidden.set(index, fold.index);
      return;
    }
    fold = level !== null && node.attrs.collapsed ? { index, level } : null;
  });
  return hidden;
}

/** Whether the heading at this index has a section to fold. */
function hasSection(doc: PMNode, index: number): boolean {
  const next = index + 1 < doc.childCount ? doc.child(index + 1) : null;
  if (!next) return false;
  return next.type.name !== "heading" || next.attrs.level > doc.child(index).attrs.level;
}

function startOf(doc: PMNode, index: number): number {
  let pos = 0;
  for (let i = 0; i < index; i++) pos += doc.child(i).nodeSize;
  return pos;
}

function toggle(collapsed: boolean): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "rn-fold";
  button.tabIndex = -1;
  button.contentEditable = "false";
  button.setAttribute("aria-expanded", String(!collapsed));
  button.setAttribute("aria-label", collapsed ? "Expand section" : "Collapse section");
  return button;
}

function decorate(doc: PMNode): DecorationSet {
  const hidden = foldedBlocks(doc);
  const decorations: Decoration[] = [];
  let pos = 0;
  doc.forEach((node, _offset, index) => {
    if (hidden.has(index)) {
      decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: "rn-folded" }));
    } else if (node.type.name === "heading" && hasSection(doc, index)) {
      const collapsed = !!node.attrs.collapsed;
      if (collapsed) decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: "rn-collapsed" }));
      decorations.push(
        Decoration.widget(pos + 1, () => toggle(collapsed), {
          side: -1,
          ignoreSelection: true,
          key: `fold-${collapsed}`,
        }),
      );
    }
    pos += node.nodeSize;
  });
  return DecorationSet.create(doc, decorations);
}

function setFold(tr: Transaction, pos: number, collapsed: boolean): Transaction {
  return tr.setNodeAttribute(pos, "collapsed", collapsed).setMeta(FOLD_META, true).setMeta("addToHistory", false);
}

/** Opens whatever hides an empty selection, folds inside folds included. */
function revealSelection(state: EditorState): Transaction | null {
  const { selection } = state;
  if (!selection.empty) return null;
  const index = state.doc.resolve(selection.from).index(0);
  let tr: Transaction | null = null;
  for (;;) {
    const doc = tr?.doc ?? state.doc;
    const heading = foldedBlocks(doc).get(index);
    if (heading === undefined) return tr;
    tr = setFold(tr ?? state.tr, startOf(doc, heading), false);
  }
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    noteFolding: {
      /** Collapses or expands the top-level heading starting at `pos`. */
      toggleFold: (pos: number) => ReturnType;
    };
  }
}

const key = new PluginKey<DecorationSet>("noteFolding");

/** Headings whose sections fold away, as on the Mac: a chevron beside the
 * heading collapses everything up to the next heading as big or bigger. The
 * note keeps the folds; the cursor landing in a folded section opens it. */
export const HeadingFolding = Extension.create({
  name: "noteFolding",
  addGlobalAttributes() {
    return [
      {
        types: ["heading"],
        attributes: {
          collapsed: {
            default: false,
            keepOnSplit: false,
            parseHTML: (el) => el.getAttribute("data-collapsed") === "true",
            renderHTML: (attrs) => (attrs.collapsed ? { "data-collapsed": "true" } : {}),
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      toggleFold:
        (pos) =>
        ({ state, tr, dispatch }) => {
          const node = state.doc.nodeAt(pos);
          if (node?.type.name !== "heading") return false;
          if (dispatch) setFold(tr, pos, !node.attrs.collapsed);
          return true;
        },
    };
  },
  addKeyboardShortcuts() {
    return {
      // Split mid-line, a heading hands its attributes to both halves; only
      // the first keeps its fold, so the text after the cursor stays in view.
      Enter: ({ editor }) => {
        const { $from } = editor.state.selection;
        if ($from.depth !== 1 || !$from.parent.attrs.collapsed || $from.parentOffset === 0) return false;
        return editor
          .chain()
          .splitBlock()
          .command(({ tr }) => {
            const $after = tr.selection.$from;
            if ($after.depth === 1 && $after.parent.attrs.collapsed) {
              setFold(tr, $after.before(1), false);
            }
            return true;
          })
          .run();
      },
    };
  },
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      new Plugin({
        key,
        state: {
          init: (_, state) => decorate(state.doc),
          apply: (tr, old, _o, state) => (tr.docChanged ? decorate(state.doc) : old),
        },
        props: {
          decorations: (state) => key.getState(state),
          handleDOMEvents: {
            mousedown(view: EditorView, event: MouseEvent) {
              const button = (event.target as HTMLElement).closest?.(".rn-fold");
              if (!button) return false;
              event.preventDefault();
              const pos = view.state.doc.resolve(view.posAtDOM(button, 0)).before(1);
              editor.commands.toggleFold(pos);
              return true;
            },
          },
        },
        appendTransaction: (trs, _old, state) =>
          trs.some((tr) => tr.selectionSet || tr.docChanged) ? revealSelection(state) : null,
      }),
    ];
  },
});

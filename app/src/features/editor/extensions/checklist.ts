import { Extension } from "@tiptap/core";
import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

function ancestor(doc: PMNode, pos: number, type: string): { node: PMNode; pos: number } | null {
  if (pos < 0 || pos > doc.content.size) return null;
  const $pos = doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (node.type.name === type) return { node, pos: $pos.before(depth) };
  }
  return null;
}

/** Reorders the checklist around `pos` in `tr`: unchecked items first, then
 * checked ones, each keeping its order. Returns whether anything moved. */
function sortInTr(tr: Transaction, pos: number): boolean {
  const list = ancestor(tr.doc, pos, "taskList");
  if (!list) return false;
  const children: PMNode[] = [];
  list.node.forEach((child) => children.push(child));
  const sorted = [
    ...children.filter((c) => !c.attrs.checked),
    ...children.filter((c) => c.attrs.checked),
  ];
  if (sorted.every((child, i) => child === children[i])) return false;
  tr.replaceWith(list.pos + 1, list.pos + list.node.nodeSize - 1, Fragment.fromArray(sorted));
  return true;
}

/** Moves checked items of the checklist at `pos` to its bottom. */
export function sortChecklistAt(view: EditorView, pos: number): boolean {
  const tr = view.state.tr;
  if (!sortInTr(tr, pos)) return false;
  view.dispatch(tr);
  return true;
}

/** Checks or unchecks the checklist item at `pos`; with `sort`, a checked
 * item also moves below the unchecked ones. One undo step for both. */
export function toggleCheckedAt(view: EditorView, pos: number, sort: boolean): boolean {
  const item = ancestor(view.state.doc, pos, "taskItem");
  if (!item) return false;
  const tr = view.state.tr.setNodeMarkup(item.pos, undefined, {
    ...item.node.attrs,
    checked: !item.node.attrs.checked,
  });
  if (sort) sortInTr(tr, item.pos + 1);
  view.dispatch(tr);
  return true;
}

/** Checked items sink below the unchecked ones however they got checked
 * (a click on the box, a shortcut), in the same undo step. */
export const SinkChecked = Extension.create<{ enabled: () => boolean }>({
  name: "sinkChecked",
  addOptions() {
    return { enabled: () => true };
  },
  addProseMirrorPlugins() {
    const enabled = () => this.options.enabled();
    return [
      new Plugin({
        key: new PluginKey("sinkChecked"),
        appendTransaction(transactions, oldState, newState) {
          if (!enabled() || !transactions.some((t) => t.docChanged)) return null;
          const back = transactions.map((t) => t.mapping);
          const justChecked: number[] = [];
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== "taskItem" || !node.attrs.checked) return;
            let old = pos;
            for (let i = back.length - 1; i >= 0; i--) old = back[i].invert().map(old, 1);
            const before = oldState.doc.nodeAt(old);
            if (before?.type.name === "taskItem" && !before.attrs.checked) justChecked.push(pos);
          });
          if (!justChecked.length) return null;
          const tr = newState.tr;
          // Last first, so earlier positions stay valid.
          for (const pos of justChecked.reverse()) sortInTr(tr, tr.mapping.map(pos) + 1);
          return tr.docChanged ? tr : null;
        },
      }),
    ];
  },
});

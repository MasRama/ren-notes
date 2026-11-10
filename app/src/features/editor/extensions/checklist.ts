import { Fragment, type Node as PMNode } from "@tiptap/pm/model";
import type { Transaction } from "@tiptap/pm/state";
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

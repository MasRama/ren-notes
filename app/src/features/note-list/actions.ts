import type { Store } from "../../app/store";
import { DEFAULT_FOLDER_ID, type NoteSummary } from "../../shared/ipc/types";
import { confirmDialog } from "../../shared/ui/dialog";
import { openMenu, type MenuItem } from "../../shared/ui/menu";
import { findMatches } from "../editor/extensions/highlight";
import { lockNote, removeLock } from "../locks/flow";

/** Deletes a note; one already in Recently Deleted is gone for good, so ask. */
export async function deleteNote(store: Store, note: NoteSummary): Promise<void> {
  if (note.deletedAt !== null) {
    const ok = await confirmDialog({
      title: "Delete this note for good?",
      message: "You can’t undo this.",
      confirm: "Delete",
      danger: true,
    });
    if (!ok) return;
  }
  await store.deleteNote(note.id);
}

export async function emptyTrash(store: Store): Promise<void> {
  const ok = await confirmDialog({
    title: "Delete all notes in Recently Deleted?",
    message: "You can’t undo this.",
    confirm: "Delete All",
    danger: true,
  });
  if (ok) await store.emptyTrash();
}

export function noteMenu(e: MouseEvent, store: Store, note: NoteSummary): void {
  if (note.deletedAt !== null) {
    openMenu(e, [
      { label: "Recover", action: () => void store.recover(note.id) },
      { separator: true },
      { label: "Delete for Good", danger: true, action: () => void deleteNote(store, note) },
    ]);
    return;
  }
  const folders = store.state.folders
    .filter((f) => f.id !== note.folderId)
    .sort((a, b) => Number(b.id === DEFAULT_FOLDER_ID) - Number(a.id === DEFAULT_FOLDER_ID) || a.name.localeCompare(b.name));
  const moves: MenuItem[] = folders.map((f) => ({
    label: `Move to “${f.name}”`,
    action: () => void store.moveNote(note.id, f.id),
  }));
  openMenu(e, [
    { label: note.pinned ? "Unpin Note" : "Pin Note", action: () => void store.setPinned(note.id, !note.pinned) },
    note.locked
      ? { label: "Remove Lock", action: () => void removeLock(store, note) }
      : { label: "Lock Note", action: () => void lockNote(store, note) },
    { separator: true },
    ...moves,
    ...(moves.length ? [{ separator: true } as MenuItem] : []),
    { label: "Delete", shortcut: "Delete", danger: true, action: () => void deleteNote(store, note) },
  ]);
}

export interface Part {
  text: string;
  match: boolean;
}

/** Text cut into plain and matching parts, for search highlighting. */
export function highlightParts(text: string, terms: string[]): Part[] {
  if (!terms.length) return [{ text, match: false }];
  const out: Part[] = [];
  let at = 0;
  for (const r of findMatches(text, terms)) {
    if (r.from > at) out.push({ text: text.slice(at, r.from), match: false });
    out.push({ text: text.slice(r.from, r.to), match: true });
    at = r.to;
  }
  if (at < text.length) out.push({ text: text.slice(at), match: false });
  return out;
}

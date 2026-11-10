import type { Store } from "../../app/store";
import { groupNotes, type NoteGroup } from "../../shared/dates";

/** The list's sections: search results as Top Hits and the rest; Recently
 * Deleted in one section; otherwise by date like the Mac. */
export function listGroups(store: Store, now: number): NoteGroup[] {
  const s = store.state;
  if (s.query) {
    if (s.notes.length <= 3) return s.notes.length ? [{ label: "Top Hits", notes: s.notes }] : [];
    return [
      { label: "Top Hits", notes: s.notes.slice(0, 3) },
      { label: "Notes", notes: s.notes.slice(3) },
    ];
  }
  if (s.source.kind === "trash") return s.notes.length ? [{ label: "", notes: s.notes }] : [];
  const sort = store.sort;
  return groupNotes(s.notes, {
    now,
    by: sort === "created" ? "createdAt" : "updatedAt",
    byDate: s.groupByDate && sort !== "title",
  });
}

import type { NoteSummary } from "./ipc/types";

export interface NoteGroup {
  label: string;
  notes: NoteSummary[];
}

export interface GroupOptions {
  now: number;
  /** Which time the list is sorted and grouped by. */
  by: "updatedAt" | "createdAt";
  /** Off: one "Notes" group (pinned notes still apart). */
  byDate: boolean;
  locale?: string;
}

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole calendar days between the day of `ms` and the day of `now`. */
function daysAgo(ms: number, now: number): number {
  return Math.round((startOfDay(now) - startOfDay(ms)) / DAY);
}

function groupLabel(ms: number, now: number, locale?: string): string {
  const days = daysAgo(ms, now);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days <= 7) return "Previous 7 Days";
  if (days <= 30) return "Previous 30 Days";
  const date = new Date(ms);
  if (date.getFullYear() === new Date(now).getFullYear()) {
    return date.toLocaleString(locale ?? "en-GB", { month: "long" });
  }
  return String(date.getFullYear());
}

/** Sections of a note list, in list order, the way Notes on the Mac shows them. */
export function groupNotes(notes: NoteSummary[], options: GroupOptions): NoteGroup[] {
  const groups: NoteGroup[] = [];
  const push = (label: string, note: NoteSummary) => {
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.notes.push(note);
    else groups.push({ label, notes: [note] });
  };
  for (const n of notes.filter((n) => n.pinned)) push("Pinned", n);
  for (const n of notes.filter((n) => !n.pinned)) {
    push(options.byDate ? groupLabel(n[options.by], options.now, options.locale) : "Notes", n);
  }
  return groups;
}

/** The time shown in a list row: clock time today, then Yesterday, a weekday
 * within the week, and the date beyond. */
export function listTime(ms: number, now: number, locale?: string): string {
  const days = daysAgo(ms, now);
  const date = new Date(ms);
  if (days <= 0) return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return date.toLocaleDateString(locale ?? "en-GB", { weekday: "long" });
  return date.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** The grey line at the top of the editor: "10 November 2026 at 17:41". */
export function editorDate(ms: number, locale?: string): string {
  const date = new Date(ms);
  const day = date.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  const time = date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return `${day} at ${time}`;
}

/** Drag payloads between the list and the sidebar. */
export const NOTE_TYPE = "application/x-renotes-note";
export const FOLDER_TYPE = "application/x-renotes-folder";

export type DropZone = "before" | "into" | "after";

/** Where over a row a drop lands: its top or bottom quarter places beside
 * it, the middle drops into it. */
export function dropZone(e: DragEvent, el: HTMLElement, canNest = true): DropZone {
  const r = el.getBoundingClientRect();
  const y = (e.clientY - r.top) / r.height;
  if (!canNest) return y < 0.5 ? "before" : "after";
  return y < 0.25 ? "before" : y > 0.75 ? "after" : "into";
}

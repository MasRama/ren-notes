import { shallowReactive } from "vue";
import type { Store } from "../../app/store";
import type { NoteSummary } from "../../shared/ipc/types";
import type { MenuItem } from "../../shared/ui/menu";

export interface PasswordValues {
  /** The password being replaced, when changing it. */
  old: string;
  password: string;
  verify: string;
  hint: string;
}

/** The password sheet's one request: create the notes password, type it,
 * or change it. */
export interface PasswordRequest {
  mode: "create" | "enter" | "change";
  /** Tries what was typed: an error to show, or null when it worked. */
  submit: (values: PasswordValues) => Promise<string | null>;
  /** Closes the sheet; `ok` says whether locked notes are now open. */
  done: (ok: boolean) => void;
}

export const passwordSheet = shallowReactive({ request: null as PasswordRequest | null });

function ask(mode: PasswordRequest["mode"], tryValues: PasswordRequest["submit"]): Promise<boolean> {
  passwordSheet.request?.done(false);
  return new Promise((resolve) => {
    const request: PasswordRequest = {
      mode,
      submit: async (values) => {
        const error = await tryValues(values);
        if (!error) request.done(true);
        return error;
      },
      done: (ok) => {
        if (passwordSheet.request === request) passwordSheet.request = null;
        resolve(ok);
      },
    };
    passwordSheet.request = request;
  });
}

/** Makes sure locked notes are open: asks for a new password the first
 * time, or for the password while they are closed. False when cancelled. */
export function openLockedNotes(store: Store): Promise<boolean> {
  const locks = store.state.locks;
  if (locks.open) return Promise.resolve(true);
  if (!locks.hasPassword) {
    return ask("create", async ({ password, verify, hint }) => {
      if (!password) return "Enter a password.";
      if (password !== verify) return "The passwords don’t match.";
      await store.setNotesPassword(password, hint);
      return null;
    });
  }
  return ask("enter", async ({ password }) => {
    if (await store.openLocked(password)) return null;
    return locks.hint ? `Wrong password. Hint: ${locks.hint}` : "Wrong password.";
  });
}

/** Asks for the old password and a new one. False when cancelled. */
export function changePassword(store: Store): Promise<boolean> {
  return ask("change", async ({ old, password, verify, hint }) => {
    if (!password) return "Enter a new password.";
    if (password !== verify) return "The passwords don’t match.";
    if (await store.changeNotesPassword(old, password, hint)) return null;
    return "The old password is wrong.";
  });
}

export async function lockNote(store: Store, note: NoteSummary): Promise<void> {
  if (await openLockedNotes(store)) await store.lockNote(note.id);
}

export async function removeLock(store: Store, note: NoteSummary): Promise<void> {
  if (await openLockedNotes(store)) await store.removeLock(note.id);
}

/** The lock's menu items for a note, as in the toolbar and the list. */
export function lockMenu(store: Store, note: NoteSummary): MenuItem[] {
  const items: MenuItem[] = [
    note.locked
      ? { label: "Remove Lock", action: () => void removeLock(store, note) }
      : { label: "Lock Note", action: () => void lockNote(store, note) },
  ];
  const { hasPassword, open } = store.state.locks;
  if (!hasPassword) return items;
  items.push({ separator: true });
  if (open) items.push({ label: "Close All Locked Notes", action: () => void store.closeLocked() });
  items.push({ label: "Change Password…", action: () => void changePassword(store) });
  return items;
}

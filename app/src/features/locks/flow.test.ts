import { beforeEach, describe, expect, it } from "vitest";
import { Store } from "../../app/store";
import { MemoryApi } from "../../shared/ipc/memory";
import { DEFAULT_FOLDER_ID } from "../../shared/ipc/types";
import type { PasswordValues } from "./flow";
import { changePassword, lockMenu, lockNote, passwordSheet, removeLock } from "./flow";

let mem: MemoryApi;
let store: Store;
let id: string;

beforeEach(async () => {
  passwordSheet.request?.done(false);
  mem = new MemoryApi();
  id = (await mem.notesCreate(DEFAULT_FOLDER_ID)).id;
  await mem.notesSave(id, { docJson: "{}", title: "Bank", snippet: "", plainText: "Bank", hasChecklist: false, attachmentIds: [] });
  store = new Store(mem);
  await store.init();
});

const tick = () => new Promise((r) => setTimeout(r, 0));
const note = () => store.state.notes.find((n) => n.id === id)!;
const values = (v: Partial<PasswordValues>): PasswordValues => ({ old: "", password: "", verify: "", hint: "", ...v });

describe("locking a note", () => {
  it("asks for a new password the first time, checking it was typed twice", async () => {
    const done = lockNote(store, note());
    await tick();
    const request = passwordSheet.request!;
    expect(request.mode).toBe("create");
    expect(await request.submit(values({ password: "", verify: "", hint: "" }))).toBe("Enter a password.");
    expect(await request.submit(values({ password: "hunter2", verify: "hunter3", hint: "" }))).toBe(
      "The passwords don’t match.",
    );
    expect(await request.submit(values({ password: "hunter2", verify: "hunter2", hint: "usual" }))).toBeNull();
    await done;
    expect(passwordSheet.request).toBeNull();
    expect(note().locked).toBe(true);
    expect(store.state.locks).toEqual({ hasPassword: true, hint: "usual", open: true });
  });

  it("asks for the password while locked notes are closed, and stays open on a wrong one", async () => {
    await mem.locksSetPassword("hunter2", "usual");
    await mem.locksClose();
    await store.refreshLocks();
    const done = lockNote(store, note());
    await tick();
    const request = passwordSheet.request!;
    expect(request.mode).toBe("enter");
    expect(await request.submit(values({ password: "nope", verify: "", hint: "" }))).toBe("Wrong password. Hint: usual");
    expect(await request.submit(values({ password: "hunter2", verify: "", hint: "" }))).toBeNull();
    await done;
    expect(note().locked).toBe(true);
  });

  it("leaves the note as it was when the sheet is cancelled", async () => {
    const done = lockNote(store, note());
    await tick();
    passwordSheet.request!.done(false);
    await done;
    expect(note().locked).toBe(false);
    expect(store.state.locks.hasPassword).toBe(false);
  });

  it("locks and unlocks at once while locked notes are open", async () => {
    await store.setNotesPassword("hunter2", "");
    await lockNote(store, note());
    expect(note().locked).toBe(true);
    await removeLock(store, note());
    expect(note().locked).toBe(false);
    expect(passwordSheet.request).toBeNull();
  });
});

describe("changing the password", () => {
  it("checks the old password and the new one typed twice, then opens with the new one", async () => {
    await store.setNotesPassword("hunter2", "old hint");
    await store.lockNote(id);
    await store.closeLocked();
    const done = changePassword(store);
    await tick();
    const request = passwordSheet.request!;
    expect(request.mode).toBe("change");
    expect(await request.submit(values({ old: "nope", password: "new", verify: "new" }))).toBe(
      "The old password is wrong.",
    );
    expect(await request.submit(values({ old: "hunter2", password: "", verify: "" }))).toBe("Enter a new password.");
    expect(await request.submit(values({ old: "hunter2", password: "new", verify: "nwe" }))).toBe(
      "The passwords don’t match.",
    );
    expect(await request.submit(values({ old: "hunter2", password: "new", verify: "new", hint: "fresh" }))).toBeNull();
    expect(await done).toBe(true);
    expect(store.state.locks).toEqual({ hasPassword: true, hint: "fresh", open: true });
    await store.closeLocked();
    expect(await store.openLocked("hunter2")).toBe(false);
    expect(await store.openLocked("new")).toBe(true);
  });
});

describe("lockMenu", () => {
  const labels = () => lockMenu(store, note()).map((i) => ("label" in i ? i.label : "—"));

  it("offers what fits the note and whether locked notes are open", async () => {
    expect(labels()).toEqual(["Lock Note"]);
    await store.setNotesPassword("hunter2", "");
    expect(labels()).toEqual(["Lock Note", "—", "Close All Locked Notes", "Change Password…"]);
    await store.lockNote(id);
    expect(labels()).toEqual(["Remove Lock", "—", "Close All Locked Notes", "Change Password…"]);
    await store.closeLocked();
    expect(labels()).toEqual(["Remove Lock", "—", "Change Password…"]);
  });
});

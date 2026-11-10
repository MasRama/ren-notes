import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Store } from "../../app/store";
import { MemoryApi } from "../../shared/ipc/memory";
import { closeWhenIdle } from "./autoLock";

const MINUTE = 60_000;
let store: Store;
let stop: () => void;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 10, 11, 9));
  store = new Store(new MemoryApi());
  await store.init();
  await store.setNotesPassword("hunter2", "");
  stop = closeWhenIdle(store, window);
});
afterEach(() => {
  stop();
  vi.useRealTimers();
});

/** Lets time pass, then lets the close that it set off finish. */
async function wait(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
}
const typed = () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));

describe("closeWhenIdle", () => {
  it("closes locked notes once nothing has been typed or clicked for the set time", async () => {
    await wait(14 * MINUTE);
    expect(store.state.locks.open).toBe(true);
    typed();
    await wait(14 * MINUTE);
    expect(store.state.locks.open).toBe(true);
    await wait(2 * MINUTE);
    expect(store.state.locks.open).toBe(false);
  });

  it("counts time asleep, so locked notes are closed on waking", async () => {
    vi.setSystemTime(Date.now() + 3 * 60 * MINUTE);
    await wait(MINUTE);
    expect(store.state.locks.open).toBe(false);
  });

  it("counts from the moment they were opened", async () => {
    await store.closeLocked();
    await wait(60 * MINUTE);
    await store.openLocked("hunter2");
    await wait(MINUTE);
    expect(store.state.locks.open).toBe(true);
  });

  it("follows a new time, and never closes them when set to Never", async () => {
    store.setLockAfter(5);
    await wait(6 * MINUTE);
    expect(store.state.locks.open).toBe(false);
    await store.openLocked("hunter2");
    store.setLockAfter(0);
    await wait(10 * 60 * MINUTE);
    expect(store.state.locks.open).toBe(true);
  });

  it("stops watching when stopped", async () => {
    stop();
    await wait(60 * MINUTE);
    expect(store.state.locks.open).toBe(true);
  });
});

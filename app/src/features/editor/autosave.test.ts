import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Autosave } from "./autosave";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("Autosave", () => {
  it("saves once, 300ms after the last change", async () => {
    const saves: string[] = [];
    let text = "a";
    const a = new Autosave({ delay: 300, save: async () => void saves.push(text) });
    a.changed();
    await vi.advanceTimersByTimeAsync(200);
    text = "ab";
    a.changed();
    await vi.advanceTimersByTimeAsync(299);
    expect(saves).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(saves).toEqual(["ab"]);
  });

  it("flush saves a pending change at once and nothing when clean", async () => {
    const save = vi.fn(async () => {});
    const a = new Autosave({ delay: 300, save });
    await a.flush();
    expect(save).not.toHaveBeenCalled();
    a.changed();
    await a.flush();
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("keeps the change and retries after a failed save", async () => {
    let fail = true;
    const errors: unknown[] = [];
    let recovered = 0;
    const save = vi.fn(async () => {
      if (fail) throw new Error("disk full");
    });
    const a = new Autosave({
      delay: 300,
      retry: 2000,
      save,
      onError: (e) => errors.push(e),
      onRecovered: () => recovered++,
    });
    a.changed();
    await vi.advanceTimersByTimeAsync(300);
    expect(errors).toHaveLength(1);
    expect(a.dirty).toBe(true);
    fail = false;
    await vi.advanceTimersByTimeAsync(2000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(a.dirty).toBe(false);
    expect(recovered).toBe(1);
  });

  it("a change during a save is saved again afterwards", async () => {
    let release!: () => void;
    const save = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(() => new Promise<void>((r) => (release = r)))
      .mockResolvedValue(undefined);
    const a = new Autosave({ delay: 300, save });
    a.changed();
    await vi.advanceTimersByTimeAsync(300);
    a.changed();
    release();
    await a.flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(a.dirty).toBe(false);
  });
});

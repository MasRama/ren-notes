import { watch } from "vue";
import type { Store } from "../../app/store";

/** What counts as someone using the app. */
const ACTIVITY = ["keydown", "pointerdown", "pointermove", "wheel"] as const;
/** How often the idle time is looked at. */
const CHECK_EVERY = 15_000;

/** Closes locked notes once nothing has been typed or clicked for the
 * store's `lockAfter` minutes. Time is read from the wall clock, so time
 * spent asleep counts and locked notes are closed on waking. Returns the
 * function that stops watching. */
export function closeWhenIdle(store: Store, target: EventTarget): () => void {
  let last = Date.now();
  const seen = () => (last = Date.now());
  for (const type of ACTIVITY) target.addEventListener(type, seen, { capture: true, passive: true });
  const stopOpen = watch(
    () => store.state.locks.open,
    (open) => open && seen(),
  );
  const timer = setInterval(() => {
    const { locks, lockAfter } = store.state;
    if (locks.open && lockAfter > 0 && Date.now() - last >= lockAfter * 60_000) void store.closeLocked();
  }, CHECK_EVERY);
  return () => {
    clearInterval(timer);
    stopOpen();
    for (const type of ACTIVITY) target.removeEventListener(type, seen, { capture: true });
  };
}

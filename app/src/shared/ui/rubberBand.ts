import type { Directive } from "vue";

/** Quiet time after the last wheel event before the content springs back. */
const RELEASE_AFTER = 120;
/** How stiff the band is; the Mac's scroll views use 0.55. */
const STIFFNESS = 0.55;

/** How far content moves when pulled `pull` px past an edge of a pane
 * `size` px tall: almost one to one at first, less and less after, and
 * never as far as the pane itself. */
export function stretch(pull: number, size: number): number {
  const moved = (1 - 1 / ((Math.abs(pull) * STIFFNESS) / size + 1)) * size;
  return pull < 0 ? -moved : moved;
}

export interface RubberBandOptions {
  reducedMotion?: () => boolean;
}

const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Lets a scroller's content stretch past its top and bottom and spring
 * back, as scroll views do on the Mac; WebKitGTK has no such bounce. The
 * offset goes in `--rubber` for the content to follow (see theme.css).
 * Returns a function that detaches it. */
export function attachRubberBand(el: HTMLElement, options: RubberBandOptions = {}): () => void {
  const reducedMotion = options.reducedMotion ?? prefersReducedMotion;
  // Positive: pulled down past the top; negative: up past the bottom.
  let pull = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const show = () => {
    if (pull === 0) el.style.removeProperty("--rubber");
    else el.style.setProperty("--rubber", `${stretch(pull, el.clientHeight || 1)}px`);
  };
  const release = () => {
    timer = null;
    pull = 0;
    el.classList.add("rubber-release");
    show();
  };

  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.deltaX !== 0 || reducedMotion()) return;
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * el.clientHeight : e.deltaY;
    if (!dy) return;
    if (pull === 0) {
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if (!((dy < 0 && atTop) || (dy > 0 && atBottom))) return;
      pull = -dy;
    } else {
      // Scrolling back first gives back the stretch, and stops at rest.
      const next = pull - dy;
      pull = Math.sign(next) === Math.sign(pull) ? next : 0;
      e.preventDefault();
    }
    el.classList.remove("rubber-release");
    show();
    if (timer) clearTimeout(timer);
    timer = pull === 0 ? null : setTimeout(release, RELEASE_AFTER);
  };

  el.dataset.rubber = "";
  el.addEventListener("wheel", onWheel, { passive: false });
  return () => {
    if (timer) clearTimeout(timer);
    el.removeEventListener("wheel", onWheel);
    el.style.removeProperty("--rubber");
    delete el.dataset.rubber;
  };
}

const attached = new WeakMap<HTMLElement, () => void>();

/** `v-rubber-band` on a scroller. */
export const vRubberBand: Directive<HTMLElement> = {
  mounted: (el) => void attached.set(el, attachRubberBand(el)),
  beforeUnmount: (el) => attached.get(el)?.(),
};

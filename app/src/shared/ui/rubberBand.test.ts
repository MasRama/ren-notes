import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachRubberBand, stretch } from "./rubberBand";

describe("stretch", () => {
  it("gives less the further it is pulled, never reaching the pane's height", () => {
    const a = stretch(50, 600);
    const b = stretch(100, 600);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(50);
    expect(b - a).toBeLessThan(a);
    expect(stretch(1e6, 600)).toBeLessThan(600);
    expect(stretch(-50, 600)).toBe(-a);
    expect(stretch(0, 600)).toBe(0);
  });
});

function scroller(scrollTop: number) {
  const el = document.createElement("div");
  Object.defineProperties(el, {
    scrollTop: { value: scrollTop, writable: true },
    scrollHeight: { value: 2000 },
    clientHeight: { value: 600 },
  });
  document.body.append(el);
  return el;
}
const wheel = (el: HTMLElement, deltaY: number) =>
  el.dispatchEvent(new WheelEvent("wheel", { deltaY, deltaMode: 0, bubbles: true }));
const offset = (el: HTMLElement) => parseFloat(el.style.getPropertyValue("--rubber") || "0");

describe("attachRubberBand", () => {
  let detach: () => void = () => {};
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    detach();
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("pulls the content down past the top, then springs back", () => {
    const el = scroller(0);
    detach = attachRubberBand(el, { reducedMotion: () => false });
    wheel(el, -40);
    wheel(el, -40);
    expect(offset(el)).toBeCloseTo(stretch(80, 600));
    expect(el.classList.contains("rubber-release")).toBe(false);
    vi.advanceTimersByTime(200);
    expect(offset(el)).toBe(0);
    expect(el.classList.contains("rubber-release")).toBe(true);
  });

  it("pulls the content up past the bottom", () => {
    const el = scroller(1400);
    detach = attachRubberBand(el, { reducedMotion: () => false });
    wheel(el, 60);
    expect(offset(el)).toBeCloseTo(-stretch(60, 600));
  });

  it("leaves scrolling in the middle alone", () => {
    const el = scroller(500);
    detach = attachRubberBand(el, { reducedMotion: () => false });
    wheel(el, -40);
    wheel(el, 40);
    expect(offset(el)).toBe(0);
  });

  it("gives back the stretch when the scroll turns around, without overshooting", () => {
    const el = scroller(0);
    detach = attachRubberBand(el, { reducedMotion: () => false });
    wheel(el, -80);
    wheel(el, 30);
    expect(offset(el)).toBeCloseTo(stretch(50, 600));
    wheel(el, 200);
    expect(offset(el)).toBe(0);
  });

  it("does nothing when motion is reduced", () => {
    const el = scroller(0);
    detach = attachRubberBand(el, { reducedMotion: () => true });
    wheel(el, -80);
    expect(offset(el)).toBe(0);
  });
});

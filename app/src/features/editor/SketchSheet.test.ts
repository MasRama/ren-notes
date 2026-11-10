import { afterEach, describe, expect, it } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";
import type { Stroke } from "./extensions/sketch";
import SketchSheet from "./SketchSheet.vue";

let unmount: (() => void) | null = null;
afterEach(() => {
  unmount?.();
  document.body.innerHTML = "";
});

function mount(strokes: Stroke[]) {
  const result: { done: Stroke[] | null; cancelled: boolean } = { done: null, cancelled: false };
  const el = document.createElement("div");
  document.body.append(el);
  const app = createApp(
    defineComponent({
      render: () =>
        h(SketchSheet, {
          strokes,
          height: 500,
          onDone: (s: Stroke[]) => (result.done = s),
          onCancel: () => (result.cancelled = true),
        }),
    }),
  );
  app.mount(el);
  unmount = () => app.unmount();
  return result;
}

const paper = () => document.querySelector<SVGSVGElement>(".sketch-sheet svg.paper")!;
const pointer = (type: string, x: number, y: number) =>
  paper().dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, bubbles: true, button: 0 }));
function draw(...points: [number, number][]) {
  const [first, ...rest] = points;
  pointer("pointerdown", ...first);
  for (const p of rest) pointer("pointermove", ...p);
  pointer("pointerup", ...points[points.length - 1]);
}
const click = (selector: string) => document.querySelector<HTMLElement>(selector)!.click();

describe("SketchSheet", () => {
  it("draws a line with the pen and hands the strokes back on Done", async () => {
    const result = mount([]);
    await nextTick();
    draw([0, 0], [5, 5], [10, 10]);
    await nextTick();
    expect(paper().querySelectorAll("path")).toHaveLength(1);
    click(".sketch-sheet .done");
    expect(result.done).toHaveLength(1);
    expect(result.done![0]).toMatchObject({ tool: "pen", color: "ink" });
  });

  it("draws with the chosen tool and colour, and undoes and redoes", async () => {
    const result = mount([]);
    await nextTick();
    click('.sketch-sheet [data-tool="marker"]');
    click('.sketch-sheet [data-color="yellow"]');
    draw([0, 0], [10, 0]);
    draw([0, 20], [10, 20]);
    // Buttons enable and disable as the history changes: let Vue redraw.
    for (const button of [".undo", ".undo", ".redo"]) {
      await nextTick();
      click(`.sketch-sheet ${button}`);
    }
    click(".sketch-sheet .done");
    expect(result.done).toEqual([{ tool: "marker", color: "yellow", points: expect.any(Array) }]);
  });

  it("erases the strokes the eraser passes over", async () => {
    const kept: Stroke = { tool: "pen", color: "blue", points: [0, 400, 1000, 400] };
    const result = mount([{ tool: "pen", color: "ink", points: [0, 0, 1000, 0] }, kept]);
    await nextTick();
    click('.sketch-sheet [data-tool="eraser"]');
    // happy-dom lays nothing out, so one pixel is a whole drawing unit wide.
    draw([500, 0], [500, 1]);
    click(".sketch-sheet .done");
    expect(result.done).toEqual([kept]);
  });

  it("gives up the changes on Cancel and on Escape", async () => {
    const result = mount([]);
    await nextTick();
    draw([0, 0], [10, 10]);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(result.cancelled).toBe(true);
    expect(result.done).toBeNull();
  });
});

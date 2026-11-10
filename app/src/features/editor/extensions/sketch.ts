import { Node } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";

export const SKETCH_TOOLS = ["pen", "marker"] as const;
/** "ink" is the text colour: black on paper, white in the dark. */
export const SKETCH_COLORS = ["ink", "blue", "green", "yellow", "red"] as const;
export type SketchTool = (typeof SKETCH_TOOLS)[number];
export type SketchColor = (typeof SKETCH_COLORS)[number];

/** One line drawn without lifting the pointer; `points` are x, y pairs. */
export interface Stroke {
  tool: SketchTool;
  color: SketchColor;
  points: number[];
}

/** A drawing is this many units wide, whatever width it is shown at. */
export const SKETCH_WIDTH = 1000;
export const SKETCH_HEIGHT = 500;
export const STROKE_WIDTH: Record<SketchTool, number> = { pen: 4, marker: 16 };
/** Points closer than this to the last one add nothing to a line. */
const MIN_GAP = 1.5;

const round = (n: number) => Math.round(n * 10) / 10;

/** Adds a point to a line being drawn, unless it is too close to the last. */
export function addPoint(points: number[], x: number, y: number): void {
  const [rx, ry] = [round(x), round(y)];
  const n = points.length;
  if (n && Math.hypot(rx - points[n - 2], ry - points[n - 1]) < MIN_GAP) return;
  points.push(rx, ry);
}

/** SVG path data for a line, smoothed through the midpoints between its
 * points; a single point is a dot. */
export function strokePath(points: readonly number[]): string {
  const n = points.length / 2;
  if (n === 0) return "";
  if (n === 1) return `M${points[0]} ${points[1]}l0.01 0`;
  let d = `M${points[0]} ${points[1]}`;
  for (let i = 1; i < n - 1; i++) {
    const [x, y, nx, ny] = [points[2 * i], points[2 * i + 1], points[2 * i + 2], points[2 * i + 3]];
    d += `Q${x} ${y} ${round((x + nx) / 2)} ${round((y + ny) / 2)}`;
  }
  return `${d}L${points[2 * n - 2]} ${points[2 * n - 1]}`;
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const [dx, dy] = [bx - ax, by - ay];
  const length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function touches(stroke: Stroke, x: number, y: number, radius: number): boolean {
  const reach = radius + STROKE_WIDTH[stroke.tool] / 2;
  const p = stroke.points;
  if (p.length === 2) return Math.hypot(x - p[0], y - p[1]) <= reach;
  for (let i = 0; i + 3 < p.length; i += 2) {
    if (distanceToSegment(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= reach) return true;
  }
  return false;
}

/** The strokes left after the eraser touches (x, y): whole lines go, as with
 * the Mac's object eraser. The same array when nothing was touched. */
export function eraseAt(strokes: Stroke[], x: number, y: number, radius: number): Stroke[] {
  const left = strokes.filter((s) => !touches(s, x, y, radius));
  return left.length === strokes.length ? strokes : left;
}

/** A pointer position in the drawing's own units. */
export function toCanvas(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number },
): { x: number; y: number } {
  // Unlaid-out (width 0): one pixel per unit.
  const scale = SKETCH_WIDTH / (rect.width || SKETCH_WIDTH);
  return { x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale };
}

const SVG = "http://www.w3.org/2000/svg";

/** Fills `svg` with the drawing's strokes. */
export function drawStrokes(svg: SVGSVGElement, strokes: readonly Stroke[], height: number): void {
  svg.setAttribute("viewBox", `0 0 ${SKETCH_WIDTH} ${height}`);
  svg.replaceChildren(
    ...strokes.map((s) => {
      const path = document.createElementNS(SVG, "path");
      path.setAttribute("class", `${s.tool} ${s.color}`);
      path.setAttribute("d", strokePath(s.points));
      path.setAttribute("stroke-width", String(STROKE_WIDTH[s.tool]));
      return path;
    }),
  );
}

export interface SketchOptions {
  /** Opens the drawing at `pos` for drawing. */
  editSketch: (pos: number) => void;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    sketch: {
      /** Puts an empty drawing at the cursor and selects it. */
      insertSketch: () => ReturnType;
      /** Replaces the strokes of the drawing at `pos`. */
      setSketch: (pos: number, strokes: Stroke[]) => ReturnType;
    };
  }
}

/** A drawing in the note, kept as its strokes so it stays sharp and can be
 * drawn on again. Clicking it opens it for drawing. */
export const Sketch = Node.create<SketchOptions>({
  name: "sketch",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addOptions() {
    return { editSketch: () => {} };
  },
  addAttributes() {
    return {
      strokes: {
        default: [],
        parseHTML: (el) => {
          try {
            const strokes = JSON.parse(el.getAttribute("data-strokes") ?? "[]");
            return Array.isArray(strokes) ? strokes : [];
          } catch {
            return [];
          }
        },
        renderHTML: () => ({}),
      },
      height: {
        default: SKETCH_HEIGHT,
        parseHTML: (el) => Number(el.getAttribute("data-height")) || SKETCH_HEIGHT,
        renderHTML: () => ({}),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="sketch"]' }];
  },
  renderHTML({ node }) {
    return [
      "div",
      { "data-type": "sketch", "data-strokes": JSON.stringify(node.attrs.strokes), "data-height": node.attrs.height },
    ];
  },
  addNodeView() {
    return ({ node, getPos }) => {
      const dom = document.createElement("div");
      dom.className = "rn-sketch";
      dom.contentEditable = "false";
      const svg = document.createElementNS(SVG, "svg");
      svg.setAttribute("class", "rn-ink");
      dom.append(svg);
      const render = (n: typeof node) => {
        const strokes = n.attrs.strokes as Stroke[];
        drawStrokes(svg, strokes, n.attrs.height as number);
        dom.classList.toggle("empty", strokes.length === 0);
      };
      render(node);
      dom.addEventListener("click", () => {
        const pos = getPos();
        if (typeof pos === "number") this.options.editSketch(pos);
      });
      return {
        dom,
        update: (next) => {
          if (next.type !== node.type) return false;
          render(next);
          return true;
        },
        ignoreMutation: () => true,
      };
    };
  },
  addCommands() {
    return {
      insertSketch:
        () =>
        ({ tr, dispatch }) => {
          if (!dispatch) return true;
          const sketch = this.type.create();
          tr.replaceSelectionWith(sketch);
          let at = -1;
          tr.doc.descendants((n, pos) => {
            if (n === sketch) at = pos;
            return at < 0;
          });
          if (at >= 0) tr.setSelection(NodeSelection.create(tr.doc, at));
          return true;
        },
      setSketch:
        (pos, strokes) =>
        ({ state, tr, dispatch }) => {
          if (state.doc.nodeAt(pos)?.type !== this.type) return false;
          if (dispatch) tr.setNodeAttribute(pos, "strokes", strokes);
          return true;
        },
    };
  },
});

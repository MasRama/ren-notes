<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import Icon from "../../shared/ui/Icon.vue";
import {
  addPoint,
  eraseAt,
  strokePath,
  toCanvas,
  SKETCH_COLORS,
  SKETCH_WIDTH,
  STROKE_WIDTH,
  type SketchColor,
  type Stroke,
} from "./extensions/sketch";

const props = defineProps<{ strokes: Stroke[]; height: number }>();
const emit = defineEmits<{ done: [strokes: Stroke[]]; cancel: [] }>();

type Tool = "pen" | "marker" | "eraser";
const TOOLS: { id: Tool; label: string }[] = [
  { id: "pen", label: "Pen" },
  { id: "marker", label: "Marker" },
  { id: "eraser", label: "Eraser" },
];
/** How far the eraser reaches, in drawing units. */
const ERASER_RADIUS = 12;

const tool = ref<Tool>("pen");
const color = ref<SketchColor>("ink");
/** Every state of the drawing; `at` is the one shown. */
const history = shallowRef<Stroke[][]>([props.strokes]);
const at = ref(0);
const strokes = computed(() => history.value[at.value]);
/** The line under the pointer, before it is lifted. */
const drawing = shallowRef<Stroke | null>(null);
const tick = ref(0);
const paper = ref<SVGSVGElement | null>(null);

function commit(next: Stroke[]) {
  if (next === strokes.value) return;
  history.value = [...history.value.slice(0, at.value + 1), next];
  at.value = history.value.length - 1;
}

function point(e: PointerEvent) {
  return toCanvas(e.clientX, e.clientY, paper.value!.getBoundingClientRect());
}

/** Strokes erased so far in this drag, committed as one step. */
let erasing: Stroke[] | null = null;

function down(e: PointerEvent) {
  if (e.button !== 0) return;
  paper.value?.setPointerCapture?.(e.pointerId);
  const { x, y } = point(e);
  if (tool.value === "eraser") {
    erasing = eraseAt(strokes.value, x, y, ERASER_RADIUS);
    return;
  }
  const stroke: Stroke = { tool: tool.value, color: color.value, points: [] };
  addPoint(stroke.points, x, y);
  drawing.value = stroke;
}

function move(e: PointerEvent) {
  const events = e.getCoalescedEvents?.() ?? [];
  for (const ev of events.length ? events : [e]) {
    const { x, y } = point(ev);
    if (erasing) erasing = eraseAt(erasing, x, y, ERASER_RADIUS);
    else if (drawing.value) addPoint(drawing.value.points, x, y);
  }
  tick.value++;
}

function up() {
  if (erasing) commit(erasing);
  else if (drawing.value) commit([...strokes.value, drawing.value]);
  erasing = null;
  drawing.value = null;
}

const shown = computed(() => {
  void tick.value;
  if (erasing) return erasing;
  return drawing.value ? [...strokes.value, drawing.value] : strokes.value;
});

const undo = () => at.value > 0 && at.value--;
const redo = () => at.value < history.value.length - 1 && at.value++;
const done = () => emit("done", strokes.value);

function onKey(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey;
  if (e.key === "Escape") emit("cancel");
  else if (mod && e.key.toLowerCase() === "z") (e.shiftKey ? redo : undo)();
  else if (mod && e.key === "Enter") done();
  else return;
  e.preventDefault();
  e.stopPropagation();
}
onMounted(() => window.addEventListener("keydown", onKey, true));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <Teleport to="body">
    <div class="sketch-backdrop" @pointerdown.self="done">
      <div class="sketch-sheet" role="dialog" aria-label="Drawing">
        <header>
          <button class="text cancel" @click="emit('cancel')">Cancel</button>
          <h2>Drawing</h2>
          <button class="text done" @click="done">Done</button>
        </header>
        <svg
          ref="paper"
          class="paper rn-ink"
          :class="tool"
          :viewBox="`0 0 ${SKETCH_WIDTH} ${height}`"
          @pointerdown="down"
          @pointermove="move"
          @pointerup="up"
          @pointercancel="up"
        >
          <path
            v-for="(s, i) in shown"
            :key="i"
            :class="[s.tool, s.color]"
            :d="strokePath(s.points)"
            :stroke-width="STROKE_WIDTH[s.tool]"
          />
        </svg>
        <footer>
          <div class="group">
            <button
              v-for="t in TOOLS"
              :key="t.id"
              class="tool"
              :class="{ on: tool === t.id }"
              :data-tool="t.id"
              :title="t.label"
              :aria-pressed="tool === t.id"
              @click="tool = t.id"
            >
              <Icon :name="t.id" :size="20" />
            </button>
          </div>
          <div class="group colors">
            <button
              v-for="c in SKETCH_COLORS"
              :key="c"
              class="swatch"
              :class="[c, { on: color === c }]"
              :data-color="c"
              :title="c === 'ink' ? 'Black' : c[0].toUpperCase() + c.slice(1)"
              :aria-pressed="color === c"
              @click="
                color = c;
                if (tool === 'eraser') tool = 'pen';
              "
            />
          </div>
          <div class="group">
            <button class="tool undo" title="Undo (Ctrl+Z)" :disabled="at === 0" @click="undo">
              <Icon name="undo" :size="19" />
            </button>
            <button class="tool redo" title="Redo (Ctrl+Shift+Z)" :disabled="at === history.length - 1" @click="redo">
              <Icon name="redo" :size="19" />
            </button>
          </div>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sketch-backdrop {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: grid;
  place-items: center;
  background: var(--scrim, rgb(0 0 0 / 0.18));
}
.sketch-sheet {
  display: flex;
  flex-direction: column;
  width: min(880px, calc(100vw - 64px));
  border-radius: 12px;
  background: var(--menu);
  backdrop-filter: var(--menu-blur);
  box-shadow: var(--shadow-pop);
  overflow: hidden;
}
header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: 44px;
  padding: 0 10px;
}
h2 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}
.text {
  justify-self: start;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--accent-text);
}
.done {
  justify-self: end;
  font-weight: 600;
}
.paper {
  display: block;
  width: calc(100% - 20px);
  margin: 0 10px;
  aspect-ratio: auto;
  border-radius: 8px;
  background: var(--editor);
  touch-action: none;
  cursor: crosshair;
}
.paper.eraser {
  cursor: cell;
}
footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  height: 54px;
}
.group {
  display: flex;
  align-items: center;
  gap: 4px;
}
.tool {
  display: grid;
  place-items: center;
  width: 34px;
  height: 30px;
  border-radius: 7px;
  color: var(--text-2);
}
.tool.on {
  background: var(--field);
  color: var(--text);
}
.tool:disabled {
  opacity: 0.35;
}
.colors {
  gap: 8px;
}
.swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--sk);
  box-shadow: inset 0 0 0 0.5px rgb(0 0 0 / 0.25);
}
.swatch.on {
  outline: 2px solid var(--sk);
  outline-offset: 2px;
}
.swatch.ink {
  --sk: var(--text);
}
.swatch.blue {
  --sk: var(--sk-blue);
}
.swatch.green {
  --sk: var(--sk-green);
}
.swatch.yellow {
  --sk: var(--sk-yellow);
}
.swatch.red {
  --sk: var(--sk-red);
}
</style>

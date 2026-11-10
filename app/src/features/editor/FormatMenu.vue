<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { currentEditor } from "../../app/context";
import Icon from "../../shared/ui/Icon.vue";
import type { TextStyle } from "./extensions/shortcuts";
import { HIGHLIGHT_COLORS, type HighlightColor } from "./extensions/colors";

/** The Aa button and its popover: text styles shown in their own look,
 * bold/italic/underline/strikethrough, and the highlight colours. */
defineProps<{ disabled: boolean }>();
const open = ref(false);
const root = ref<HTMLElement | null>(null);
const tick = ref(0);

const editor = computed(() => {
  void tick.value;
  return currentEditor.value;
});

const styles: { id: TextStyle; label: string; active: () => boolean }[] = [
  { id: "title", label: "Title", active: () => !!editor.value?.isActive("heading", { level: 1 }) },
  { id: "heading", label: "Heading", active: () => !!editor.value?.isActive("heading", { level: 2 }) },
  { id: "subheading", label: "Subheading", active: () => !!editor.value?.isActive("heading", { level: 3 }) },
  { id: "body", label: "Body", active: () => !!editor.value?.isActive("paragraph") && !inList() },
  { id: "monospaced", label: "Monospaced", active: () => !!editor.value?.isActive("codeBlock") },
];

function inList() {
  const e = editor.value;
  return !!e && (e.isActive("bulletList") || e.isActive("orderedList") || e.isActive("taskList"));
}

const lists = [
  { label: "Bulleted List", key: "Ctrl+Shift+7", run: () => chain()?.toggleBulletList().run(), active: () => !!editor.value?.isActive("bulletList", { dashed: false }) },
  { label: "Dashed List", key: "Ctrl+Shift+8", run: () => chain()?.toggleDashedList().run(), active: () => !!editor.value?.isActive("bulletList", { dashed: true }) },
  { label: "Numbered List", key: "Ctrl+Shift+9", run: () => chain()?.toggleOrderedList().run(), active: () => !!editor.value?.isActive("orderedList") },
  { label: "Block Quote", key: "Ctrl+'", run: () => chain()?.toggleBlockquote().run(), active: () => !!editor.value?.isActive("blockquote") },
];

const marks = [
  { mark: "bold", label: "B", title: "Bold (Ctrl+B)", run: () => chain()?.toggleBold().run() },
  { mark: "italic", label: "I", title: "Italic (Ctrl+I)", run: () => chain()?.toggleItalic().run() },
  { mark: "underline", label: "U", title: "Underline (Ctrl+U)", run: () => chain()?.toggleUnderline().run() },
  { mark: "strike", label: "S", title: "Strikethrough (Ctrl+Shift+S)", run: () => chain()?.toggleStrike().run() },
];

const chain = () => editor.value?.chain().focus();

const colorName = (c: HighlightColor) => c[0].toUpperCase() + c.slice(1);
const highlighted = (c: HighlightColor) => !!editor.value?.isActive("highlight", { color: c });

/** A colour on the selection; the colour it already has takes it off. */
function highlight(c: HighlightColor) {
  apply(() => (highlighted(c) ? chain()?.unsetHighlight().run() : chain()?.setHighlight(c).run()));
}

function apply(run: () => unknown) {
  run();
  tick.value++;
}

function setStyle(id: TextStyle) {
  editor.value?.commands.setTextStyle(id);
  open.value = false;
}

function onDown(e: PointerEvent) {
  if (open.value && !root.value?.contains(e.target as Node)) open.value = false;
}
function onKey(e: KeyboardEvent) {
  if (open.value && e.key === "Escape") open.value = false;
}
onMounted(() => {
  window.addEventListener("pointerdown", onDown, true);
  window.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  window.removeEventListener("pointerdown", onDown, true);
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <div ref="root" class="format">
    <button
      class="tool"
      :class="{ on: open }"
      :disabled="disabled"
      title="Text styles"
      @mousedown.prevent
      @click="open = !open; tick++"
    >
      <Icon name="format" :size="19" />
    </button>
    <Transition name="pop">
      <div v-if="open" class="popover" @mousedown.prevent>
        <div class="marks">
          <button
            v-for="m in marks"
            :key="m.mark"
            :class="[m.mark, { on: editor?.isActive(m.mark) }]"
            :title="m.title"
            @click="apply(m.run)"
          >
            {{ m.label }}
          </button>
        </div>
        <div class="colors">
          <button
            v-for="c in HIGHLIGHT_COLORS"
            :key="c"
            class="swatch"
            :class="[c, { on: highlighted(c) }]"
            :title="highlighted(c) ? 'Remove highlight' : `Highlight in ${colorName(c)}` + (c === 'purple' ? ' (Ctrl+Shift+E)' : '')"
            :aria-pressed="highlighted(c)"
            @click="highlight(c)"
          />
        </div>
        <button v-for="st in styles" :key="st.id" class="style" :class="st.id" @click="setStyle(st.id)">
          <span class="tick">{{ st.active() ? "✓" : "" }}</span>
          <span>{{ st.label }}</span>
        </button>
        <div class="sep" />
        <button v-for="l in lists" :key="l.label" class="style small" @click="apply(l.run); open = false">
          <span class="tick">{{ l.active() ? "✓" : "" }}</span>
          <span class="grow">{{ l.label }}</span>
          <span class="key">{{ l.key }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.format {
  position: relative;
}
.tool {
  width: 32px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: var(--text-2);
}
.tool:hover:not(:disabled),
.tool.on {
  background: var(--hover);
}
.tool:disabled {
  opacity: 0.4;
}
.popover {
  position: absolute;
  top: 34px;
  left: 50%;
  translate: -50% 0;
  z-index: 40;
  width: 236px;
  padding: 8px 6px 6px;
  border-radius: 11px;
  background: var(--menu);
  backdrop-filter: var(--menu-blur);
  box-shadow: var(--shadow-pop);
  transform-origin: top center;
}
.marks {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  margin: 0 4px 6px;
  border-radius: 7px;
  overflow: hidden;
  background: var(--menu-line);
}
.marks button {
  height: 28px;
  background: var(--field);
  font-size: 14px;
}
.marks button.on {
  background: var(--accent);
  color: #1d1d1f;
}
.marks .bold {
  font-weight: 800;
}
.marks .italic {
  font-style: italic;
  font-family: Georgia, serif;
}
.marks .underline {
  text-decoration: underline;
}
.marks .strike {
  text-decoration: line-through;
}
.colors {
  display: flex;
  justify-content: space-between;
  margin: 0 10px 6px;
  padding: 2px 0 4px;
}
.swatch {
  --hl: var(--hl-purple);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--hl);
  box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.18);
  transition: transform 120ms var(--ease-out);
}
.swatch:hover {
  transform: scale(1.1);
}
.swatch.on {
  box-shadow:
    0 0 0 2px var(--menu),
    0 0 0 3.5px var(--hl);
}
.swatch.pink {
  --hl: var(--hl-pink);
}
.swatch.orange {
  --hl: var(--hl-orange);
}
.swatch.mint {
  --hl: var(--hl-mint);
}
.swatch.blue {
  --hl: var(--hl-blue);
}
.style {
  display: flex;
  align-items: center;
  width: 100%;
  min-height: 28px;
  padding: 2px 10px 2px 2px;
  border-radius: 6px;
  text-align: left;
}
.style:hover {
  background: var(--accent);
  color: #1d1d1f;
}
.tick {
  width: 22px;
  flex: none;
  text-align: center;
  font-size: 11px;
}
.style.title {
  font-size: 20px;
  font-weight: 750;
}
.style.heading {
  font-size: 16px;
  font-weight: 700;
}
.style.subheading {
  font-size: 14px;
  font-weight: 650;
}
.style.body {
  font-size: 13px;
}
.style.monospaced {
  font-family: var(--mono);
  font-size: 12.5px;
}
.style.small {
  font-size: 13px;
}
.grow {
  flex: 1;
}
.key {
  font-size: 11px;
  color: var(--text-2);
}
.style:hover .key {
  color: inherit;
  opacity: 0.7;
}
.sep {
  height: 1px;
  margin: 5px 8px;
  background: var(--menu-line);
}
.pop-enter-active {
  transition:
    opacity 120ms ease,
    transform 140ms var(--spring);
}
.pop-leave-active {
  transition: opacity 100ms ease;
}
.pop-enter-from {
  opacity: 0;
  transform: scale(0.96);
}
.pop-leave-to {
  opacity: 0;
}
</style>

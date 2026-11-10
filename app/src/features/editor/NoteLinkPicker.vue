<script setup lang="ts">
import type { Editor } from "@tiptap/core";
import { computed, ref, watch } from "vue";
import type { NoteSummary } from "../../shared/ipc/types";
import { useStore } from "../../app/context";
import { titleMatches, type NoteLinkQuery } from "./extensions/noteLink";

const props = defineProps<{ editor: Editor | null; query: NoteLinkQuery | null; noteId: string | null }>();

const store = useStore();
/** The most notes the picker lists. */
const SHOWN = 8;

/** Every live note, newest first, read when `>>` is typed. */
const all = ref<NoteSummary[]>([]);
const loaded = ref(false);
const active = ref(0);
let token = 0;

watch(
  () => !!props.query,
  async (open) => {
    const mine = ++token;
    all.value = [];
    loaded.value = false;
    if (!open) return;
    const notes = await store.api.notesList({ kind: "all" }, "edited");
    if (mine !== token) return;
    all.value = notes.filter((n) => n.id !== props.noteId && n.title);
    loaded.value = true;
  },
  { immediate: true },
);

const notes = computed(() => {
  const typed = props.query?.text ?? "";
  return all.value.filter((n) => titleMatches(n.title, typed)).slice(0, SHOWN);
});
watch(notes, () => (active.value = 0));

const place = computed(() => {
  const { editor, query } = props;
  if (!editor || !query) return null;
  const at = editor.view.coordsAtPos(query.from);
  return { left: `${Math.max(6, Math.min(at.left - 8, window.innerWidth - 300))}px`, top: `${at.bottom + 6}px` };
});

function choose(note: NoteSummary | undefined) {
  const { editor, query } = props;
  if (!note || !editor || !query) return;
  editor.chain().focus().insertNoteLink({ id: note.id, title: note.title }, query).run();
}

/** Keys from the editor while the picker is open. */
function onKey(event: KeyboardEvent): boolean {
  const count = notes.value.length;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    if (count) active.value = (active.value + (event.key === "ArrowDown" ? 1 : count - 1)) % count;
    return true;
  }
  if (event.key === "Enter" || event.key === "Tab") {
    if (!count) return false;
    choose(notes.value[active.value]);
    return true;
  }
  return false;
}

defineExpose({ onKey });
</script>

<template>
  <Teleport to="body">
    <div v-if="place" class="rn-link-picker" role="listbox" :style="place" @mousedown.prevent>
      <p class="head">Link to Note</p>
      <button
        v-for="(note, i) in notes"
        :key="note.id"
        class="item"
        role="option"
        :aria-selected="i === active"
        :class="{ active: i === active }"
        @pointerenter="active = i"
        @click="choose(note)"
      >
        {{ note.title }}
      </button>
      <p v-if="loaded && !notes.length" class="none">No Matching Notes</p>
    </div>
  </Teleport>
</template>

<style scoped>
.rn-link-picker {
  position: fixed;
  z-index: 90;
  width: 280px;
  padding: 5px;
  border-radius: 9px;
  background: var(--menu);
  backdrop-filter: var(--menu-blur);
  box-shadow: var(--shadow-pop);
  font-size: 13px;
}
.head,
.none {
  margin: 0;
  padding: 3px 10px 4px;
  color: var(--text-2);
  font-size: 11.5px;
  font-weight: 600;
}
.none {
  font-weight: 400;
}
.item {
  display: block;
  width: 100%;
  height: 24px;
  padding: 0 10px;
  border-radius: 5px;
  overflow: hidden;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item.active {
  background: var(--accent);
  color: #1d1d1f;
}
</style>

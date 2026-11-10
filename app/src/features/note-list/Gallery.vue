<script setup lang="ts">
import { computed, ref } from "vue";
import { useStore } from "../../app/context";
import { listTime } from "../../shared/dates";
import { NOTE_TYPE } from "../../shared/dnd";
import type { NoteSummary } from "../../shared/ipc/types";
import Icon from "../../shared/ui/Icon.vue";
import Highlighted from "./Highlighted.vue";
import ListHeader from "./ListHeader.vue";
import { deleteNote, emptyTrash, noteMenu } from "./actions";
import { listGroups } from "./groups";
import { vRubberBand } from "../../shared/ui/rubberBand";

defineProps<{ chromePad: boolean }>();
const store = useStore();
const s = store.state;
const now = ref(Date.now());
const groups = computed(() => listGroups(store, now.value));
const focused = computed(() => s.focus === "list");

function pick(note: NoteSummary) {
  s.focus = "list";
  void store.select(note.id);
}

function open(note: NoteSummary) {
  void store.select(note.id).then(() => {
    s.galleryOpen = true;
    s.focus = "editor";
    s.focusEditor++;
  });
}

async function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.altKey) return;
  if (["ArrowRight", "ArrowDown"].includes(e.key)) await store.step(1);
  else if (["ArrowLeft", "ArrowUp"].includes(e.key)) await store.step(-1);
  else if (e.key === "Enter" && store.selected) open(store.selected);
  else if ((e.key === "Delete" || e.key === "Backspace") && store.selected) await deleteNote(store, store.selected);
  else return;
  e.preventDefault();
}

function dragStart(e: DragEvent, note: NoteSummary) {
  if (!e.dataTransfer || note.deletedAt !== null) return e.preventDefault();
  e.dataTransfer.setData(NOTE_TYPE, note.id);
}
</script>

<template>
  <section class="gallery" :class="{ focused }">
    <ListHeader :chrome-pad="chromePad" />
    <div v-if="store.inTrash && s.notes.length" class="trash-banner">
      Notes are kept here for 30 days, then deleted for good.
      <button class="link" @click="emptyTrash(store)">Delete All</button>
    </div>
    <div v-rubber-band class="scroll" tabindex="0" @keydown="onKey" @focus="s.focus = 'list'">
      <div v-for="g in groups" :key="g.label" class="group">
        <h2 v-if="g.label" class="group-label">{{ g.label }}</h2>
        <TransitionGroup tag="div" name="card" class="grid">
          <article
            v-for="note in g.notes"
            :key="note.id"
            class="card"
            :class="{ selected: note.id === s.selectedId }"
            draggable="true"
            @pointerdown="pick(note)"
            @dblclick="open(note)"
            @contextmenu.prevent.stop="noteMenu($event, store, note)"
            @dragstart="dragStart($event, note)"
          >
            <div class="preview">
              <div v-if="note.locked" class="page sealed">
                <Icon :name="s.locks.open ? 'lockOpen' : 'lock'" :size="26" />
              </div>
              <img v-else-if="note.firstImageId" :src="store.api.thumbUrl(note.firstImageId)" alt="" loading="lazy" />
              <div v-else class="page">
                <strong>{{ note.title }}</strong>
                <span>{{ note.snippet }}</span>
              </div>
            </div>
            <h3 :class="{ untitled: !note.title }"><Highlighted :text="note.title || 'New Note'" :terms="s.terms" /></h3>
            <p class="tabular">{{ listTime(note.deletedAt ?? note.updatedAt, now) }}</p>
          </article>
        </TransitionGroup>
      </div>
      <p v-if="!s.notes.length" class="empty">{{ s.query ? "No results" : "No notes" }}</p>
    </div>
  </section>
</template>

<style scoped>
.gallery {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--list);
}
.scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0 24px 24px;
  outline: none;
}
.trash-banner {
  margin: 10px 24px 0;
  padding: 9px 12px;
  border-radius: 8px;
  background: var(--field);
  font-size: 11.5px;
  color: var(--text-2);
}
.link {
  color: var(--accent-text);
  font-weight: 600;
}
.group-label {
  position: sticky;
  top: 0;
  z-index: 2;
  margin: 0;
  padding: 16px 4px 10px;
  background: var(--list);
  font-size: 12px;
  font-weight: 700;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 22px 18px;
}
.card {
  min-width: 0;
  text-align: center;
}
.preview {
  aspect-ratio: 4 / 3.2;
  border-radius: 9px;
  overflow: hidden;
  background: var(--editor);
  box-shadow:
    0 0 0 0.5px var(--line),
    0 1px 3px rgba(0, 0, 0, 0.08);
  transition: box-shadow 120ms ease;
}
.card.selected .preview {
  box-shadow:
    0 0 0 3px var(--select-2),
    0 1px 3px rgba(0, 0, 0, 0.08);
}
.focused .card.selected .preview {
  box-shadow:
    0 0 0 3px var(--accent),
    0 1px 3px rgba(0, 0, 0, 0.08);
}
.preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.page {
  height: 100%;
  padding: 10px 11px;
  text-align: left;
  font-size: 8.5px;
  line-height: 1.45;
  color: var(--text-2);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 9;
  -webkit-box-orient: vertical;
}
.page.sealed {
  display: grid;
  place-items: center;
  color: var(--text-2);
}
.page strong {
  display: block;
  margin-bottom: 3px;
  font-size: 10.5px;
  color: var(--text);
}
h3 {
  margin: 9px 0 1px;
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.focused .card.selected h3 {
  display: inline-block;
  max-width: 100%;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--select);
  color: var(--select-text);
}
h3.untitled {
  color: var(--text-2);
}
p {
  margin: 0;
  font-size: 11px;
  color: var(--text-2);
}
.empty {
  margin-top: 20%;
  text-align: center;
  font-size: 14px;
  color: var(--text-3);
}
.card-enter-active {
  transition:
    opacity 180ms ease,
    transform 180ms var(--ease-out);
}
.card-enter-from {
  opacity: 0;
  transform: scale(0.96);
}
.card-leave-active {
  display: none;
}
.card-move {
  transition: transform 220ms var(--ease-out);
}
</style>

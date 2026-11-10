<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { signals, useStore } from "../../app/context";
import { listTime } from "../../shared/dates";
import { NOTE_TYPE } from "../../shared/dnd";
import Icon from "../../shared/ui/Icon.vue";
import type { NoteSummary } from "../../shared/ipc/types";
import Highlighted from "./Highlighted.vue";
import ListHeader from "./ListHeader.vue";
import { deleteNote, emptyTrash, noteMenu } from "./actions";
import { listGroups } from "./groups";

defineProps<{ chromePad: boolean }>();
const store = useStore();
const s = store.state;

const now = ref(Date.now());
setInterval(() => (now.value = Date.now()), 60_000);

const groups = computed(() => listGroups(store, now.value));
const focused = computed(() => s.focus === "list");
const showFolder = computed(() => s.query || s.source.kind !== "folder");
const folderName = (id: string) => s.folders.find((f) => f.id === id)?.name ?? "";

const scroller = ref<HTMLElement | null>(null);

async function pick(note: NoteSummary) {
  s.focus = "list";
  scroller.value?.focus({ preventScroll: true });
  await store.select(note.id);
}

async function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    await store.step(e.key === "ArrowDown" ? 1 : -1);
    await nextTick();
    scroller.value?.querySelector(".row.selected")?.scrollIntoView({ block: "nearest" });
  } else if (e.key === "Delete" || e.key === "Backspace") {
    e.preventDefault();
    if (store.selected) await deleteNote(store, store.selected);
  } else if (e.key === "Enter" && store.selected) {
    e.preventDefault();
    s.focus = "editor";
    s.focusEditor++;
  }
}

function dragStart(e: DragEvent, note: NoteSummary) {
  if (!e.dataTransfer || note.deletedAt !== null) return e.preventDefault();
  e.dataTransfer.setData(NOTE_TYPE, note.id);
  e.dataTransfer.effectAllowed = "move";
}

watch(
  () => signals.focusList,
  () => scroller.value?.focus({ preventScroll: true }),
);
watch(
  () => s.focus,
  (f) => f === "list" && scroller.value?.focus({ preventScroll: true }),
);
</script>

<template>
  <section class="list" :class="{ focused }">
    <ListHeader :chrome-pad="chromePad" />
    <div v-if="store.inTrash && s.notes.length" class="trash-banner">
      Notes are kept here for 30 days, then deleted for good.
      <button class="link" @click="emptyTrash(store)">Delete All</button>
    </div>
    <div
      ref="scroller"
      class="scroll"
      tabindex="0"
      @keydown="onKey"
      @focus="s.focus = 'list'"
    >
      <div v-for="g in groups" :key="g.label" class="group">
        <h2 v-if="g.label" class="group-label">{{ g.label }}</h2>
        <TransitionGroup tag="ul" name="row">
          <li
            v-for="note in g.notes"
            :key="note.id"
            class="row"
            :class="{ selected: note.id === s.selectedId }"
            draggable="true"
            @pointerdown="pick(note)"
            @dblclick="s.focus = 'editor'; s.focusEditor++"
            @contextmenu.prevent.stop="pick(note).then(() => noteMenu($event, store, note))"
            @dragstart="dragStart($event, note)"
          >
            <div class="text">
              <div class="title" :class="{ untitled: !note.title }">
                <Icon v-if="note.pinned && g.label !== 'Pinned'" class="pin" name="pin" :size="12" />
                <Highlighted :text="note.title || 'New Note'" :terms="s.terms" />
              </div>
              <div class="line">
                <span class="time tabular">{{ listTime(note.deletedAt ?? note.updatedAt, now) }}</span>
                <span class="snippet"><Highlighted :text="note.snippet || 'No additional text'" :terms="s.terms" /></span>
              </div>
              <div v-if="showFolder" class="folder">
                <Icon name="folder" :size="13" />
                <span>{{ folderName(note.folderId) }}</span>
              </div>
            </div>
            <img v-if="note.firstImageId" class="thumb" :src="store.api.thumbUrl(note.firstImageId)" alt="" loading="lazy" />
          </li>
        </TransitionGroup>
      </div>
      <p v-if="!s.notes.length" class="empty">
        {{ s.query ? "No results" : store.inTrash ? "Nothing deleted" : "No notes" }}
      </p>
    </div>
  </section>
</template>

<style scoped>
.list {
  flex: none;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--list);
}
.scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0 10px 16px;
  outline: none;
}
.trash-banner {
  margin: 10px 10px 0;
  padding: 9px 12px;
  border-radius: 8px;
  background: var(--field);
  font-size: 11.5px;
  line-height: 1.4;
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
  padding: 14px 10px 6px;
  background: var(--list);
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;
}
.row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px 10px;
  border-radius: 8px;
}
.row + .row::before {
  content: "";
  position: absolute;
  top: 0;
  left: 12px;
  right: 12px;
  height: 0.5px;
  background: var(--line);
}
.row.selected::before,
.row.selected + .row::before {
  display: none;
}
.row.selected {
  background: var(--select-2);
}
.focused .row.selected {
  background: var(--select);
  color: var(--select-text);
}
.text {
  flex: 1;
  min-width: 0;
}
.title {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13.5px;
  font-weight: 650;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.title.untitled {
  color: var(--text-2);
}
.pin {
  color: var(--accent);
  flex: none;
}
.line {
  display: flex;
  gap: 7px;
  margin-top: 2px;
  font-size: 12.5px;
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
}
.time {
  flex: none;
  color: var(--text);
  opacity: 0.85;
}
.snippet {
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-2);
}
.focused .row.selected .snippet,
.focused .row.selected .folder {
  color: inherit;
  opacity: 0.7;
}
.folder {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 3px;
  font-size: 11.5px;
  color: var(--text-2);
}
.thumb {
  flex: none;
  width: 46px;
  height: 46px;
  object-fit: cover;
  border-radius: 6px;
  box-shadow: 0 0 0 0.5px var(--line);
}
.empty {
  margin-top: 40%;
  text-align: center;
  font-size: 14px;
  color: var(--text-3);
}
.row-enter-active {
  transition:
    opacity 180ms ease,
    transform 180ms var(--ease-out);
}
.row-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.row-leave-active {
  position: absolute;
  left: 0;
  right: 0;
  transition: opacity 200ms ease;
}
.row-leave-to {
  opacity: 0;
}
.row-move {
  transition: transform 220ms var(--ease-out);
}
</style>

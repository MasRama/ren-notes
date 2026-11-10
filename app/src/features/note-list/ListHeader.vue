<script setup lang="ts">
import { computed } from "vue";
import { useStore } from "../../app/context";
import Icon from "../../shared/ui/Icon.vue";
import { openMenu } from "../../shared/ui/menu";
import { deleteNote } from "./actions";

/** The toolbar over the list (or the gallery): what is shown, how many,
 * the view switch, and delete. */
defineProps<{ chromePad: boolean }>();
const store = useStore();
const s = store.state;

const count = computed(() => {
  const n = s.notes.length;
  if (s.query) return n === 1 ? "1 result" : `${n} results`;
  return n === 1 ? "1 note" : `${n} notes`;
});

function sortMenu(e: MouseEvent) {
  const sort = store.sort;
  openMenu(e, [
    { label: "Date Edited", checked: sort === "edited", action: () => void store.setSort("edited") },
    { label: "Date Created", checked: sort === "created", action: () => void store.setSort("created") },
    { label: "Title", checked: sort === "title", action: () => void store.setSort("title") },
    { separator: true },
    {
      label: "Group by Date",
      checked: s.groupByDate,
      disabled: sort === "title",
      action: () => {
        s.groupByDate = !s.groupByDate;
        store.persist();
      },
    },
    { separator: true },
    { label: "Translucent Sidebar", checked: s.translucentSidebar, action: () => store.toggleTranslucentSidebar() },
  ]);
}

function remove() {
  const note = store.selected;
  if (note) void deleteNote(store, note);
}
</script>

<template>
  <header class="bar" :class="{ pad: chromePad }" data-tauri-drag-region>
    <div class="title" data-tauri-drag-region @contextmenu.prevent.stop="sortMenu">
      <h1 data-tauri-drag-region>{{ store.title }}</h1>
      <p class="tabular" data-tauri-drag-region>{{ count }}</p>
    </div>
    <div class="switch" role="group" aria-label="View">
      <button :class="{ on: s.view === 'list' }" title="List (Ctrl+1)" @click="store.setView('list')">
        <Icon name="list" :size="17" />
      </button>
      <button :class="{ on: s.view === 'gallery' }" title="Gallery (Ctrl+2)" @click="store.setView('gallery')">
        <Icon name="gallery" :size="16" />
      </button>
    </div>
    <button class="tool" title="View options" @click="sortMenu">
      <Icon name="more" :size="18" />
    </button>
    <button class="tool" title="Delete" :disabled="!store.selected" @click="remove">
      <Icon name="trash" :size="18" />
    </button>
  </header>
</template>

<style scoped>
.bar {
  flex: none;
  height: var(--toolbar-h);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 10px 0 18px;
  border-bottom: 0.5px solid var(--line);
  transition: padding-left 250ms var(--ease-out);
}
.bar.pad {
  padding-left: 128px;
}
.title {
  flex: 1;
  min-width: 0;
}
h1 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
p {
  margin: 1px 0 0;
  font-size: 11px;
  white-space: nowrap;
  color: var(--text-2);
}
.switch {
  display: flex;
  padding: 2px;
  border-radius: 7px;
  background: var(--field);
  margin-right: 4px;
}
.switch button {
  width: 30px;
  height: 22px;
  display: grid;
  place-items: center;
  border-radius: 5px;
  color: var(--text-2);
}
.switch button.on {
  background: var(--window);
  color: var(--text);
  box-shadow: 0 0.5px 2px rgba(0, 0, 0, 0.18);
}
.tool {
  width: 30px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: var(--text-2);
}
.tool:hover:not(:disabled) {
  background: var(--hover);
}
.tool:active:not(:disabled) {
  background: var(--press);
}
.tool:disabled {
  opacity: 0.4;
}
</style>

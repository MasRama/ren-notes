<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useStore } from "../../app/context";
import { sameSource, type Source } from "../../app/store";
import Icon from "../../shared/ui/Icon.vue";
import { openMenu } from "../../shared/ui/menu";
import { confirmDialog } from "../../shared/ui/dialog";
import { FOLDER_TYPE, NOTE_TYPE, dropZone, type DropZone } from "../../shared/dnd";
import { flattenFolders, subtree } from "./tree";
import { openSmartDialog } from "../smart-folders/dialog";
import type { Folder } from "../../shared/ipc/types";
import { vRubberBand } from "../../shared/ui/rubberBand";

const store = useStore();
const s = store.state;

const rows = computed(() => flattenFolders(s.folders, s.collapsed));
const focused = computed(() => s.focus === "sidebar");
const selectedTags = computed(() => (s.source.kind === "tags" ? s.source.tags : []));
const sectionOpen = ref(true);

const isSelected = (source: Source) => !s.query && sameSource(source, s.source);

async function choose(source: Source) {
  s.focus = "sidebar";
  await store.selectSource(source);
}

// ---- renaming -------------------------------------------------------------
const renameInput = ref<HTMLInputElement[] | null>(null);
const draftName = ref("");
watch(
  () => s.renamingFolder,
  async (id) => {
    if (!id) return;
    draftName.value = s.folders.find((f) => f.id === id)?.name ?? "";
    await nextTick();
    const input = renameInput.value?.[0];
    input?.focus();
    input?.select();
  },
);
function finishRename(id: string, keep: boolean) {
  if (s.renamingFolder !== id) return;
  if (keep) void store.renameFolder(id, draftName.value);
  else s.renamingFolder = null;
}

// ---- menus ----------------------------------------------------------------
async function deleteFolder(folder: Folder) {
  const inside = [...subtree(s.folders, folder.id)];
  const notes = s.folders.filter((f) => inside.includes(f.id)).reduce((n, f) => n + f.noteCount, 0);
  const ok = await confirmDialog({
    title: `Delete “${folder.name}”?`,
    message: notes
      ? `Its ${notes === 1 ? "note" : `${notes} notes`} and any folders inside it will move to Recently Deleted.`
      : "Any folders inside it will be deleted too.",
    confirm: "Delete Folder",
    danger: true,
  });
  if (ok) await store.deleteFolder(folder.id);
}

function folderMenu(e: MouseEvent, folder: Folder) {
  openMenu(e, [
    { label: "New Folder", action: () => void store.newFolder(folder.isDefault ? null : folder.id) },
    { separator: true },
    { label: "Rename Folder", disabled: folder.isDefault, action: () => (s.renamingFolder = folder.id) },
    { label: "Delete Folder", disabled: folder.isDefault, danger: true, action: () => void deleteFolder(folder) },
  ]);
}

function smartMenu(e: MouseEvent, id: string) {
  const folder = s.smartFolders.find((f) => f.id === id);
  if (!folder) return;
  openMenu(e, [
    { label: "Edit Smart Folder", action: () => openSmartDialog(folder) },
    { separator: true },
    {
      label: "Delete Smart Folder",
      danger: true,
      action: async () => {
        const ok = await confirmDialog({
          title: `Delete “${folder.name}”?`,
          message: "Its notes stay where they are.",
          confirm: "Delete",
          danger: true,
        });
        if (ok) await store.deleteSmartFolder(id);
      },
    },
  ]);
}

function newMenu(e: MouseEvent) {
  openMenu(e, [
    { label: "New Folder", shortcut: "Ctrl+Shift+N", action: () => void store.newFolder(null) },
    { label: "New Smart Folder", action: () => openSmartDialog() },
  ]);
}

// ---- drag and drop ----------------------------------------------------------
const drop = ref<{ id: string; zone: DropZone } | null>(null);

function dragFolder(e: DragEvent, folder: Folder) {
  if (folder.isDefault || !e.dataTransfer) return e.preventDefault();
  e.dataTransfer.setData(FOLDER_TYPE, folder.id);
  e.dataTransfer.effectAllowed = "move";
}

function over(e: DragEvent, folder: Folder) {
  const types = e.dataTransfer?.types ?? [];
  if (types.includes(NOTE_TYPE)) {
    drop.value = { id: folder.id, zone: "into" };
  } else if (types.includes(FOLDER_TYPE)) {
    drop.value = { id: folder.id, zone: dropZone(e, e.currentTarget as HTMLElement, true) };
    if (folder.isDefault && drop.value.zone !== "after") drop.value.zone = "after";
  } else return;
  e.preventDefault();
}

async function dropped(e: DragEvent, folder: Folder) {
  const zone = drop.value?.zone ?? "into";
  drop.value = null;
  const note = e.dataTransfer?.getData(NOTE_TYPE);
  if (note) return store.moveNote(note, folder.id);
  const id = e.dataTransfer?.getData(FOLDER_TYPE);
  if (!id || subtree(s.folders, id).has(folder.id)) return;
  if (zone === "into") return store.moveFolder(id, folder.id, Number.MAX_SAFE_INTEGER);
  const siblings = s.folders
    .filter((f) => f.parentId === folder.parentId && f.id !== id && !f.isDefault)
    .sort((a, b) => a.sortIndex - b.sortIndex);
  const at = siblings.findIndex((f) => f.id === folder.id);
  await store.moveFolder(id, folder.parentId, zone === "before" ? Math.max(0, at) : at + 1);
}
</script>

<template>
  <nav class="sidebar" :class="{ focused }" @contextmenu.prevent="newMenu" @pointerdown="s.focus = 'sidebar'">
    <div class="top" data-tauri-drag-region />
    <div v-rubber-band class="scroll">
      <button class="section" @click="sectionOpen = !sectionOpen">
        <span>On My Computer</span>
        <Icon class="disclose" :class="{ open: sectionOpen }" name="chevronRight" :size="12" />
      </button>
      <div v-show="sectionOpen" class="group">
        <div
          v-for="row in rows"
          :key="row.folder.id"
          class="row"
          :class="{
            selected: isSelected({ kind: 'folder', id: row.folder.id }),
            [`drop-${drop?.zone}`]: drop?.id === row.folder.id,
          }"
          :style="{ paddingLeft: `${8 + row.depth * 16}px` }"
          :draggable="!row.folder.isDefault && s.renamingFolder !== row.folder.id"
          @click="choose({ kind: 'folder', id: row.folder.id })"
          @dblclick="!row.folder.isDefault && (s.renamingFolder = row.folder.id)"
          @contextmenu.prevent.stop="folderMenu($event, row.folder)"
          @dragstart="dragFolder($event, row.folder)"
          @dragover="over($event, row.folder)"
          @dragleave="drop = null"
          @drop.prevent="dropped($event, row.folder)"
        >
          <button
            class="twisty"
            :class="{ open: !s.collapsed.includes(row.folder.id), hidden: !row.hasChildren }"
            tabindex="-1"
            @click.stop="store.toggleCollapsed(row.folder.id)"
          >
            <Icon name="chevronRight" :size="11" />
          </button>
          <Icon class="glyph" name="folder" :size="17" />
          <input
            v-if="s.renamingFolder === row.folder.id"
            ref="renameInput"
            v-model="draftName"
            class="rename"
            spellcheck="false"
            @click.stop
            @keydown.enter.prevent="finishRename(row.folder.id, true)"
            @keydown.esc.prevent.stop="finishRename(row.folder.id, false)"
            @blur="finishRename(row.folder.id, true)"
          />
          <span v-else class="name">{{ row.folder.name }}</span>
          <span class="count tabular">{{ row.folder.noteCount || "" }}</span>
        </div>

        <div
          v-for="smart in s.smartFolders"
          :key="smart.id"
          class="row"
          :class="{ selected: isSelected({ kind: 'smart', id: smart.id }) }"
          @click="choose({ kind: 'smart', id: smart.id })"
          @dblclick="openSmartDialog(smart)"
          @contextmenu.prevent.stop="smartMenu($event, smart.id)"
        >
          <span class="twisty hidden" />
          <Icon class="glyph" name="smartFolder" :size="17" />
          <span class="name">{{ smart.name }}</span>
        </div>

        <div
          class="row"
          :class="{ selected: isSelected({ kind: 'trash' }) }"
          @click="choose({ kind: 'trash' })"
          @contextmenu.prevent.stop
        >
          <span class="twisty hidden" />
          <Icon class="glyph" name="trash" :size="17" />
          <span class="name">Recently Deleted</span>
        </div>
      </div>

      <template v-if="s.tags.length">
        <div class="section static">Tags</div>
        <div class="tags">
          <button
            v-for="t in s.tags"
            :key="t.tag"
            class="chip"
            :class="{ on: selectedTags.includes(t.tag) }"
            :title="`${t.count} ${t.count === 1 ? 'note' : 'notes'}`"
            @click="s.focus = 'sidebar'; store.toggleTag(t.tag)"
          >
            #{{ t.tag }}
          </button>
        </div>
      </template>
    </div>

    <button class="new-folder" @click="store.newFolder(null)" @contextmenu.prevent.stop="newMenu">
      <Icon name="plusCircle" :size="16" />
      <span>New Folder</span>
    </button>
  </nav>
</template>

<style scoped>
.sidebar {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--sidebar);
  border-right: 0.5px solid var(--sidebar-line);
}
.top {
  flex: none;
  height: var(--toolbar-h);
}
.scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0 10px 12px;
}
.section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  height: 26px;
  padding: 0 8px;
  margin-top: 4px;
  font-size: 11px;
  font-weight: 650;
  color: var(--text-2);
}
.section.static {
  margin-top: 14px;
}
.disclose {
  opacity: 0;
  transition:
    transform 160ms var(--ease-out),
    opacity 120ms;
}
.section:hover .disclose {
  opacity: 1;
}
.disclose.open {
  transform: rotate(90deg);
}
.row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding-right: 10px;
  border-radius: 7px;
  font-size: 13px;
}
.row.selected {
  background: var(--select-2);
}
.focused .row.selected {
  background: var(--select);
  color: var(--select-text);
}
.row.drop-into {
  box-shadow: inset 0 0 0 2px var(--accent);
}
.row.drop-before::before,
.row.drop-after::after {
  content: "";
  position: absolute;
  left: 8px;
  right: 8px;
  height: 2px;
  border-radius: 2px;
  background: var(--accent);
}
.row.drop-before::before {
  top: -1px;
}
.row.drop-after::after {
  bottom: -1px;
}
.twisty {
  width: 12px;
  height: 16px;
  display: grid;
  place-items: center;
  color: var(--text-2);
  transition: transform 160ms var(--ease-out);
}
.twisty.open {
  transform: rotate(90deg);
}
.twisty.hidden {
  visibility: hidden;
}
.glyph {
  color: var(--accent);
}
.focused .row.selected .glyph {
  color: currentColor;
}
.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rename {
  flex: 1;
  min-width: 0;
  height: 22px;
  margin-left: -3px;
  padding: 0 3px;
  border: 0;
  border-radius: 4px;
  outline: 2px solid var(--accent);
  background: var(--window);
}
.count {
  color: var(--text-2);
  font-size: 12px;
}
.focused .row.selected .count {
  color: inherit;
  opacity: 0.65;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 4px 8px;
}
.chip {
  height: 24px;
  padding: 0 10px;
  border-radius: 12px;
  background: var(--chip);
  font-size: 12px;
}
.chip:hover {
  background: var(--press);
}
.chip.on {
  background: var(--select);
  color: var(--select-text);
}
.new-folder {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 40px;
  padding: 0 18px;
  color: var(--text-2);
  font-size: 13px;
}
.new-folder:hover {
  color: var(--text);
}
</style>

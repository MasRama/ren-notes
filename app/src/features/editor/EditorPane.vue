<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { currentEditor, signals, useStore } from "../../app/context";
import Icon from "../../shared/ui/Icon.vue";
import FormatMenu from "./FormatMenu.vue";
import NoteEditor from "./NoteEditor.vue";
import SearchField from "./SearchField.vue";
import { vRubberBand } from "../../shared/ui/rubberBand";

defineProps<{ chromePad: boolean }>();
const store = useStore();
const s = store.state;

const note = computed(() => store.selected);
const deleted = computed(() => note.value?.deletedAt != null);
const canEdit = computed(() => !!note.value && !deleted.value);

// Find in note (Ctrl+Alt+F).
const finding = ref(false);
const findText = ref("");
const findInput = ref<HTMLInputElement | null>(null);
const findTerms = computed(() =>
  finding.value && findText.value.trim() ? findText.value.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean) : null,
);
watch(
  () => signals.findInNote,
  async () => {
    finding.value = true;
    await nextTick();
    findInput.value?.focus();
    findInput.value?.select();
  },
);
function closeFind() {
  finding.value = false;
  findText.value = "";
  currentEditor.value?.commands.focus();
}

function checklist() {
  currentEditor.value?.chain().focus().toggleTaskList().run();
}
function table() {
  currentEditor.value?.commands.insertNoteTable();
}
</script>

<template>
  <section class="editor-pane">
    <header class="bar" :class="{ pad: chromePad }" data-tauri-drag-region>
      <button v-if="s.galleryOpen" class="tool" title="Back to gallery" @click="s.galleryOpen = false">
        <Icon name="chevronLeft" :size="19" />
      </button>
      <button class="tool" title="New Note (Ctrl+N)" :disabled="store.inTrash" @click="store.newNote()">
        <Icon name="compose" :size="19" />
      </button>
      <div class="middle" data-tauri-drag-region>
        <FormatMenu :disabled="!canEdit" />
        <button class="tool" title="Checklist (Ctrl+Shift+L)" :disabled="!canEdit" @mousedown.prevent @click="checklist">
          <Icon name="checklist" :size="19" />
        </button>
        <button class="tool" title="Table (Ctrl+Alt+T)" :disabled="!canEdit" @mousedown.prevent @click="table">
          <Icon name="table" :size="19" />
        </button>
        <button class="tool" title="Drawing" :disabled="!canEdit" @mousedown.prevent @click="signals.newSketch++">
          <Icon name="sketch" :size="19" />
        </button>
        <button class="tool" title="Attach a file" :disabled="!canEdit" @click="signals.attachFile++">
          <Icon name="attach" :size="19" />
        </button>
      </div>
      <SearchField />
    </header>

    <div v-if="deleted && note" class="banner">
      Recently deleted notes can’t be edited.
      <button class="link" @click="store.recover(note.id)">Recover</button>
    </div>
    <div v-if="finding" class="find">
      <Icon name="search" :size="14" />
      <input
        ref="findInput"
        v-model="findText"
        placeholder="Find in note"
        spellcheck="false"
        @keydown.esc.prevent.stop="closeFind"
        @keydown.enter.prevent
      />
      <button class="link" @click="closeFind">Done</button>
    </div>

    <div v-rubber-band class="scroll">
      <NoteEditor :find-terms="findTerms" />
    </div>
  </section>
</template>

<style scoped>
.editor-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--editor);
}
.bar {
  flex: none;
  height: var(--toolbar-h);
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 12px;
  border-bottom: 0.5px solid var(--line);
  transition: padding-left 250ms var(--ease-out);
}
.bar.pad {
  padding-left: 128px;
}
.middle {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.tool {
  width: 32px;
  height: 28px;
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
.banner,
.find {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 0.5px solid var(--line);
  font-size: 12px;
  color: var(--text-2);
}
.find input {
  flex: 1;
  border: 0;
  outline: 0;
  background: none;
  font-size: 13px;
  color: var(--text);
}
.link {
  color: var(--accent-text);
  font-weight: 600;
}
.scroll {
  flex: 1;
  overflow-y: auto;
}
</style>

<script setup lang="ts">
import { EditorContent, useEditor } from "@tiptap/vue-3";
import type { Editor, JSONContent } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import { NodeSelection } from "@tiptap/pm/state";
import { computed, onBeforeUnmount, watch } from "vue";
import { currentEditor, signals, useStore } from "../../app/context";
import { openLink } from "../../app/window";
import { editorDate } from "../../shared/dates";
import type { Note } from "../../shared/ipc/types";
import { openMenu } from "../../shared/ui/menu";
import { Autosave } from "./autosave";
import { deriveFields, type DocNode } from "./derive";
import { insertFiles } from "./files";
import { noteExtensions } from "./extensions";
import { toggleCheckedAt } from "./extensions/checklist";
import { onlyFolds } from "./extensions/folding";

const props = defineProps<{ findTerms: string[] | null }>();
const store = useStore();
const s = store.state;
const api = store.api;

let noteId: string | null = null;
let loadToken = 0;

// Folding a heading is saved with the note but is not an edit to it.
let edited = false;

const autosave = new Autosave({
  delay: 300,
  save: () => {
    const keepTime = !edited;
    edited = false;
    return save(keepTime).catch((error: unknown) => {
      if (!keepTime) edited = true;
      throw error;
    });
  },
  onError: () => (s.notice = "Can’t save this note right now. Trying again…"),
  onRecovered: () => (s.notice = null),
});

async function save(keepTime: boolean) {
  const e = editor.value;
  const id = noteId;
  if (!e || !id) return;
  const doc = e.getJSON();
  const summary = await api.notesSave(id, {
    docJson: JSON.stringify(doc),
    ...deriveFields(doc as DocNode),
    keepTime,
  });
  if (summary.id === store.state.selectedId || s.notes.some((n) => n.id === summary.id)) store.noteSaved(summary);
}

const editor = useEditor({
  extensions: noteExtensions({
    attachmentUrl: (id) => api.attachmentUrl(id),
    openAttachment: (id) => void api.attachmentsOpen(id),
    toggleChecked: () => {
      const e = editor.value;
      return !!e && toggleCheckedAt(e.view, e.state.selection.from, false);
    },
    sinkChecked: () => s.sinkChecked,
  }),
  editorProps: {
    attributes: { class: "rn-doc", spellcheck: "true" },
    handlePaste(_view, event) {
      const files = [...(event.clipboardData?.files ?? [])];
      if (!files.length || !editor.value?.isEditable) return false;
      void insertFiles(editor.value, api, files, null);
      return true;
    },
    handleDrop(view, event, _slice, moved) {
      const files = [...(event.dataTransfer?.files ?? [])];
      if (moved || !files.length || !editor.value?.isEditable) return false;
      const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
      void insertFiles(editor.value, api, files, at?.pos ?? null);
      return true;
    },
    handleClick(_view, _pos, event) {
      const link = (event.target as HTMLElement).closest("a[href]");
      if (!link) return false;
      void openLink(link.getAttribute("href")!);
      return true;
    },
    handleDOMEvents: {
      contextmenu(view, event) {
        const img = (event.target as HTMLElement).closest("img.rn-image");
        if (!img || !editor.value) return false;
        event.preventDefault();
        const pos = view.posAtDOM(img, 0);
        view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)));
        const e = editor.value;
        const size = e.getAttributes("image").size;
        const id = e.getAttributes("image").attachmentId as string | null;
        openMenu(event, [
          { label: "View as Large Image", checked: size !== "small", action: () => e.chain().updateAttributes("image", { size: "large" }).run() },
          { label: "View as Small Image", checked: size === "small", action: () => e.chain().updateAttributes("image", { size: "small" }).run() },
          { separator: true },
          { label: "Open Picture", disabled: !id, action: () => id && void api.attachmentsOpen(id) },
          { label: "Delete Picture", danger: true, action: () => e.chain().focus().deleteSelection().run() },
        ]);
        return true;
      },
    },
  },
  onUpdate: ({ transaction, appendedTransactions }) => {
    if (!onlyFolds([transaction, ...appendedTransactions])) edited = true;
    autosave.changed();
  },
  onFocus: () => (s.focus = "editor"),
  onBlur: () => void autosave.flush(),
});

/** A fresh document with its own undo history. */
function replaceDoc(e: Editor, content: JSONContent | string) {
  e.commands.setContent(content, { emitUpdate: false });
  // No selection given: the cursor starts in the first text, never on a picture.
  e.view.updateState(EditorState.create({ doc: e.state.doc, plugins: e.state.plugins }));
}

function isBlank(doc: JSONContent): boolean {
  const content = doc.content ?? [];
  return content.length === 0 || (content.length === 1 && content[0].type === "paragraph" && !content[0].content?.length);
}

let loading = false;

async function load(id: string | null) {
  loading = true;
  const opening = open(id);
  const token = loadToken;
  try {
    await opening;
  } finally {
    // A newer load is still on its way: leave the focus to it.
    if (token === loadToken) loading = false;
  }
  if (token === loadToken && focusWanted) {
    focusWanted = false;
    focusNow();
  }
}

async function open(id: string | null) {
  const token = ++loadToken;
  autosave.reset();
  edited = false;
  const e = editor.value;
  if (!e) return;
  if (!id) {
    noteId = null;
    replaceDoc(e, "");
    e.setEditable(false, false);
    return;
  }
  let note: Note;
  try {
    note = await api.notesGet(id);
  } catch {
    return;
  }
  if (token !== loadToken || e.isDestroyed) return;
  noteId = id;
  if (note.docFormat === "legacy_html") {
    replaceDoc(e, note.docJson);
    // Converted once, quietly: the note keeps its edit time.
    if (note.deletedAt === null) void save(true);
  } else {
    const doc = JSON.parse(note.docJson) as JSONContent;
    replaceDoc(e, isBlank(doc) && !note.title ? { type: "doc", content: [{ type: "heading", attrs: { level: 1 } }] } : doc);
  }
  // Without emitting an update: opening a note must not save it.
  e.setEditable(note.deletedAt === null, false);
  e.commands.setSearchTerms(props.findTerms ?? s.terms);
}

watch(
  [() => s.selectedId, editor],
  ([id]) => void load(id),
  { immediate: true },
);
watch(
  () => [props.findTerms, s.terms] as const,
  ([find, terms]) => editor.value?.commands.setSearchTerms(find ?? terms),
);
function focusNow() {
  const e = editor.value;
  if (e?.isEditable) e.commands.focus(noteId && store.selected?.title ? "end" : "start");
}
// Asked while a note is still loading (a new note, say): focus once it is in.
let focusWanted = false;
watch(
  () => s.focusEditor,
  () => {
    if (loading) focusWanted = true;
    else focusNow();
  },
);
watch(
  () => signals.attachFile,
  () => {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.multiple = true;
    picker.onchange = () => editor.value && void insertFiles(editor.value, api, [...(picker.files ?? [])], null);
    picker.click();
  },
);
watch(editor, (e) => (currentEditor.value = e ?? null), { immediate: true });

store.beforeLeave = () => autosave.flush();
onBeforeUnmount(() => {
  void autosave.flush();
  if (store.beforeLeave) store.beforeLeave = null;
  currentEditor.value = null;
});

const date = computed(() => {
  const n = store.selected;
  return n ? editorDate(n.updatedAt) : "";
});
</script>

<template>
  <div class="page" @mousedown.self="editor?.commands.focus('end')">
    <p class="date tabular">{{ date }}</p>
    <EditorContent :editor="editor" class="content" />
  </div>
</template>

<style scoped>
.page {
  min-height: 100%;
  padding: 10px 0 120px;
  cursor: text;
}
.date {
  margin: 0 0 14px;
  text-align: center;
  font-size: 11.5px;
  color: var(--text-2);
}
.content {
  max-width: 760px;
  margin: 0 auto;
  padding: 0 44px;
}
</style>

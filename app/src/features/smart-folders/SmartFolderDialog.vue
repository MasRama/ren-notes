<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useStore } from "../../app/context";
import { smartDialog } from "./dialog";

/** New or edit smart folder: a name and the rules a note must meet. */
const store = useStore();
const nameInput = ref<HTMLInputElement | null>(null);
const r = computed(() => smartDialog.rules);
const error = ref("");

const hasRule = computed(
  () =>
    r.value.tags.length > 0 ||
    r.value.editedWithinDays !== null ||
    r.value.createdWithinDays !== null ||
    r.value.hasChecklist ||
    r.value.hasAttachment ||
    r.value.pinned,
);
const canSave = computed(() => !!smartDialog.name.trim() && hasRule.value);

const periods = [
  { label: "Any time", value: null },
  { label: "Today", value: 1 },
  { label: "In the last 7 days", value: 7 },
  { label: "In the last 30 days", value: 30 },
  { label: "In the last year", value: 365 },
];

watch(
  () => smartDialog.open,
  async (open) => {
    if (!open) return;
    error.value = "";
    await nextTick();
    nameInput.value?.focus();
  },
);

function toggleTag(tag: string) {
  const tags = r.value.tags;
  r.value.tags = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
}

async function save() {
  if (!canSave.value) return;
  try {
    await store.saveSmartFolder(smartDialog.id, smartDialog.name.trim(), structuredClone({ ...r.value }));
    smartDialog.open = false;
  } catch (e) {
    error.value = (e as { message?: string }).message ?? "Can’t save this smart folder.";
  }
}
</script>

<template>
  <Transition name="sheet">
    <div v-if="smartDialog.open" class="scrim" @keydown.esc.stop="smartDialog.open = false" @mousedown.self="smartDialog.open = false">
      <form class="dialog" @submit.prevent="save">
        <h2>{{ smartDialog.id ? "Edit Smart Folder" : "New Smart Folder" }}</h2>
        <label class="field">
          <span>Name</span>
          <input ref="nameInput" v-model="smartDialog.name" placeholder="Smart Folder" spellcheck="false" />
        </label>

        <p class="hint">Show notes that have all of the following:</p>

        <div class="rule">
          <span class="label">Tags</span>
          <div class="tags">
            <button
              v-for="t in store.state.tags"
              :key="t.tag"
              type="button"
              class="chip"
              :class="{ on: r.tags.includes(t.tag) }"
              @click="toggleTag(t.tag)"
            >
              #{{ t.tag }}
            </button>
            <span v-if="!store.state.tags.length" class="none">Add #tags to notes to use them here.</span>
          </div>
        </div>
        <div v-if="r.tags.length > 1" class="rule">
          <span class="label" />
          <select v-model="r.tagMatch">
            <option value="any">Any of these tags</option>
            <option value="all">All of these tags</option>
          </select>
        </div>
        <div class="rule">
          <span class="label">Edited</span>
          <select v-model="r.editedWithinDays">
            <option v-for="p in periods" :key="String(p.value)" :value="p.value">{{ p.label }}</option>
          </select>
        </div>
        <div class="rule">
          <span class="label">Created</span>
          <select v-model="r.createdWithinDays">
            <option v-for="p in periods" :key="String(p.value)" :value="p.value">{{ p.label }}</option>
          </select>
        </div>
        <div class="rule">
          <span class="label">Includes</span>
          <div class="checks">
            <label><input v-model="r.hasChecklist" type="checkbox" /> Checklists</label>
            <label><input v-model="r.hasAttachment" type="checkbox" /> Attachments</label>
            <label><input v-model="r.pinned" type="checkbox" /> Pinned notes only</label>
          </div>
        </div>

        <p v-if="error" class="error">{{ error }}</p>
        <div class="buttons">
          <button type="button" class="btn" @click="smartDialog.open = false">Cancel</button>
          <button type="submit" class="btn primary" :disabled="!canSave">{{ smartDialog.id ? "Save" : "Create" }}</button>
        </div>
      </form>
    </div>
  </Transition>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 70px;
  background: rgba(0, 0, 0, 0.12);
}
.dialog {
  width: 440px;
  padding: 18px 20px 16px;
  border-radius: 12px;
  background: var(--menu);
  backdrop-filter: blur(30px) saturate(1.6);
  box-shadow: var(--shadow-pop);
  font-size: 13px;
}
h2 {
  margin: 0 0 14px;
  font-size: 14px;
  font-weight: 700;
}
.field {
  display: flex;
  align-items: center;
  gap: 10px;
}
.field span,
.label {
  width: 70px;
  flex: none;
  text-align: right;
  color: var(--text-2);
}
.field input {
  flex: 1;
  height: 26px;
  padding: 0 8px;
  border: 0;
  border-radius: 6px;
  outline: 0;
  background: var(--editor);
  box-shadow: inset 0 0 0 0.5px var(--line);
  user-select: text;
}
.field input:focus {
  box-shadow: 0 0 0 2.5px color-mix(in srgb, var(--accent) 60%, transparent);
}
.hint {
  margin: 16px 0 8px;
  color: var(--text-2);
  font-size: 12px;
}
.rule {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 8px 0;
}
.label {
  padding-top: 4px;
}
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.chip {
  height: 24px;
  padding: 0 10px;
  border-radius: 12px;
  background: var(--chip);
  font-size: 12px;
}
.chip.on {
  background: var(--select);
  color: var(--select-text);
}
.none {
  padding-top: 4px;
  color: var(--text-3);
  font-size: 12px;
}
select {
  height: 26px;
  padding: 0 6px;
  border: 0;
  border-radius: 6px;
  background: var(--editor);
  box-shadow: inset 0 0 0 0.5px var(--line);
  color: var(--text);
  font: inherit;
}
.checks {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 4px;
}
.checks input {
  accent-color: var(--accent);
  margin: 0 6px 0 0;
}
.error {
  color: var(--danger);
  font-size: 12px;
}
.buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}
.btn {
  min-width: 80px;
  height: 28px;
  padding: 0 14px;
  border-radius: 6px;
  background: var(--field);
}
.btn.primary {
  background: var(--accent);
  color: #1d1d1f;
  font-weight: 550;
}
.btn:disabled {
  opacity: 0.45;
}
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 140ms ease;
}
.sheet-enter-active .dialog {
  transition: transform 180ms var(--spring);
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .dialog {
  transform: translateY(-10px) scale(0.97);
}
</style>

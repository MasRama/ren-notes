<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useStore } from "../../app/context";
import { copyRules, smartDialog } from "./dialog";

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
    await store.saveSmartFolder(smartDialog.id, smartDialog.name.trim(), copyRules(r.value));
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
          <span class="popup">
            <select v-model="r.tagMatch">
              <option value="any">Any of these tags</option>
              <option value="all">All of these tags</option>
            </select>
          </span>
        </div>
        <div class="rule">
          <span class="label">Edited</span>
          <span class="popup">
            <select v-model="r.editedWithinDays">
              <option v-for="p in periods" :key="String(p.value)" :value="p.value">{{ p.label }}</option>
            </select>
          </span>
        </div>
        <div class="rule">
          <span class="label">Created</span>
          <span class="popup">
            <select v-model="r.createdWithinDays">
              <option v-for="p in periods" :key="String(p.value)" :value="p.value">{{ p.label }}</option>
            </select>
          </span>
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
  height: 24px;
  padding: 0 8px;
  border: 0;
  border-radius: 5px;
  outline: 0;
  background: var(--control);
  box-shadow: inset 0 0 0 0.5px var(--control-line);
  user-select: text;
}
.field input:focus {
  box-shadow:
    inset 0 0 0 0.5px var(--control-line),
    0 0 0 3px var(--focus-ring);
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
/* A Mac pop-up button: the menu's arrows sit in an accent-coloured box. */
.popup {
  position: relative;
  display: inline-flex;
}
.popup select {
  height: 24px;
  padding: 0 30px 0 9px;
  border: 0;
  border-radius: 5px;
  outline: 0;
  appearance: none;
  background: var(--control);
  box-shadow: var(--control-edge);
  color: var(--text);
  font: inherit;
}
.popup select:focus-visible {
  box-shadow:
    var(--control-edge),
    0 0 0 3px var(--focus-ring);
}
.popup::after {
  content: "";
  position: absolute;
  top: 3px;
  right: 3px;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: var(--accent) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 12'%3E%3Cpath d='M1.6 4.6 4 2.2l2.4 2.4M1.6 7.4 4 9.8l2.4-2.4' fill='none' stroke='white' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / 8px 12px no-repeat;
  pointer-events: none;
}
.checks {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding-top: 5px;
}
.checks label {
  display: flex;
  align-items: center;
  gap: 7px;
}
.checks input {
  flex: none;
  width: 14px;
  height: 14px;
  margin: 0;
  border-radius: 4px;
  outline: 0;
  appearance: none;
  background: var(--control);
  box-shadow: var(--control-edge);
}
.checks input:checked {
  background: var(--accent) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='m2 5.2 2 2L8 2.8' fill='none' stroke='white' stroke-width='1.7' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / 10px no-repeat;
  box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.12);
}
.checks input:focus-visible {
  box-shadow:
    var(--control-edge),
    0 0 0 3px var(--focus-ring);
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
  min-width: 76px;
  height: 24px;
  padding: 0 14px;
  border-radius: 5px;
  background: var(--control);
  box-shadow: var(--control-edge);
}
.btn.primary {
  background: var(--accent);
  box-shadow: inset 0 0.5px 0 rgba(255, 255, 255, 0.25), 0 0 0 0.5px rgba(0, 0, 0, 0.12);
  color: #1d1d1f;
  font-weight: 550;
}
.btn:focus-visible {
  box-shadow:
    var(--control-edge),
    0 0 0 3px var(--focus-ring);
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

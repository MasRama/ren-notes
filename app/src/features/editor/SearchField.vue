<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { signals, useStore } from "../../app/context";
import Icon from "../../shared/ui/Icon.vue";

/** The search field at the toolbar's right: a magnifier that opens into a
 * field, searching every note as you type. */
const store = useStore();
const text = ref(store.state.query);
const focused = ref(false);
const input = ref<HTMLInputElement | null>(null);
const open = computed(() => focused.value || !!text.value);
let timer: ReturnType<typeof setTimeout> | null = null;

watch(text, (q) => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void store.search(q), 120);
});
watch(
  () => store.state.query,
  (q) => {
    if (!q && text.value) text.value = "";
  },
);
watch(
  () => signals.focusSearch,
  async () => {
    focused.value = true;
    await nextTick();
    input.value?.focus();
    input.value?.select();
  },
);

function clear() {
  text.value = "";
  void store.search("");
  input.value?.blur();
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    clear();
  } else if (e.key === "Enter" || e.key === "ArrowDown") {
    e.preventDefault();
    store.state.focus = "list";
    signals.focusList++;
  }
}
</script>

<template>
  <label class="search" :class="{ open }" @mousedown="!open && (focused = true)">
    <Icon name="search" :size="16" />
    <input
      ref="input"
      v-model="text"
      type="search"
      placeholder="Search"
      spellcheck="false"
      @focus="focused = true"
      @blur="focused = false"
      @keydown="onKey"
    />
    <button v-if="text" class="clear" aria-label="Clear search" @mousedown.prevent @click="clear">
      <Icon name="clear" :size="14" />
    </button>
  </label>
</template>

<style scoped>
.search {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 32px;
  height: 28px;
  padding: 0 8px;
  border-radius: 7px;
  color: var(--text-2);
  transition:
    width 220ms var(--ease-out),
    background 160ms;
  overflow: hidden;
}
.search:hover {
  background: var(--hover);
}
.search.open {
  width: 190px;
  background: var(--field);
}
input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: none;
  font-size: 13px;
  color: var(--text);
  user-select: text;
}
input::-webkit-search-cancel-button {
  display: none;
}
input::placeholder {
  color: var(--text-2);
}
.clear {
  display: grid;
  color: var(--text-3);
  --clear-x: var(--window);
}
</style>

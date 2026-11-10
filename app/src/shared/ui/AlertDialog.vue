<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { alertState, answer } from "./dialog";

const ok = ref<HTMLButtonElement | null>(null);
watch(
  () => alertState.open,
  async (open) => {
    if (open) {
      await nextTick();
      ok.value?.focus();
    }
  },
);
</script>

<template>
  <Transition name="sheet">
    <div v-if="alertState.open && alertState.options" class="scrim" @keydown.esc.stop="answer(false)">
      <div class="alert" role="alertdialog" aria-modal="true" :aria-label="alertState.options.title">
        <img class="app" src="/icon.png" alt="" />
        <h2>{{ alertState.options.title }}</h2>
        <p v-if="alertState.options.message">{{ alertState.options.message }}</p>
        <div class="buttons">
          <button class="btn" @click="answer(false)">Cancel</button>
          <button ref="ok" class="btn primary" :class="{ danger: alertState.options.danger }" @click="answer(true)">
            {{ alertState.options.confirm }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 90;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.12);
}
.alert {
  width: 280px;
  padding: 20px 16px 16px;
  border-radius: 12px;
  background: var(--menu);
  backdrop-filter: var(--menu-blur);
  box-shadow: var(--shadow-pop);
  text-align: center;
}
.app {
  width: 56px;
  height: 56px;
}
h2 {
  margin: 8px 0 6px;
  font-size: 13px;
  font-weight: 700;
}
p {
  margin: 0 0 14px;
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--text);
}
.buttons {
  display: flex;
  gap: 8px;
}
.btn {
  flex: 1;
  height: 28px;
  border-radius: 6px;
  background: var(--field);
  font-size: 13px;
}
.btn:active {
  background: var(--press);
}
.btn.primary {
  background: var(--accent);
  color: #1d1d1f;
  font-weight: 500;
}
.btn.primary.danger {
  background: var(--danger);
  color: #fff;
}
.sheet-enter-active {
  transition: opacity 140ms ease;
}
.sheet-enter-active .alert {
  transition: transform 160ms var(--spring);
}
.sheet-leave-active {
  transition: opacity 100ms ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .alert {
  transform: scale(0.95);
}
</style>

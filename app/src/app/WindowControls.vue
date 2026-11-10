<script setup lang="ts">
import { appWindow } from "./window";

defineProps<{ active: boolean }>();

const close = async () => (await appWindow())?.close();
const minimize = async () => (await appWindow())?.minimize();
const zoom = async () => (await appWindow())?.toggleMaximize();
</script>

<template>
  <div class="lights" :class="{ inactive: !active }">
    <button class="light close" aria-label="Close" @click="close">
      <svg viewBox="0 0 12 12"><path d="M3.6 3.6l4.8 4.8M8.4 3.6 3.6 8.4" /></svg>
    </button>
    <button class="light min" aria-label="Minimise" @click="minimize">
      <svg viewBox="0 0 12 12"><path d="M3 6h6" /></svg>
    </button>
    <button class="light zoom" aria-label="Zoom" @click="zoom">
      <svg viewBox="0 0 12 12"><path d="M3.5 7.8V3.5h4.3zM8.5 4.2v4.3H4.2z" fill="currentColor" stroke="none" /></svg>
    </button>
  </div>
</template>

<style scoped>
.lights {
  display: flex;
  gap: 8px;
  padding: 4px;
}
.light {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.18);
  color: rgba(0, 0, 0, 0.55);
}
.close {
  background: #ff5f57;
}
.min {
  background: #febc2e;
}
.zoom {
  background: #28c840;
}
.inactive .light {
  background: var(--select-2);
}
.light svg {
  width: 10px;
  height: 10px;
  stroke: currentColor;
  stroke-width: 1.3;
  stroke-linecap: round;
  opacity: 0;
}
.lights:hover .light svg {
  opacity: 1;
}
.lights:hover .close {
  background: #ff5f57;
}
.lights:hover .min {
  background: #febc2e;
}
.lights:hover .zoom {
  background: #28c840;
}
.light:active {
  filter: brightness(0.85);
}
</style>

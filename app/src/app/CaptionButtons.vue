<script setup lang="ts">
import { appWindow } from "./window";

/** Windows' caption buttons, drawn by the page as the window has no frame:
 * the Mac's lights would be a stranger there. */
defineProps<{ active: boolean; maximized: boolean }>();

const minimize = async () => (await appWindow())?.minimize();
const toggleMaximize = async () => (await appWindow())?.toggleMaximize();
const close = async () => (await appWindow())?.close();
</script>

<template>
  <div class="captions" :class="{ inactive: !active }">
    <button class="caption" aria-label="Minimise" tabindex="-1" @click="minimize">
      <svg viewBox="0 0 10 10"><path d="M0 5.5h10" /></svg>
    </button>
    <button class="caption" :aria-label="maximized ? 'Restore' : 'Maximise'" tabindex="-1" @click="toggleMaximize">
      <svg v-if="maximized" viewBox="0 0 10 10">
        <rect x="0.5" y="2.5" width="7" height="7" rx="1" />
        <path d="M2.5 2.5V1.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1" />
      </svg>
      <svg v-else viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" rx="1" /></svg>
    </button>
    <button class="caption close" aria-label="Close" tabindex="-1" @click="close">
      <svg viewBox="0 0 10 10"><path d="M0.5 0.5l9 9M9.5 0.5l-9 9" /></svg>
    </button>
  </div>
</template>

<style scoped>
.captions {
  position: absolute;
  z-index: 30;
  top: 0;
  right: 0;
  display: flex;
}
.caption {
  width: 46px;
  height: var(--toolbar-h);
  display: grid;
  place-items: center;
  color: var(--text);
  transition: background-color 120ms ease;
}
.inactive .caption {
  color: var(--text-3);
}
.caption:hover {
  background: var(--hover);
  color: var(--text);
}
.caption:active {
  background: var(--press);
}
.close:hover,
.close:active {
  background: #c42b1c;
  color: #fff;
}
.close:active {
  background: #c83c31;
}
svg {
  width: 10px;
  height: 10px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1;
  shape-rendering: geometricPrecision;
}
</style>

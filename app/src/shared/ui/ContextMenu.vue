<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { closeMenu, menu, type MenuItem } from "./menu";

const el = ref<HTMLElement | null>(null);
const pos = ref({ left: 0, top: 0 });
const active = ref(-1);

const items = computed(() => menu.items);
const actionable = (i: MenuItem) => !i.separator && !i.disabled;

watch(
  () => menu.open && menu.x + menu.y,
  async () => {
    if (!menu.open) return;
    active.value = -1;
    pos.value = { left: menu.x, top: menu.y };
    await nextTick();
    const r = el.value?.getBoundingClientRect();
    if (!r) return;
    pos.value = {
      left: Math.max(6, Math.min(menu.x, window.innerWidth - r.width - 6)),
      top: Math.max(6, menu.y + r.height > window.innerHeight - 6 ? menu.y - r.height : menu.y),
    };
  },
);

function run(item: MenuItem) {
  if (!actionable(item) || item.separator) return;
  closeMenu();
  item.action?.();
}

function onKey(e: KeyboardEvent) {
  if (!menu.open) return;
  const list = items.value;
  const move = (d: number) => {
    for (let i = 1; i <= list.length; i++) {
      const n = (active.value + d * i + list.length * 2) % list.length;
      if (actionable(list[n])) return (active.value = n);
    }
  };
  if (e.key === "Escape") closeMenu();
  else if (e.key === "ArrowDown") move(1);
  else if (e.key === "ArrowUp") move(-1);
  else if (e.key === "Enter" && active.value >= 0) run(list[active.value]);
  else return;
  e.preventDefault();
  e.stopPropagation();
}

function onDown(e: PointerEvent) {
  if (menu.open && !el.value?.contains(e.target as Node)) closeMenu();
}

onMounted(() => {
  window.addEventListener("keydown", onKey, true);
  window.addEventListener("pointerdown", onDown, true);
  window.addEventListener("blur", closeMenu);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey, true);
  window.removeEventListener("pointerdown", onDown, true);
  window.removeEventListener("blur", closeMenu);
});
</script>

<template>
  <Transition name="pop">
    <div
      v-if="menu.open"
      ref="el"
      class="menu"
      role="menu"
      :style="{ left: `${pos.left}px`, top: `${pos.top}px` }"
      @contextmenu.prevent
    >
      <template v-for="(item, i) in items" :key="i">
        <div v-if="item.separator" class="sep" />
        <button
          v-else
          class="item"
          role="menuitem"
          :class="{ active: i === active, danger: item.danger }"
          :disabled="item.disabled"
          @pointerenter="active = actionable(item) ? i : -1"
          @click="run(item)"
        >
          <span class="tick">{{ item.checked ? "✓" : "" }}</span>
          <span class="label">{{ item.label }}</span>
          <span v-if="item.shortcut" class="key">{{ item.shortcut }}</span>
        </button>
      </template>
    </div>
  </Transition>
</template>

<style scoped>
.menu {
  position: fixed;
  z-index: 100;
  min-width: 200px;
  padding: 5px;
  border-radius: 9px;
  background: var(--menu);
  backdrop-filter: var(--menu-blur);
  box-shadow: var(--shadow-pop);
  font-size: 13px;
  transform-origin: top left;
}
.item {
  display: flex;
  align-items: center;
  width: 100%;
  height: 24px;
  padding: 0 10px 0 4px;
  border-radius: 5px;
  text-align: left;
  white-space: nowrap;
}
.item.active {
  background: var(--accent);
  color: #1d1d1f;
}
.item:disabled {
  color: var(--text-3);
}
.item.danger:not(.active) {
  color: var(--danger);
}
.tick {
  width: 18px;
  text-align: center;
  font-size: 11px;
}
.label {
  flex: 1;
}
.key {
  margin-left: 24px;
  color: var(--text-2);
  font-size: 12px;
}
.item.active .key {
  color: inherit;
  opacity: 0.7;
}
.sep {
  height: 1px;
  margin: 5px 10px;
  background: var(--menu-line);
}
.pop-enter-active {
  transition:
    opacity 120ms ease,
    transform 140ms var(--spring);
}
.pop-leave-active {
  transition: opacity 100ms ease;
}
.pop-enter-from {
  opacity: 0;
  transform: scale(0.96);
}
.pop-leave-to {
  opacity: 0;
}
</style>

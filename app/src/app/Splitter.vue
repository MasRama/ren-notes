<script setup lang="ts">
/** A pane edge you can drag; reports the new width. */
const props = defineProps<{ width: number; min: number; max: number }>();
const emit = defineEmits<{ resize: [width: number]; done: [] }>();

function start(e: PointerEvent) {
  const x0 = e.clientX;
  const w0 = props.width;
  const target = e.currentTarget as HTMLElement;
  target.setPointerCapture(e.pointerId);
  const move = (m: PointerEvent) =>
    emit("resize", Math.round(Math.min(props.max, Math.max(props.min, w0 + m.clientX - x0))));
  const up = () => {
    target.removeEventListener("pointermove", move);
    target.removeEventListener("pointerup", up);
    emit("done");
  };
  target.addEventListener("pointermove", move);
  target.addEventListener("pointerup", up);
}
</script>

<template>
  <div class="splitter" @pointerdown.prevent="start" />
</template>

<style scoped>
.splitter {
  flex: none;
  width: 1px;
  margin: 0 -3px;
  padding: 0 3px;
  box-sizing: content-box;
  background: var(--line);
  background-clip: content-box;
  cursor: col-resize;
  position: relative;
  z-index: 5;
}
</style>

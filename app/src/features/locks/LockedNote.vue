<script setup lang="ts">
import { nextTick, ref } from "vue";
import { useStore } from "../../app/context";
import Icon from "../../shared/ui/Icon.vue";

/** Shown in place of a locked note while locked notes are closed. */
const store = useStore();
const s = store.state;

const password = ref("");
const input = ref<HTMLInputElement | null>(null);
const wrong = ref(false);
const shake = ref(0);
const busy = ref(false);

async function submit() {
  if (!password.value || busy.value) return;
  busy.value = true;
  try {
    if (await store.openLocked(password.value)) return;
    wrong.value = true;
    shake.value++;
    password.value = "";
    await nextTick();
    input.value?.focus();
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="rn-locked">
    <Icon class="mark" name="lock" :size="44" />
    <h2>This note is locked.</h2>
    <p>Enter the notes password to view locked notes.</p>
    <form :key="shake" :class="{ shake: shake > 0 }" @submit.prevent="submit">
      <input
        ref="input"
        v-model="password"
        type="password"
        placeholder="Password"
        aria-label="Notes password"
        autocomplete="off"
        spellcheck="false"
        @keydown.stop
      />
    </form>
    <p v-if="wrong" class="hint">
      <template v-if="s.locks.hint">Hint: {{ s.locks.hint }}</template>
      <template v-else>That password is wrong.</template>
    </p>
  </div>
</template>

<style scoped>
.rn-locked {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 18vh;
  text-align: center;
  cursor: default;
}
.mark {
  color: var(--text-2);
  stroke-width: 1.3;
}
h2 {
  margin: 14px 0 4px;
  font-size: 15px;
  font-weight: 600;
}
p {
  margin: 0;
  font-size: 12px;
  color: var(--text-2);
}
form {
  margin-top: 16px;
}
input {
  width: 220px;
  height: 26px;
  padding: 0 9px;
  border: 0;
  border-radius: 6px;
  outline: 0;
  background: var(--field);
  box-shadow: inset 0 0 0 0.5px var(--line);
  font-size: 13px;
  color: var(--text);
  text-align: center;
}
input:focus {
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.hint {
  margin-top: 10px;
}
.shake {
  animation: shake 360ms var(--ease-out);
}
@keyframes shake {
  20%,
  60% {
    transform: translateX(-7px);
  }
  40%,
  80% {
    transform: translateX(7px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .shake {
    animation: none;
  }
}
</style>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";
import Icon from "../../shared/ui/Icon.vue";
import { passwordSheet } from "./flow";

const request = computed(() => passwordSheet.request);
const creating = computed(() => request.value?.mode === "create");

const values = reactive({ password: "", verify: "", hint: "" });
const error = ref("");
const busy = ref(false);
const first = ref<HTMLInputElement | null>(null);

watch(
  request,
  async (now) => {
    Object.assign(values, { password: "", verify: "", hint: "" });
    error.value = "";
    if (!now) return;
    await nextTick();
    first.value?.focus();
  },
  { immediate: true },
);

async function submit() {
  const asked = request.value;
  if (!asked || busy.value) return;
  busy.value = true;
  try {
    const problem = await asked.submit({ ...values });
    if (problem && passwordSheet.request === asked) {
      error.value = problem;
      values.password = "";
      values.verify = "";
      await nextTick();
      first.value?.focus();
    }
  } finally {
    busy.value = false;
  }
}

const cancel = () => request.value?.done(false);
</script>

<template>
  <Transition name="sheet">
    <div v-if="request" class="scrim" @mousedown.self="cancel">
      <form
        class="sheet"
        role="dialog"
        aria-modal="true"
        :aria-label="creating ? 'Create a password' : 'Enter the notes password'"
        @submit.prevent="submit"
        @keydown.esc.prevent.stop="cancel"
      >
        <Icon class="mark" name="lock" :size="34" />
        <h2>{{ creating ? "Create a password for locked notes" : "Enter the notes password" }}</h2>
        <input
          ref="first"
          v-model="values.password"
          name="password"
          type="password"
          placeholder="Password"
          autocomplete="off"
          spellcheck="false"
        />
        <template v-if="creating">
          <input
            v-model="values.verify"
            name="verify"
            type="password"
            placeholder="Verify"
            autocomplete="off"
            spellcheck="false"
          />
          <input v-model="values.hint" name="hint" placeholder="Password hint (recommended)" spellcheck="false" />
          <p class="note">If you forget this password, you won’t be able to view your locked notes.</p>
        </template>
        <p v-if="error" class="error" role="alert">{{ error }}</p>
        <div class="buttons">
          <button type="button" class="btn cancel" @click="cancel">Cancel</button>
          <button type="submit" class="btn primary" :disabled="busy">{{ creating ? "Set Password" : "OK" }}</button>
        </div>
      </form>
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
.sheet {
  width: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px 16px 16px;
  border-radius: 12px;
  background: var(--menu);
  backdrop-filter: var(--menu-blur);
  box-shadow: var(--shadow-pop);
  text-align: center;
}
.mark {
  color: var(--text-2);
  stroke-width: 1.4;
}
h2 {
  margin: 2px 0 6px;
  font-size: 13px;
  font-weight: 700;
}
input {
  width: 100%;
  height: 26px;
  padding: 0 9px;
  border: 0;
  border-radius: 6px;
  outline: 0;
  background: var(--field);
  box-shadow: inset 0 0 0 0.5px var(--line);
  font-size: 13px;
  color: var(--text);
}
input:focus {
  box-shadow: 0 0 0 3px var(--focus-ring);
}
.note,
.error {
  margin: 2px 0 0;
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--text-2);
}
.error {
  color: var(--danger);
}
.buttons {
  align-self: stretch;
  display: flex;
  gap: 8px;
  margin-top: 8px;
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
.sheet-enter-active {
  transition: opacity 140ms ease;
}
.sheet-enter-active .sheet {
  transition: transform 160ms var(--spring);
}
.sheet-leave-active {
  transition: opacity 100ms ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .sheet {
  transform: scale(0.95);
}
</style>

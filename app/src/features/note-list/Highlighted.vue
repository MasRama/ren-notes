<script setup lang="ts">
import { computed } from "vue";
import { highlightParts } from "./actions";

const props = defineProps<{ text: string; terms: string[] }>();
const parts = computed(() => highlightParts(props.text, props.terms));
</script>

<template>
  <template v-for="(p, i) in parts" :key="i"><mark v-if="p.match">{{ p.text }}</mark><template v-else>{{ p.text }}</template></template>
</template>

<style scoped>
mark {
  background: var(--match);
  color: inherit;
  border-radius: 2px;
}
</style>

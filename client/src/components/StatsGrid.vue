<script setup>
import { computed } from 'vue';

/**
 * Renders a statistics object ({inSurvey, completed, screenOut, …,
 * currentCost}) as labelled tiles. Works for project, survey and quota
 * statistics — they share the same shape.
 */
const props = defineProps({
  stats: { type: Object, required: true },
});

const FIELDS = [
  ['completed', 'Completed'],
  ['inSurvey', 'In survey'],
  ['screenOut', 'Screen-outs'],
  ['quotaFull', 'Quota full'],
  ['qualityTerminate', 'Quality terminates'],
  ['timedOut', 'Timed out'],
  ['dropoutRate', 'Drop-out rate'],
  ['incidenceRate', 'Incidence rate'],
  ['lengthOfInterview', 'Avg. LOI'],
  ['currentCost', 'Current cost'],
];

const tiles = computed(() =>
  FIELDS.filter(([key]) => key in props.stats)
    .map(([key, label]) => ({ key, label, value: props.stats[key] === '' ? '—' : props.stats[key] })),
);
</script>

<template>
  <div class="grid">
    <div v-for="tile in tiles" :key="tile.key" class="tile" :class="{ highlight: tile.key === 'currentCost' }">
      <span class="value">{{ tile.value }}</span>
      <span class="label">{{ tile.label }}</span>
    </div>
  </div>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
  gap: 0.6rem;
  margin: 0.75rem 0;
}
.tile {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.6rem 0.8rem;
  display: flex;
  flex-direction: column;
}
.tile.highlight { border-color: var(--accent); background: var(--accent-soft); }
.value { font-size: 1.25rem; font-weight: 700; }
.label { font-size: 0.75rem; color: var(--text-soft); }
</style>

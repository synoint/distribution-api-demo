<script setup>
import { computed } from 'vue';
import { useConstants } from '@/composables/useConstants';

/** Colored label for a survey or response status id. */
const props = defineProps({
  status: { type: Number, required: true },
  kind: { type: String, default: 'survey' }, // 'survey' | 'response'
});

const constants = useConstants();

const label = computed(() => {
  const labels = props.kind === 'response'
    ? constants.value?.responseStatusLabels
    : constants.value?.surveyStatusLabels;
  return labels?.[props.status] ?? `#${props.status}`;
});

const tone = computed(() => {
  if (props.kind === 'response') {
    return { 5: 'ok', 2: 'warn', 3: 'warn', 11: 'warn', 4: 'danger', 6: 'danger' }[props.status] ?? 'neutral';
  }
  return { 3: 'ok', 2: 'ok', 4: 'warn', 7: 'warn', 5: 'neutral', 6: 'danger', 8: 'danger' }[props.status] ?? 'neutral';
});
</script>

<template>
  <span class="badge" :data-tone="tone">{{ label }}</span>
</template>

<style scoped>
.badge {
  display: inline-block;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.1rem 0.6rem;
  border-radius: 999px;
  background: var(--border);
}
.badge[data-tone="ok"] { background: var(--ok-soft); color: var(--ok); }
.badge[data-tone="warn"] { background: var(--warn-bg); color: #9a6700; }
.badge[data-tone="danger"] { background: var(--danger-soft); color: var(--danger); }
</style>

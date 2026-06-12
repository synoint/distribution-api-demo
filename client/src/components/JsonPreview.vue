<script setup>
/**
 * Collapsible "what was sent / what came back" panel — lets readers see the
 * exact JSON of each API exchange.
 */
defineProps({
  title: { type: String, default: 'JSON' },
  value: { required: true },
  open: { type: Boolean, default: false },
});
</script>

<template>
  <details class="json-preview" :open="open">
    <summary>{{ title }}</summary>
    <pre>{{ JSON.stringify(value, null, 2) }}</pre>
  </details>
</template>

<style scoped>
.json-preview { margin: 0.6rem 0; }
summary {
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-soft);
}
pre {
  background: #20262e;
  color: #d6e2f0;
  font-family: var(--mono);
  font-size: 0.8rem;
  padding: 0.8rem 1rem;
  border-radius: var(--radius);
  overflow: auto;
  max-height: 24rem;
}
</style>

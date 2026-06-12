<script setup>
/**
 * Shows which Distribution API endpoint a piece of UI uses — the demo's
 * core teaching device. Example: <EndpointBadge method="POST" path="/samples" />
 */
defineProps({
  method: { type: String, required: true },
  path: { type: String, required: true },
});
</script>

<template>
  <span class="endpoint" :data-method="method">
    <strong>{{ method }}</strong> {{ path }}
  </span>
</template>

<style scoped>
.endpoint {
  display: inline-block;
  font-family: var(--mono);
  font-size: 0.78rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 0.12rem 0.65rem;
  margin: 0.1rem 0.3rem 0.1rem 0;
  background: var(--surface);
  color: var(--text-soft);
}
.endpoint strong { color: var(--ok); }
.endpoint[data-method="POST"] strong { color: var(--accent); }
.endpoint[data-method="PATCH"] strong { color: #9a6700; }
</style>

<script setup>
/**
 * Highlighted note for endpoints whose behavior differs for test accounts.
 * Used wherever filters are skipped or data is restricted by the API.
 */
</script>

<template>
  <p class="disclaimer">
    ⚠ <strong>Test mode:</strong> <slot />
  </p>
</template>

<style scoped>
.disclaimer {
  background: var(--warn-bg);
  border: 1px solid var(--warn-border);
  border-radius: var(--radius);
  padding: 0.5rem 0.8rem;
  font-size: 0.85rem;
}
</style>

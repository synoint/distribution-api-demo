<script setup>
import { ref } from 'vue';

/**
 * Native <dialog>-based confirmation. Used for every survey status change —
 * setting a survey Live starts real, billable fieldwork, so the demo never
 * mutates lifecycle state without an explicit confirmation.
 */
defineProps({
  title: { type: String, default: 'Are you sure?' },
  confirmLabel: { type: String, default: 'Confirm' },
  danger: { type: Boolean, default: false },
});

const emit = defineEmits(['confirm']);
const dialog = ref(null);

function open() { dialog.value.showModal(); }
function close() { dialog.value.close(); }
function confirm() { close(); emit('confirm'); }

defineExpose({ open, close });
</script>

<template>
  <dialog ref="dialog">
    <h3>{{ title }}</h3>
    <div class="body"><slot /></div>
    <div class="actions">
      <button class="secondary" type="button" @click="close">Cancel</button>
      <button :class="{ danger }" type="button" @click="confirm">{{ confirmLabel }}</button>
    </div>
  </dialog>
</template>

<style scoped>
dialog {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem 1.5rem;
  max-width: 28rem;
  box-shadow: 0 12px 40px rgb(0 0 0 / 0.18);
}
dialog::backdrop { background: rgb(15 20 30 / 0.45); }
h3 { margin-top: 0; }
.body { color: var(--text-soft); }
.actions { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.25rem; }
</style>

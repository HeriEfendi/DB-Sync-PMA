<template>
  <div
    v-if="dialog.open"
    class="confirm-modal-backdrop"
    @click.self="$emit('cancel')"
  >
    <section
      class="confirm-dialog"
      :class="{ 'confirm-dialog-input': dialog.mode === 'input' }"
      :role="dialog.mode === 'input' ? 'dialog' : 'alertdialog'"
      aria-modal="true"
      aria-labelledby="action-dialog-title"
      :aria-describedby="dialog.mode === 'confirm' ? 'action-dialog-message' : undefined"
      tabindex="-1"
      @keydown.esc.prevent.stop="$emit('cancel')"
    >
      <div v-if="dialog.mode === 'confirm'" class="confirm-dialog-icon" aria-hidden="true">!</div>
      <div class="confirm-dialog-copy">
        <span class="eyebrow">{{ dialog.mode === 'input' ? 'INPUT' : 'KONFIRMASI' }}</span>
        <h2 id="action-dialog-title">{{ dialog.title }}</h2>
        <p v-if="dialog.mode === 'confirm'" id="action-dialog-message">{{ dialog.message }}</p>
        <input
          v-else
          v-model="dialog.value"
          class="form-input action-dialog-input"
          type="text"
          :placeholder="dialog.placeholder"
          autofocus
          @keydown.enter.prevent="$emit('confirm', dialog.value.trim() || null)"
        />
      </div>
      <div class="confirm-dialog-actions">
        <button class="btn btn-secondary btn-sm" type="button" @click="$emit('cancel')">
          Batal
        </button>
        <button
          class="btn btn-sm"
          :class="dialog.mode === 'input' ? 'btn-primary' : 'btn-danger'"
          type="button"
          :disabled="dialog.mode === 'input' && !dialog.value.trim()"
          @click="$emit('confirm', dialog.mode === 'input' ? dialog.value.trim() : true)"
        >
          {{ dialog.confirmLabel }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup>
defineProps({
  dialog: {
    type: Object,
    required: true,
  },
});

defineEmits(['confirm', 'cancel']);
</script>


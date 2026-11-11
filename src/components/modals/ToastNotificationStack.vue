<template>
  <div class="toast-stack" role="status" aria-live="polite" aria-atomic="false">
    <TransitionGroup name="toast">
      <article
        v-for="toast in toasts"
        :key="toast.id"
        class="app-toast"
        :class="`app-toast-${toast.type}`"
      >
        <span class="toast-icon" aria-hidden="true">
          {{ toast.type === 'success' ? '✓' : toast.type === 'error' ? '!' : 'i' }}
        </span>
        <div class="toast-copy">
          <strong>{{ toast.title }}</strong>
          <p>{{ toast.message }}</p>
        </div>
        <button
          class="toast-close"
          type="button"
          :aria-label="`Tutup notifikasi: ${toast.title}`"
          @click="$emit('dismiss', toast.id)"
        >
          ×
        </button>
      </article>
    </TransitionGroup>
  </div>
</template>

<script setup>
defineProps({
  toasts: {
    type: Array,
    required: true,
  },
});

defineEmits(['dismiss']);
</script>


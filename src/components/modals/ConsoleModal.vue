<template>
  <div>
    <!-- Floating Dialog -->
    <div
      v-if="show"
      v-show="!minimized"
      class="console-modal-backdrop"
      @click.self="$emit('close')"
    >
      <section
        class="console-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Console log sinkronisasi"
      >
        <header class="floating-console-titlebar">
          <div class="floating-console-title">
            <span class="console-live-dot" :class="{ active: isSyncing }"></span>
            <strong>Console Log</strong>
            <span class="console-count">{{ logs.length }} entri</span>
          </div>
          <div class="window-controls">
            <button
              class="window-control"
              type="button"
              aria-label="Minimalkan console"
              title="Minimalkan"
              @click="$emit('update:minimized', true)"
            >
              −
            </button>
            <button
              class="window-control"
              type="button"
              aria-label="Tutup console; sinkronisasi tetap berjalan"
              title="Tutup"
              @click="$emit('close')"
            >
              ×
            </button>
          </div>
        </header>
        <div class="floating-console-content">
          <LogConsole :logs="logs" @clear-logs="$emit('clear-logs')" />
        </div>
      </section>
    </div>

    <!-- Minimized Dock -->
    <div
      v-if="show"
      v-show="minimized"
      class="console-minimized-dock"
      role="region"
      aria-label="Console log diminimalkan"
    >
      <header class="floating-console-titlebar">
        <div class="floating-console-title">
          <span class="console-live-dot" :class="{ active: isSyncing }"></span>
          <strong>Console Log</strong>
          <span class="console-count">{{ logs.length }} entri</span>
        </div>
        <div class="window-controls">
          <button
            class="window-control"
            type="button"
            aria-label="Buka kembali console"
            title="Buka kembali"
            @click="$emit('update:minimized', false)"
          >
            □
          </button>
          <button
            class="window-control"
            type="button"
            aria-label="Tutup console; sinkronisasi tetap berjalan"
            title="Tutup"
            @click="$emit('close')"
          >
            ×
          </button>
        </div>
      </header>
    </div>
  </div>
</template>

<script setup>
import LogConsole from '../LogConsole.vue';

defineProps({
  show: { type: Boolean, default: false },
  minimized: { type: Boolean, default: false },
  isSyncing: { type: Boolean, default: false },
  logs: { type: Array, default: () => [] },
});

defineEmits(['close', 'update:minimized', 'clear-logs']);
</script>


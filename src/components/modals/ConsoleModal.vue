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
        class="console-dialog !max-w-[1180px]"
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
        <div class="floating-console-content flex flex-col overflow-hidden md:flex-row">
          <div class="min-h-0 min-w-0 flex-1 flex flex-col">
            <LogConsole
              class="!h-full !min-h-0 !max-h-none !rounded-none !border-0 flex-1"
              :logs="logs"
              :table-filter="selectedLogTable"
              @clear-table-filter="selectedLogTable = ''"
              @clear-logs="$emit('clear-logs')"
            />
          </div>
          <SyncTableStatusSidebar
            :tables="resolvedTables"
            :selected-table="selectedLogTable"
            @select-table="selectedLogTable = $event"
          />
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
import { computed, ref } from 'vue';
import LogConsole from '../LogConsole.vue';
import SyncTableStatusSidebar from './SyncTableStatusSidebar.vue';

const props = defineProps({
  show: { type: Boolean, default: false },
  minimized: { type: Boolean, default: false },
  isSyncing: { type: Boolean, default: false },
  logs: { type: Array, default: () => [] },
  tableStatuses: { type: Array, default: () => [] },
  selectedTables: { type: Array, default: () => [] },
});

defineEmits(['close', 'update:minimized', 'clear-logs']);

const selectedLogTable = ref('');

const resolvedTables = computed(() => {
  if (props.tableStatuses && props.tableStatuses.length > 0) {
    return props.tableStatuses;
  }
  return (props.selectedTables || []).map((t) => ({
    name: typeof t === 'string' ? t : t.name,
    status: 'pending',
    detail: 'Siap disinkronkan',
  }));
});
</script>


<template>
  <div data-ui="logs" class="glass-panel log-console-card">
    <!-- Log Console Toolbar -->
    <div class="console-toolbar">
      <div class="toolbar-left">
        <span class="console-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
          Console Log Sinkronisasi
        </span>
        <span class="log-count">({{ filteredLogs.length }} entri)</span>
      </div>

      <!-- Filter Buttons & Search -->
      <div class="toolbar-right">
        <div class="filter-pills">
          <button
            v-for="lvl in ['all', 'info', 'success', 'warning', 'error']"
            :key="lvl"
            class="filter-pill"
            :class="{ active: currentFilter === lvl, [lvl]: true }"
            @click="currentFilter = lvl"
          >
            {{ lvl.toUpperCase() }}
          </button>
        </div>

        <input
          v-model="searchQuery"
          type="text"
          class="form-input search-input"
          placeholder="Cari log..."
        />

        <button class="btn btn-secondary btn-icon" title="Salin Log" @click="copyLogs">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>

        <button class="btn btn-danger btn-icon" title="Bersihkan Log" @click="$emit('clear-logs')">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    </div>

    <!-- Log Display Window -->
    <div ref="logContainer" class="log-window font-mono">
      <div v-if="filteredLogs.length === 0" class="empty-log">
        <span>Belum ada log aktivitas sinkronisasi. Tekan "Mulai Sinkronisasi Data" untuk melihat alur kerja.</span>
      </div>

      <div
        v-for="(log, idx) in filteredLogs"
        :key="idx"
        class="log-row"
        :class="`log-${log.type === 'warn' ? 'warning' : log.type}`"
      >
        <span class="log-time">[{{ log.timestamp }}]</span>
        <span class="log-level-badge">{{ (log.type === 'warn' ? 'WARNING' : log.type).toUpperCase() }}</span>
        <span class="log-msg">{{ log.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue';

const props = defineProps({
  logs: { type: Array, default: () => [] },
});

defineEmits(['clear-logs']);

const logContainer = ref(null);
const currentFilter = ref('all');
const searchQuery = ref('');

const MAX_DISPLAY_LOGS = 500;

const filteredLogs = computed(() => {
  if (!props.logs || props.logs.length === 0) return [];
  const query = searchQuery.value ? searchQuery.value.toLowerCase().trim() : '';
  const filter = currentFilter.value;

  // Build a trimmed list that always keeps warning/error logs
  let trimmed;
  if (props.logs.length <= MAX_DISPLAY_LOGS) {
    trimmed = props.logs.map((log, i) => ({ log, idx: i }));
  } else {
    // 1. Collect ALL warning/error logs (always preserved)
    const critical = [];
    const normal = [];
    for (let i = 0; i < props.logs.length; i++) {
      const t = props.logs[i].type;
      if (t === 'warning' || t === 'warn' || t === 'error') {
        critical.push({ log: props.logs[i], idx: i });
      } else {
        normal.push({ log: props.logs[i], idx: i });
      }
    }

    // 2. Fill remaining slots with the most recent normal logs
    const remainingSlots = Math.max(0, MAX_DISPLAY_LOGS - critical.length);
    const recentNormal = normal.slice(-remainingSlots);

    // 3. Merge and sort by original index to maintain chronological order
    trimmed = [...critical, ...recentNormal].sort((a, b) => a.idx - b.idx);
  }

  // Apply filter & search on top of the trimmed set
  const result = [];
  for (const { log } of trimmed) {
    const normalizedType = log.type === 'warn' ? 'warning' : log.type;
    if (filter !== 'all' && normalizedType !== filter) continue;
    if (query && !log.message.toLowerCase().includes(query)) continue;
    result.push(log);
  }
  return result;
});

// Auto-scroll to bottom on new log entry (standard terminal behavior)
watch(
  () => props.logs.length,
  async () => {
    await nextTick();
    if (logContainer.value) {
      logContainer.value.scrollTop = logContainer.value.scrollHeight;
    }
  }
);

const copyLogs = () => {
  const text = props.logs.map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
  navigator.clipboard.writeText(text);
  alert('Seluruh log berhasil disalin ke clipboard!');
};
</script>

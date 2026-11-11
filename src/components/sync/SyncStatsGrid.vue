<template>
  <div class="stats-grid">
    <div class="stat-card" :class="{ 'stat-highlight': isSyncing }">
      <span class="stat-value text-emerald">
        {{ isSyncing ? formatNumber(syncProgress.totalSyncedAllTables) : formatNumber(stats.totalSynced) }}
      </span>
      <span class="stat-label">{{ isSyncing ? 'Baris Masuk (Live)' : 'Total Data Disinkron' }}</span>
    </div>

    <div v-if="isSyncing" class="stat-card stat-live stat-card-current-table">
      <span class="stat-value text-cyan">
        {{ formatNumber(syncProgress.currentTableIndex) }} / {{ formatNumber(syncProgress.totalTables) }}
      </span>
      <span class="stat-label">
        Tabel: <span class="table-name-truncated" :title="syncProgress.currentTableName">{{ syncProgress.currentTableName || '...' }}</span>
      </span>
    </div>

    <div v-else class="stat-card">
      <span class="stat-value text-cyan">{{ formatDuration(stats.lastDuration) }}</span>
      <span class="stat-label">Durasi Terakhir</span>
    </div>

    <div v-if="!isSyncing" class="stat-card">
      <span class="stat-value text-amber">{{ formatTime(stats.lastSyncTime) }}</span>
      <span class="stat-label">Waktu Sinkron Terakhir</span>
    </div>
    <div v-else class="stat-card stat-live">
      <span class="stat-value text-amber">{{ elapsedDisplay }}</span>
      <span class="stat-label">Waktu Berjalan</span>
    </div>
  </div>
</template>

<script setup>
import { formatNumber, formatDuration, formatTime } from '../../utils/formatters.js';

defineProps({
  isSyncing: { type: Boolean, default: false },
  stats: { type: Object, required: true },
  syncProgress: { type: Object, required: true },
  elapsedDisplay: { type: String, default: '0d' },
});
</script>


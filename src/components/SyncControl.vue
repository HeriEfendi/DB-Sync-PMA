<template>
  <div data-ui="sync" class="glass-panel sync-control-card">
    <div class="control-grid">
      <div class="main-action">
        <button
          v-if="!isSyncing"
          class="btn btn-primary btn-sm"
          @click="$emit('start-sync')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          <span class="btn-text">Mulai Sinkronisasi Data</span>
        </button>

        <button
          v-else
          class="btn btn-danger btn-sm btn-stop"
          title="Klik untuk menghentikan sinkronisasi saat ini. Data yang sudah masuk tetap tersimpan."
          @click="$emit('stop-sync')"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2"></rect>
          </svg>
          <span class="btn-text">Hentikan Sinkronisasi</span>
        </button>

        <div class="auto-sync-box">
          <label class="auto-sync-label">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>Otomatisasi:</span>
          </label>
          <BaseSelect
            :model-value="autoSyncInterval"
            :options="autoSyncOptions"
            direction="down"
            aria-label="Interval sinkronisasi otomatis"
            trigger-class="min-w-[145px]"
            @update:model-value="$emit('update:autoSyncInterval', parseInt($event, 10))"
          />
        </div>

        <div v-if="isSyncing" class="sync-status-indicator" role="status">
          <span class="sync-status-spinner"></span>
          <span>Sync {{ syncProgress.currentTableIndex }}/{{ syncProgress.totalTables }}</span>
          <strong>{{ syncProgress.currentTableName || 'Menyiapkan...' }}</strong>
        </div>
      </div>

      <SyncStatsGrid
        :is-syncing="isSyncing"
        :stats="stats"
        :sync-progress="syncProgress"
        :elapsed-display="elapsedDisplay"
      />
    </div>

    <div class="sync-options-card">
      <div class="options-row">
        <div class="option-inline">
          <span class="option-title">Mode:</span>
          <label class="radio-label-inline" title="Server sumber data utama. Menghapus data lokal di atas Last ID, lalu mengambil ID baru dan data updated_at terbaru dari server.">
            <input type="radio" name="syncMode" value="incremental" :checked="syncMode === 'incremental'" @change="$emit('update:sync-mode', 'incremental')" />
            <span>Sync Server (New &amp; Update)</span>
          </label>
          <label class="radio-label-inline warning-radio">
            <input type="radio" name="syncMode" value="fresh" :checked="syncMode === 'fresh'" @change="$emit('update:sync-mode', 'fresh')" />
            <span>Fresh Sync</span>
          </label>
        </div>
        <div class="option-inline">
          <span class="option-title">Limit:</span>
          <BaseSelect
            :model-value="Number.isFinite(Number(rowLimit)) ? Number(rowLimit) : 0"
            :options="rowLimitOptions"
            direction="down"
            aria-label="Limit baris sinkronisasi"
            trigger-class="min-w-[160px]"
            @update:model-value="$emit('update:row-limit', Number($event) || 0)"
          />
        </div>
        <button class="btn btn-secondary btn-sm console-trigger" type="button" @click="$emit('open-console')">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
          <span>Console Log</span>
          <span class="console-count">{{ logCount }}</span>
        </button>
      </div>
    </div>

    <div v-if="isSyncing" class="sync-live-banner">
      <div class="sync-live-content">
        <span class="pulse-dot"></span>
        <span class="live-status-text">
          Menyinkronkan <strong class="badge-accent">{{ syncProgress.currentTableIndex }}/{{ syncProgress.totalTables }}</strong> tabel
          <strong v-if="syncProgress.currentTableName" class="badge-tableName">'{{ syncProgress.currentTableName }}'</strong>:
          <span class="text-emerald font-bold">{{ formatNumber(syncProgress.rowsSyncedCurrentTable) }} baris</span> dimasukkan
          (Total Session: <strong class="text-white">{{ formatNumber(syncProgress.totalSyncedAllTables) }}</strong> baris).
        </span>
      </div>
    </div>

    <div v-if="isSyncing" class="progress-bar-container">
      <div
        class="progress-bar-fill"
        :style="{ width: syncProgress.totalTables > 0 ? `${Math.min(100, (syncProgress.currentTableIndex / syncProgress.totalTables) * 100)}%` : '0%' }"
      ></div>
    </div>

    <SyncTableStatesCard
      :sync-table-states="syncTableStates"
      @reset-state="$emit('reset-table-state', $event)"
      @reset-all="$emit('reset-all-table-states')"
    />
  </div>
</template>

<script setup>
import { toRef } from 'vue';
import { formatNumber } from '../utils/formatters.js';
import { useElapsedTimer } from '../composables/useElapsedTimer.js';
import SyncStatsGrid from './sync/SyncStatsGrid.vue';
import SyncTableStatesCard from './sync/SyncTableStatesCard.vue';
import BaseSelect from './common/BaseSelect.vue';

const autoSyncOptions = [
  { value: 0, label: 'Non-Aktif (Manual)' },
  { value: 5, label: 'Setiap 5 Detik' },
  { value: 10, label: 'Setiap 10 Detik' },
  { value: 30, label: 'Setiap 30 Detik' },
  { value: 60, label: 'Setiap 1 Menit' },
  { value: 300, label: 'Setiap 5 Menit' },
];

const rowLimitOptions = [
  { value: 0, label: 'Semua Row (Default)' },
  { value: 1000, label: '1.000 Row' },
  { value: 10000, label: '10.000 Row' },
  { value: 100000, label: '100.000 Row' },
  { value: 500000, label: '500.000 Row' },
  { value: 1000000, label: '1.000.000 Row' },
  { value: 2000000, label: '2.000.000 Row' },
  { value: 5000000, label: '5.000.000 Row' },
];

const props = defineProps({
  isSyncing: { type: Boolean, default: false },
  logCount: { type: Number, default: 0 },
  autoSyncInterval: { type: Number, default: 0 },
  syncMode: { type: String, default: 'incremental' },
  rowLimit: { type: Number, default: 0 },
  stats: {
    type: Object,
    default: () => ({ totalSynced: 0, lastDuration: 0, lastSyncTime: '' }),
  },
  syncProgress: {
    type: Object,
    default: () => ({
      currentTableIndex: 0,
      totalTables: 0,
      currentTableName: '',
      rowsSyncedCurrentTable: 0,
      totalSyncedAllTables: 0,
    }),
  },
  syncTableStates: {
    type: Array,
    default: () => [],
  },
});

defineEmits([
  'start-sync',
  'stop-sync',
  'open-console',
  'update:autoSyncInterval',
  'update:sync-mode',
  'update:row-limit',
  'reset-table-state',
  'reset-all-table-states',
]);

const { elapsedDisplay } = useElapsedTimer(toRef(props, 'isSyncing'));
</script>

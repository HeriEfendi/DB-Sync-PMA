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
          <select
            :value="autoSyncInterval"
            class="form-select interval-select"
            @change="$emit('update:autoSyncInterval', parseInt($event.target.value, 10))"
          > 
            <option :value="0">Non-Aktif (Manual)</option>
            <option :value="5">Setiap 5 Detik</option>
            <option :value="10">Setiap 10 Detik</option>
            <option :value="30">Setiap 30 Detik</option>
            <option :value="60">Setiap 1 Menit</option>
            <option :value="300">Setiap 5 Menit</option>
          </select>
        </div>

        <div v-if="isSyncing" class="sync-status-indicator" role="status">
          <span class="sync-status-spinner"></span>
          <span>Sync {{ syncProgress.currentTableIndex }}/{{ syncProgress.totalTables }}</span>
          <strong>{{ syncProgress.currentTableName || 'Menyiapkan...' }}</strong>
        </div>

        <button class="btn btn-secondary btn-sm console-trigger" type="button" @click="$emit('open-console')">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
          <span>Console Log</span>
          <span class="console-count">{{ logCount }}</span>
        </button>
      </div>

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
           <span class="stat-label">Tabel Process: <span class="table-name-truncated" :title="syncProgress.currentTableName">{{ syncProgress.currentTableName || '...' }}</span></span>
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
    </div>
    <div class="sync-options-card">
      <div class="options-row">
        <div class="option-inline">
          <span class="option-title">Mode:</span>
          <label class="radio-label-inline" title="Server sumber data utama. Menghapus data lokal di atas Last ID, lalu mengambil ID baru dan data updated_at terbaru dari server."><input type="radio" name="syncMode" value="incremental" :checked="syncMode === 'incremental'" @change="$emit('update:sync-mode', 'incremental')" /> <span>Sync Server (New &amp; Update)</span></label>
          <label class="radio-label-inline warning-radio"><input type="radio" name="syncMode" value="fresh" :checked="syncMode === 'fresh'" @change="$emit('update:sync-mode', 'fresh')" /> <span>Fresh Sync</span></label>
        </div>
        <div class="option-inline">
          <span class="option-title">Limit:</span>
          <select
            :value="Number.isFinite(Number(rowLimit)) ? Number(rowLimit) : 0"
            class="form-select limit-select"
            @change="$emit('update:row-limit', Number($event.target.value) || 0)"
          >
            <option :value="0">Semua Row (Default)</option><option :value="1000">1.000 Row</option><option :value="10000">10.000 Row</option><option :value="100000">100.000 Row</option><option :value="500000">500.000 Row</option><option :value="1000000">1.000.000 Row</option><option :value="2000000">2.000.000 Row</option><option :value="5000000">5.000.000 Row</option>
          </select>
        </div>
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
    <div v-if="syncTableStates && syncTableStates.length > 0" class="sync-states-card">
      <div class="states-header">
        <button class="states-toggle" type="button" :aria-expanded="showSyncStates" aria-controls="sync-states-table" @click="showSyncStates = !showSyncStates">
          <span class="states-title-wrap">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8v4l3 3"></path><circle cx="12" cy="12" r="9"></circle></svg>
            <span class="states-title">State &amp; ID Sync Terakhir per Tabel</span>
            <span class="state-count">{{ syncTableStates.length }}</span>
          </span>
          <svg class="toggle-chevron" :class="{ open: showSyncStates }" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"></path></svg>
        </button>
        <button v-if="showSyncStates" class="btn btn-ghost btn-xs text-rose" title="Reset semua riwayat sync state" @click="$emit('reset-all-table-states')">
          Reset Semua State
        </button>
      </div>
      <div v-if="showSyncStates" id="sync-states-table" class="states-table-wrapper">
        <table class="states-table">
          <thead>
            <tr>
              <th>Server / DB</th>
              <th>Tabel</th>
              <th>Last Synced ID</th>
              <th>Waktu Sync Terakhir</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="st in visibleStates" :key="st.key">
              <td class="font-mono text-dim">{{ st.server }} / {{ st.database }}</td>
              <td class="font-mono text-emerald"><strong>{{ st.table }}</strong></td>
              <td class="font-mono text-amber">
                <strong>{{ st.lastSyncedId !== null && st.lastSyncedId !== undefined ? st.lastSyncedId : '-' }}</strong>
                <small v-if="st.primaryKey" class="text-dim"> ({{ st.primaryKey }})</small>
              </td>
              <td class="text-muted">{{ formatDate(st.lastSyncTime) }}</td>
              <td>
                <button class="btn btn-danger btn-xs" title="Reset state tabel ini" @click="$emit('reset-table-state', st)">
                  Reset
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        <!-- Sentinel: saat elemen ini terlihat, muat 20 item berikutnya -->
        <div ref="sentinelRef" class="scroll-sentinel"></div>
        <div v-if="visibleStates.length < syncTableStates.length" class="load-more-hint">
          Menampilkan {{ visibleStates.length }} / {{ syncTableStates.length }} — scroll untuk muat lebih banyak
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
const props = defineProps({
  isSyncing: { type: Boolean, default: false },
  logCount: { type: Number, default: 0 },
  autoSyncInterval: { type: Number, default: 0 },
  syncMode: { type: String, default: 'incremental' },
  rowLimit: { type: Number, default: 0 },
  stats: {
    type: Object,
    default: () => ({
      totalSynced: 0,
      lastDuration: 0,
      lastSyncTime: '',
    }),
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

const emit = defineEmits([
  'start-sync',
  'stop-sync',
  'open-console',
  'update:autoSyncInterval',
  'update:sync-mode',
  'update:row-limit',
  'reset-table-state',
  'reset-all-table-states',
]);

// --- Realtime elapsed timer ---
const elapsedSeconds = ref(0);
const showSyncStates = ref(false);
let elapsedTimer = null;

// --- Progressive load dengan IntersectionObserver ---
const PAGE_SIZE = 20;
const sentinelRef = ref(null);
const visibleCount = ref(PAGE_SIZE);
let observer = null;

function loadMore() {
  if (visibleCount.value < props.syncTableStates.length) {
    visibleCount.value = Math.min(
      visibleCount.value + PAGE_SIZE,
      props.syncTableStates.length
    );
  }
}

function setupObserver() {
  if (observer) { observer.disconnect(); observer = null; }
  // Tunggu DOM render dulu
  setTimeout(() => {
    if (!sentinelRef.value) return;
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.value);
  }, 100);
}

function teardownObserver() {
  if (observer) { observer.disconnect(); observer = null; }
}

// Setup observer saat panel dibuka, teardown saat ditutup
watch(showSyncStates, (val) => {
  if (val) {
    visibleCount.value = PAGE_SIZE;
    setupObserver();
  } else {
    teardownObserver();
  }
});

// Reset saat data baru masuk
watch(() => props.syncTableStates, () => {
  visibleCount.value = PAGE_SIZE;
});

const visibleStates = computed(() =>
  props.syncTableStates.slice(0, visibleCount.value)
);

onUnmounted(() => {
  teardownObserver();
});
// --- End progressive load ---

watch(() => props.isSyncing, (syncing) => {
  if (syncing) {
    elapsedSeconds.value = 0;
    elapsedTimer = setInterval(() => { elapsedSeconds.value++; }, 1000);
  } else {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
});

onUnmounted(() => { clearInterval(elapsedTimer); });

const elapsedDisplay = computed(() => {
  const s = elapsedSeconds.value;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}j ${m}m ${sec}d`;
  if (m > 0) return `${m}m ${sec}d`;
  return `${sec}d`;
});
// --- End timer ---

const formatTime = (val) => {
  if (!val) return '-';
  if (typeof val === 'string') {
    if (/^\d{1,2}[.:]\d{1,2}(?:[.:]\d{1,2})?$/.test(val.trim())) {
      return val.trim().replace(/\./g, ':');
    }
  }
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('id-ID').replace(/\./g, ':');
    }
  } catch {}
  return String(val).replace(/\./g, ':');
};

const formatDate = (isoString) => {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const datePart = d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timePart = d.toLocaleTimeString('id-ID').replace(/\./g, ':');
    return `${datePart}, ${timePart}`;
  } catch {
    return isoString;
  }
};

const formatNumber = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return Number(val).toLocaleString('id-ID');
};

const formatDuration = (ms) => {
  if (!ms || isNaN(ms)) return '-';
  if (ms < 1000) return `${ms}ms`;

  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;

  if (minutes === 0) {
    return `${seconds}d`;
  }
  return `${minutes}m ${seconds}d`;
};
</script>

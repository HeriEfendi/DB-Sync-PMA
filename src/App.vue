<template>
  <div class="app-layout desktop-shell">
    <div v-if="!isTauri" class="browser-banner">
      <span class="banner-dot"></span>
      <span>Mode browser aktif. Jalankan <code>npm run tauri dev</code> untuk akses MySQL lokal.</span>
    </div>

    <div class="desktop-frame">
      <section class="desktop-content">
        <Navbar
          :pma-status="pmaStatus"
          :local-status="localStatus"
          :is-syncing="isSyncing"
          :app-version="appVersion"
          :testing-pma="testingPma"
          :testing-local="testingLocal"
          :selected-preset="currentPresetName"
          :preset-options="connectionConfigRef?.presets"
          :remote-database="pmaConfig.database"
          :local-database="localConfig.database"
          @trigger-sync="handleStartSync"
          @test-pma="testPmaConnection"
          @test-local="testLocalConnection"
          @select-preset="connectionConfigRef?.selectPreset($event)"
          @edit-config="showConnectionModal = true"
          @create-profile="connectionConfigRef?.createPreset()"
        />

        <main class="dashboard-body">
          <div class="workflow-grid">
            <TableConfig
              :server-key="currentServerKey"
              v-model:selected-tables="selectedTables"
              v-model:available-tables="availableTables"
              :fetching-tables="fetchingTables"
              :sync-table-states="tableStates"
              :request-confirmation="requestConfirmation"
              :request-input="requestInput"
              :notify-toast="notifyToast"
              @fetch-tables="fetchTablesFromPma"
            />

            <SyncControl
              :is-syncing="isSyncing"
              :log-count="logs.length"
              v-model:auto-sync-interval="autoSyncInterval"
              :sync-mode="syncMode"
              :row-limit="rowLimit"
              :stats="stats"
              :sync-progress="syncProgress"
              :sync-table-states="tableStates"
              @start-sync="handleStartSync"
              @stop-sync="handleStopSync"
              @update:sync-mode="syncMode = $event"
              @update:row-limit="rowLimit = Number.isFinite(Number($event)) ? Number($event) : 0"
              @reset-table-state="handleResetTableState"
              @reset-all-table-states="handleResetAllTableStates"
              @open-console="openConsole"
            />
          </div>

          <div v-show="showConnectionModal" class="connection-modal-backdrop" @click.self="showConnectionModal = false">
            <section class="connection-modal" role="dialog" aria-modal="true" aria-labelledby="connection-modal-title" tabindex="-1">
              <header class="dialog-titlebar">
                <div>
                  <span class="eyebrow">PREFERENSI</span>
                  <h2 id="connection-modal-title">Konfigurasi koneksi</h2>
                </div>
                <button class="window-control" type="button" aria-label="Tutup konfigurasi" @click="showConnectionModal = false">×</button>
              </header>
              <div class="connection-modal-content">
                <ConnectionConfigSection
                  ref="connectionConfigRef"
                  v-model:pma-config="pmaConfig"
                  v-model:local-config="localConfig"
                  v-model:selected-preset="currentPresetName"
                  :request-confirmation="requestConfirmation"
                  :request-input="requestInput"
                  :notify-toast="notifyToast"
                  @test-pma="testPmaConnection"
                  @test-local="testLocalConnection"
                  @preset-changed="handlePresetChanged"
                />
              </div>
            </section>
          </div>

          <div v-if="showConsoleModal" v-show="!consoleMinimized" class="console-modal-backdrop">
            <section class="console-dialog" role="dialog" aria-modal="true" aria-label="Console log sinkronisasi">
              <header class="floating-console-titlebar">
                <div class="floating-console-title">
                  <span class="console-live-dot" :class="{ active: isSyncing }"></span>
                  <strong>Console Log</strong>
                  <span class="console-count">{{ logs.length }} entri</span>
                </div>
                <div class="window-controls">
                  <button class="window-control" type="button" aria-label="Minimalkan console" title="Minimalkan" @click="consoleMinimized = true">−</button>
                  <button class="window-control" type="button" aria-label="Tutup console; sinkronisasi tetap berjalan" title="Tutup" @click="showConsoleModal = false">×</button>
                </div>
              </header>
              <div class="floating-console-content">
                <LogConsole :logs="logs" @clear-logs="logs = []" />
              </div>
            </section>
          </div>

          <div v-if="showConsoleModal" v-show="consoleMinimized" class="console-minimized-dock" role="region" aria-label="Console log diminimalkan">
            <header class="floating-console-titlebar">
              <div class="floating-console-title">
                <span class="console-live-dot" :class="{ active: isSyncing }"></span>
                <strong>Console Log</strong>
                <span class="console-count">{{ logs.length }} entri</span>
              </div>
              <div class="window-controls">
                <button class="window-control" type="button" aria-label="Buka kembali console" title="Buka kembali" @click="consoleMinimized = false">□</button>
                <button class="window-control" type="button" aria-label="Tutup console; sinkronisasi tetap berjalan" title="Tutup" @click="showConsoleModal = false">×</button>
              </div>
            </header>
          </div>

          <div
            v-if="actionDialog.open"
            class="confirm-modal-backdrop"
            @click.self="cancelActionDialog"
          >
            <section
              class="confirm-dialog"
              :class="{ 'confirm-dialog-input': actionDialog.mode === 'input' }"
              :role="actionDialog.mode === 'input' ? 'dialog' : 'alertdialog'"
              aria-modal="true"
              aria-labelledby="action-dialog-title"
              :aria-describedby="actionDialog.mode === 'confirm' ? 'action-dialog-message' : undefined"
              tabindex="-1"
              @keydown.esc.prevent.stop="cancelActionDialog"
            >
              <div v-if="actionDialog.mode === 'confirm'" class="confirm-dialog-icon" aria-hidden="true">!</div>
              <div class="confirm-dialog-copy">
                <span class="eyebrow">{{ actionDialog.mode === 'input' ? 'INPUT' : 'KONFIRMASI' }}</span>
                <h2 id="action-dialog-title">{{ actionDialog.title }}</h2>
                <p v-if="actionDialog.mode === 'confirm'" id="action-dialog-message">{{ actionDialog.message }}</p>
                <input
                  v-else
                  v-model="actionDialog.value"
                  class="form-input action-dialog-input"
                  type="text"
                  :placeholder="actionDialog.placeholder"
                  autofocus
                  @keydown.enter.prevent="finishActionDialog(actionDialog.value.trim() || null)"
                />
              </div>
              <div class="confirm-dialog-actions">
                <button class="btn btn-secondary btn-sm" type="button" @click="cancelActionDialog">
                  Batal
                </button>
                <button
                  class="btn btn-sm"
                  :class="actionDialog.mode === 'input' ? 'btn-primary' : 'btn-danger'"
                  type="button"
                  :disabled="actionDialog.mode === 'input' && !actionDialog.value.trim()"
                  @click="finishActionDialog(actionDialog.mode === 'input' ? actionDialog.value.trim() : true)"
                >
                  {{ actionDialog.confirmLabel }}
                </button>
              </div>
            </section>
          </div>

          <div class="toast-stack" role="status" aria-live="polite" aria-atomic="false">
            <TransitionGroup name="toast">
              <article v-for="toast in toasts" :key="toast.id" class="app-toast" :class="`app-toast-${toast.type}`">
                <span class="toast-icon" aria-hidden="true">{{ toast.type === 'success' ? '✓' : toast.type === 'error' ? '!' : 'i' }}</span>
                <div class="toast-copy">
                  <strong>{{ toast.title }}</strong>
                  <p>{{ toast.message }}</p>
                </div>
                <button class="toast-close" type="button" :aria-label="`Tutup notifikasi: ${toast.title}`" @click="dismissToast(toast.id)">×</button>
              </article>
            </TransitionGroup>
          </div>
        </main>
        <!-- <footer class="status-bar"><span><i class="status-dot" :class="{ busy: isSyncing }"></i>{{ isSyncing ? 'Sinkronisasi berjalan' : 'Siap' }}</span><span>Local workspace</span><span class="status-spacer"></span><span>UTF-8</span><span>v{{ appVersion }}</span></footer> -->
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import Navbar from './components/Navbar.vue';
import ConnectionConfigSection from './components/ConnectionConfigSection.vue';
import TableConfig from './components/TableConfig.vue';
import SyncControl from './components/SyncControl.vue';
import LogConsole from './components/LogConsole.vue';
import { PmaClient } from './services/pmaClient.js';
import { SyncEngine } from './services/syncEngine.js';
import { isTauriEnvironment, safeInvoke } from './services/tauriHelper.js';
import { getAllTableStates, clearTableState, clearAllTableStates } from './services/syncStateStore.js';
import packageJson from '../package.json';
import { getVersion } from '@tauri-apps/api/app';

const isTauri = ref(isTauriEnvironment());
const appVersion = ref(packageJson.version);
const tableStates = ref([]);

// Connection state
const pmaConfig = ref({
  url: 'http://localhost/phpmyadmin',
  username: 'root',
  password: '',
  database: 'sample_db',
  table: 'users',
  primaryKey: 'id',
});

const localConfig = ref({
  host: '127.0.0.1',
  port: 3306,
  username: 'root',
  password: '',
  database: 'sample_db',
  table: 'users',
  use_docker: false,
  docker_container: '',
});

// Multi-table & Sync options state
const availableTables = ref([]);
const selectedTables = ref([]);
const syncMode = ref('incremental'); // 'incremental' | 'fresh'
const rowLimit = ref(0); // 0 = unlimited

const pmaStatus = ref({ connected: false });
const localStatus = ref({ connected: false });
const testingPma = ref(false);
const testingLocal = ref(false);
const fetchingTables = ref(false);

const isSyncing = ref(false);
const showConnectionModal = ref(false);
const showConsoleModal = ref(false);
const consoleMinimized = ref(false);
const connectionConfigRef = ref(null);
const autoSyncInterval = ref(0);
let timerId = null;
const toasts = ref([]);
const toastTimers = new Map();
let nextToastId = 0;

const notifyToast = ({ type = 'info', title = 'Informasi', message, duration = 3600 }) => {
  const toast = { id: ++nextToastId, type, title, message };
  toasts.value.push(toast);
  if (toasts.value.length > 4) dismissToast(toasts.value[0].id);
  toastTimers.set(toast.id, setTimeout(() => dismissToast(toast.id), duration));
};

const dismissToast = (id) => {
  const timer = toastTimers.get(id);
  if (timer) clearTimeout(timer);
  toastTimers.delete(id);
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
};
const actionDialog = ref({
  open: false,
  mode: 'confirm',
  title: '',
  message: '',
  confirmLabel: 'Lanjutkan',
  placeholder: '',
  value: '',
});
let resolveActionDialog = null;

const openActionDialog = (options) => new Promise((resolve) => {
  if (resolveActionDialog) {
    resolveActionDialog(actionDialog.value.mode === 'input' ? null : false);
  }
  resolveActionDialog = resolve;
  actionDialog.value = {
    open: true,
    mode: 'confirm',
    title: '',
    message: '',
    confirmLabel: 'Lanjutkan',
    placeholder: '',
    value: '',
    ...options,
  };
});

const requestConfirmation = ({ title, message, confirmLabel = 'Lanjutkan' }) =>
  openActionDialog({ mode: 'confirm', title, message, confirmLabel });

const requestInput = ({ title, placeholder = '', confirmLabel = 'Simpan' }) =>
  openActionDialog({ mode: 'input', title, placeholder, confirmLabel });

const finishActionDialog = (result) => {
  const resolve = resolveActionDialog;
  resolveActionDialog = null;
  actionDialog.value.open = false;
  if (resolve) resolve(result);
};

const cancelActionDialog = () => {
  finishActionDialog(actionDialog.value.mode === 'input' ? null : false);
};

const openConsole = () => {
  showConsoleModal.value = true;
  consoleMinimized.value = false;
};

watch(isSyncing, (syncing, wasSyncing) => {
  if (syncing && !wasSyncing) openConsole();
});

const logs = ref([]);

const stats = ref({
  totalSynced: 0,
  lastDuration: 0,
  lastSyncTime: '',
});

let logSaveTimer = null;

const addLog = (entry) => {
  const rawTs = entry.timestamp || new Date().toLocaleTimeString('id-ID');
  const timestamp = typeof rawTs === 'string' ? rawTs.replace(/\./g, ':') : rawTs;
  const normalizedEntry = { ...entry, timestamp };
  const msg = normalizedEntry.message || '';
  const tableMatch = msg.match(/\[Tabel\s+'([^']+)'\]/);
  const tableName = tableMatch ? tableMatch[1] : (normalizedEntry.tableName || null);

  const isTransientProgress =
    msg.includes('Mengunduh stream') ||
    msg.includes('Menunggu server remote PMA') ||
    msg.includes('Mengalirkan ke MySQL:') ||
    msg.includes('Mengunduh dalam cicilan') ||
    msg.includes('selesai diunduh: ~');

  const isTableFinished =
    entry.type === 'success' ||
    msg.includes('Selesai!') ||
    msg.includes('Struktur tabel berhasil dibuat') ||
    msg.includes('Auto-fallback Fresh Sync') ||
    msg.includes('Melewati proses import lokal') ||
    msg.includes('Di-skip pada sinkronisasi') ||
    msg.includes('Export GAGAL') ||
    msg.includes('MySQL CLI import error') ||
    msg.includes('Gagal:');

  if (tableName && isTransientProgress) {
    // If there is already an active progress log for this table, update it in place
    const existingIdx = logs.value.findIndex(
      (l) => l.isTransient && l.tableName === tableName
    );
    if (existingIdx !== -1) {
      logs.value[existingIdx] = {
        ...normalizedEntry,
        isTransient: true,
        tableName,
      };
      return;
    } else {
      logs.value.push({
        ...normalizedEntry,
        isTransient: true,
        tableName,
      });
      if (logs.value.length > 500) logs.value.shift();
      return;
    }
  }

  if (tableName && isTableFinished) {
    // Hapus log sementara (transient) dan semua log INFO perantara untuk tabel ini
    // agar histori log konsol tetap bersih dan ringkas (hanya menyisakan status akhir)
    logs.value = logs.value.filter(
      (l) =>
        !(
          (l.tableName === tableName ||
            (l.message && l.message.includes(`[Tabel '${tableName}']`))) &&
          (l.isTransient || l.type === 'info')
        )
    );
  }

  // Push permanent clean log
  logs.value.push({
    ...normalizedEntry,
    tableName: tableName || undefined,
  });
  if (logs.value.length > 500) {
    logs.value.shift();
  }

  if (!logSaveTimer) {
    logSaveTimer = setTimeout(() => {
      try {
        localStorage.setItem(
          'db_sync_logs',
          JSON.stringify(logs.value.filter((l) => !l.isTransient).slice(-100))
        );
      } catch (e) {}
      logSaveTimer = null;
    }, 2500);
  }
};

const refreshTableStates = () => {
  tableStates.value = getAllTableStates(pmaConfig.value.url, pmaConfig.value.database);
};

const handleResetTableState = (st) => {
  clearTableState(st.server, st.database, st.table);
  refreshTableStates();
  notifyToast({ type: 'success', title: 'State tabel direset', message: `Riwayat sinkronisasi tabel ${st.table} dihapus.` });
  addLog({
    type: 'info',
    message: `State sync tabel '${st.table}' di-reset. Sync berikutnya akan mengecek dari awal.`,
    timestamp: new Date().toLocaleTimeString(),
  });
};

const handleResetAllTableStates = () => {
  clearAllTableStates();
  refreshTableStates();
  notifyToast({ type: 'success', title: 'Semua state direset', message: 'Seluruh riwayat sinkronisasi tabel telah dihapus.' });
  addLog({
    type: 'warning',
    message: `Semua riwayat sync state tabel berhasil di-reset.`,
    timestamp: new Date().toLocaleTimeString(),
  });
};

const currentPresetName = ref(localStorage.getItem('db_sync_last_preset') || '');

const computeServerKey = (pma, preset = '') => {
  const p = (preset || '').trim();
  if (p) {
    return `preset_${p.replace(/[^a-zA-Z0-9_\-]/g, '_')}`;
  }
  const u = (pma?.url || '').trim().toLowerCase().replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const d = (pma?.database || '').trim().toLowerCase().replace(/[^a-zA-Z0-9_\-]/g, '_');
  if (!u && !d) return 'default';
  return `server_${u}___${d}`;
};

const currentServerKey = computed(() => computeServerKey(pmaConfig.value, currentPresetName.value));

const saveTablesForServerKey = (key, available, selected) => {
  if (!key) return;
  try {
    const data = {
      availableTables: Array.isArray(available) ? available : [],
      selectedTables: Array.isArray(selected) ? selected : [],
    };
    localStorage.setItem(`db_sync_tables_${key}`, JSON.stringify(data));
  } catch (e) {
    console.error('Failed saving tables for server key:', key, e);
  }
};

const loadTablesForServerKey = (key) => {
  if (!key) return;
  try {
    const raw = localStorage.getItem(`db_sync_tables_${key}`);
    if (raw) {
      const data = JSON.parse(raw);
      availableTables.value = Array.isArray(data.availableTables) ? data.availableTables : [];
      selectedTables.value = Array.isArray(data.selectedTables) ? data.selectedTables : [];
      return;
    }

    // Fallback migrasi jika belum ada penyimpanan per serverKey tapi ada data lama di global
    const globalAvail = localStorage.getItem('db_sync_available_tables');
    const globalSel = localStorage.getItem('db_sync_selected_tables');
    if (globalAvail) {
      try {
        availableTables.value = JSON.parse(globalAvail);
        selectedTables.value = globalSel ? JSON.parse(globalSel) : [];
        saveTablesForServerKey(key, availableTables.value, selectedTables.value);
        return;
      } catch (e) {}
    }

    // Server baru: kosongkan daftar tabel
    availableTables.value = [];
    selectedTables.value = [];
  } catch (e) {
    console.error('Failed loading tables for server key:', key, e);
    availableTables.value = [];
    selectedTables.value = [];
  }
};

onMounted(async () => {
  try {
    const savedPma = localStorage.getItem('db_sync_pma_config');
    const savedLocal = localStorage.getItem('db_sync_local_config');
    const savedMode = localStorage.getItem('db_sync_mode');
    const savedLimit = localStorage.getItem('db_sync_row_limit');
    const savedStats = localStorage.getItem('db_sync_stats');
    const savedLogs = localStorage.getItem('db_sync_logs');

    if (savedPma) Object.assign(pmaConfig.value, JSON.parse(savedPma));
    if (savedLocal) Object.assign(localConfig.value, JSON.parse(savedLocal));
    if (savedMode) syncMode.value = savedMode;
    if (savedLimit !== null && savedLimit !== undefined) rowLimit.value = parseInt(savedLimit, 10);
    if (savedStats) Object.assign(stats.value, JSON.parse(savedStats));
    if (savedLogs) {
      try {
        const parsed = JSON.parse(savedLogs);
        if (Array.isArray(parsed) && parsed.length > 0) logs.value = parsed;
      } catch (e) {}
    }
  } catch (e) {
    console.error('Failed reading saved config:', e);
  }

  loadTablesForServerKey(currentServerKey.value);
  refreshTableStates();

  if (isTauri.value) {
    try {
      const tauriVer = await getVersion();
      if (tauriVer) appVersion.value = tauriVer;
    } catch (e) {}
    addLog({
      type: 'success',
      message: 'Runtime Desktop Tauri terdeteksi dan aktif.',
      timestamp: new Date().toLocaleTimeString(),
    });
  } else {
    addLog({
      type: 'warning',
      message: 'Aplikasi berjalan di Web Browser. Untuk sinkronisasi ke port MySQL lokal, jalankan: npm run tauri dev',
      timestamp: new Date().toLocaleTimeString(),
    });
  }

  addLog({
    type: 'info',
    message: 'DB-Sync Desktop Client siap. Pilih tabel dan mode sinkronisasi, lalu tekan "Mulai Sinkronisasi Data".',
    timestamp: new Date().toLocaleTimeString(),
  });
});

const saveTimerMap = {};
const debounceStorageSave = (key, value) => {
  if (saveTimerMap[key]) clearTimeout(saveTimerMap[key]);
  saveTimerMap[key] = setTimeout(() => {
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch (e) {}
    delete saveTimerMap[key];
  }, 300);
};

watch(currentServerKey, (newKey, oldKey) => {
  if (oldKey && oldKey !== newKey) {
    saveTablesForServerKey(oldKey, availableTables.value, selectedTables.value);
  }
  if (newKey) {
    loadTablesForServerKey(newKey);
  }
  refreshTableStates();
});

watch(pmaConfig, (val) => {
  debounceStorageSave('db_sync_pma_config', val);
  refreshTableStates();
}, { deep: true });
watch(localConfig, (val) => debounceStorageSave('db_sync_local_config', val), { deep: true });
watch(availableTables, (val) => {
  saveTablesForServerKey(currentServerKey.value, val, selectedTables.value);
}, { deep: true });
watch(selectedTables, (val) => {
  saveTablesForServerKey(currentServerKey.value, availableTables.value, val);
}, { deep: true });
watch(syncMode, (val) => debounceStorageSave('db_sync_mode', val));
watch(rowLimit, (val) => debounceStorageSave('db_sync_row_limit', String(val)));
watch(stats, (val) => debounceStorageSave('db_sync_stats', val), { deep: true });

const handlePresetChanged = (presetName) => {
  pmaStatus.value.connected = false;
  localStatus.value.connected = false;
  if (presetName !== undefined && presetName !== null) {
    currentPresetName.value = presetName;
  }
  refreshTableStates();
};

watch(autoSyncInterval, (sec) => {
  if (timerId) clearInterval(timerId);

  if (sec > 0) {
    addLog({
      type: 'warning',
      message: `Sinkronisasi Otomatis Dihidupkan (Setiap ${sec} detik).`,
      timestamp: new Date().toLocaleTimeString(),
    });

    timerId = setInterval(() => {
      if (!isSyncing.value) {
        handleStartSync();
      }
    }, sec * 1000);
  } else {
    addLog({
      type: 'info',
      message: 'Sinkronisasi Otomatis Dimatikan.',
      timestamp: new Date().toLocaleTimeString(),
    });
  }
});

onUnmounted(() => {
  if (timerId) clearInterval(timerId);
  toastTimers.forEach((timer) => clearTimeout(timer));
  toastTimers.clear();
});

// Fetch list of tables dynamically from remote PMA
const fetchTablesFromPma = async () => {
  const trimmedUrl = (pmaConfig.value.url || '').trim().replace(/\/index\.php.*$/, '').replace(/\/$/, '');
  const trimmedDb = (pmaConfig.value.database || '').trim();
  const trimmedUser = (pmaConfig.value.username || '').trim();
  pmaConfig.value.url = trimmedUrl;
  pmaConfig.value.database = trimmedDb;
  pmaConfig.value.username = trimmedUser;

  fetchingTables.value = true;
  addLog({
    type: 'info',
    message: `Menarik daftar tabel dari database PMA remote (${trimmedDb})...`,
    timestamp: new Date().toLocaleTimeString(),
  });

  let pmaLogUnlisten = null;

  try {
    let tables = [];
    if (isTauri.value) {
      // Listen to pma-log events from Rust so diagnostics appear in the app console
      try {
        pmaLogUnlisten = await safeListen('pma-log', (event) => {
          const { type: t, message } = event.payload || {};
          const logType = t === 'warn' ? 'warning' : (t || 'info');
          addLog({ type: logType, message: `[PMA] ${message}`, timestamp: new Date().toLocaleTimeString() });
        });
      } catch (_) {}

      try {
        tables = await safeInvoke('get_pma_tables', {
          pmaConfig: {
            url: trimmedUrl,
            username: trimmedUser,
            password: pmaConfig.value.password,
            database: trimmedDb,
            tables: [],
          },
        });
      } catch (e) {
        addLog({
          type: 'warning',
          message: `Engine native Rust gagal ekstraksi tabel (${e.message || e}), mencoba fallback client JS...`,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
    }

    if (!tables || tables.length === 0) {
      addLog({ type: 'info', message: 'Mencoba fallback JS PmaClient...', timestamp: new Date().toLocaleTimeString() });
      try {
        const client = new PmaClient(pmaConfig.value);
        await client.authenticate();
        tables = await client.fetchTablesList();
      } catch (jsErr) {
        addLog({ type: 'warning', message: `JS PmaClient fallback gagal: ${jsErr.message}`, timestamp: new Date().toLocaleTimeString() });
      }
    }

    const isPmaArtifact = (name) => ['td', 'text', 'not_null', 'text_plain', 'pre_wrap', 'data'].includes(String(name).toLowerCase());

    if (tables && tables.length > 0) {
      tables = tables.filter((t) => !isPmaArtifact(t));
      availableTables.value = tables;
      pmaStatus.value.connected = true;

      addLog({
        type: 'success',
        message: `✅ Berhasil mengekstrak ${tables.length} tabel dari PMA: ${tables.slice(0, 10).join(', ')}${tables.length > 10 ? ` ... +${tables.length - 10} lainnya` : ''}`,
        timestamp: new Date().toLocaleTimeString(),
      });

      // Bandingkan dengan tabel di database MySQL lokal
      if (isTauri.value && localConfig.value.database) {
        try {
          addLog({
            type: 'info',
            message: `Memeriksa perbedaan skema tabel dengan database MySQL lokal (${localConfig.value.database})...`,
            timestamp: new Date().toLocaleTimeString(),
          });

          const localTables = await safeInvoke('get_local_tables', {
            config: {
              host: localConfig.value.host || '127.0.0.1',
              port: parseInt(localConfig.value.port || 3306, 10),
              username: localConfig.value.username || 'root',
              password: localConfig.value.password || '',
              database: localConfig.value.database || '',
              use_docker: Boolean(localConfig.value.use_docker),
              docker_container: localConfig.value.docker_container || '',
            },
          });

          if (Array.isArray(localTables)) {
            const pmaTableSet = new Set(tables);
            const localTableSet = new Set(localTables);

            // Daftar tabel yang sebelumnya pernah terdaftar pada server PMA ini
            const prevServerTables = new Set(availableTables.value || []);

            // Drop: HANYA tabel yang sebelumnya memang pernah terdaftar di server PMA ini,
            // atau tabel artefak HTML/CSS phpMyAdmin yang sempat terbuat.
            const droppedTables = localTables.filter((t) => (prevServerTables.has(t) || isPmaArtifact(t)) && !pmaTableSet.has(t));
            const newTables = tables.filter((t) => !localTableSet.has(t));

            // 1. Drop tabel lokal yang sudah tidak ada di PMA
            if (droppedTables.length > 0) {
              addLog({
                type: 'warning',
                message: `🗑️ Menghapus ${droppedTables.length} tabel di MySQL lokal yang sudah tidak ada di PMA: ${droppedTables.join(', ')}...`,
                timestamp: new Date().toLocaleTimeString(),
              });

              await safeInvoke('drop_local_tables', {
                config: {
                  host: localConfig.value.host || '127.0.0.1',
                  port: parseInt(localConfig.value.port || 3306, 10),
                  username: localConfig.value.username || 'root',
                  password: localConfig.value.password || '',
                  database: localConfig.value.database || '',
                  use_docker: Boolean(localConfig.value.use_docker),
                  docker_container: localConfig.value.docker_container || '',
                },
                tables: droppedTables,
              });

              droppedTables.forEach((t) => {
                clearTableState(pmaConfig.value.url, pmaConfig.value.database, t);
              });

              addLog({
                type: 'success',
                message: `✅ Selesai menghapus ${droppedTables.length} tabel usang dari MySQL lokal.`,
                timestamp: new Date().toLocaleTimeString(),
              });
            }

            // 2. Tambahkan tabel baru dari PMA yang belum ada di local
            // 2. Tambahkan tabel baru dari PMA yang belum ada di local (Hanya struktur tabel / DDL, penarikan data dilakukan pada proses sync)
            if (newTables.length > 0) {
              addLog({
                type: 'info',
                message: `📥 Ditemukan ${newTables.length} tabel baru di PMA yang belum ada di lokal: ${newTables.join(', ')}. Membuat struktur tabel di MySQL lokal...`,
                timestamp: new Date().toLocaleTimeString(),
              });

              const syncEngine = new SyncEngine(pmaConfig.value, localConfig.value, {
                onLog: addLog,
                onTableSynced: refreshTableStates,
                onProgress: () => {},
              });

              await syncEngine.runMultiTableSync({
                tables: newTables,
                syncMode: 'structure_only',
                rowLimit: 0,
              });

              addLog({
                type: 'success',
                message: `✅ Selesai membuat struktur ${newTables.length} tabel baru di MySQL lokal (data akan disinkronkan saat proses Sync).`,
                timestamp: new Date().toLocaleTimeString(),
              });
            }

            if (droppedTables.length === 0 && newTables.length === 0) {
              addLog({
                type: 'info',
                message: `✨ Semua ${tables.length} tabel di PMA dan MySQL lokal sudah sinkron dan selaras.`,
                timestamp: new Date().toLocaleTimeString(),
              });
            }

            // Perbarui selectedTables
            const currentSelected = new Set(selectedTables.value || []);
            droppedTables.forEach((t) => currentSelected.delete(t));
            newTables.forEach((t) => currentSelected.add(t));
            if (currentSelected.size === 0) {
              selectedTables.value = [...tables];
            } else {
              selectedTables.value = tables.filter((t) => currentSelected.has(t));
            }
          } else {
            selectedTables.value = [...tables];
          }
        } catch (localErr) {
          addLog({
            type: 'warning',
            message: `Pengecekan database MySQL lokal dilewati: ${localErr.message || localErr}`,
            timestamp: new Date().toLocaleTimeString(),
          });
          selectedTables.value = [...tables];
        }
      } else {
        selectedTables.value = [...tables];
      }

      availableTables.value = tables;
      saveTablesForServerKey(currentServerKey.value, tables, selectedTables.value);
      refreshTableStates();
      notifyToast({
        type: 'success',
        title: 'Daftar tabel diperbarui',
        message: `${tables.length} tabel ditemukan di database ${trimmedDb}.`,
      });
    } else {
      notifyToast({
        type: 'warning',
        title: 'Tabel tidak ditemukan',
        message: `Tidak ada tabel yang ditemukan di database ${pmaConfig.value.database}.`,
      });
      addLog({
        type: 'error',
        message: `Tidak ada tabel yang ditemukan di database '${pmaConfig.value.database}'. Tips: 1) Pastikan penulisan nama database benar (Linux MySQL bersifat case-sensitive). 2) Pastikan user PMA memiliki hak akses SELECT. 3) Klik status PMA di header untuk menguji koneksi terlebih dahulu.`,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  } catch (err) {
    notifyToast({
      type: 'error',
      title: 'Gagal mengambil tabel',
      message: err.message || String(err),
    });
    addLog({
      type: 'error',
      message: `Gagal menarik daftar tabel: ${err.message || err}`,
      timestamp: new Date().toLocaleTimeString(),
    });
  } finally {
    fetchingTables.value = false;
    if (pmaLogUnlisten) pmaLogUnlisten();
  }
};


// Test PMA Remote connection
const testPmaConnection = async () => {
  const trimmedUrl = (pmaConfig.value.url || '').trim().replace(/\/index\.php.*$/, '').replace(/\/$/, '');
  const trimmedDb = (pmaConfig.value.database || '').trim();
  const trimmedUser = (pmaConfig.value.username || '').trim();
  pmaConfig.value.url = trimmedUrl;
  pmaConfig.value.database = trimmedDb;
  pmaConfig.value.username = trimmedUser;

  testingPma.value = true;
  addLog({
    type: 'info',
    message: `Menguji koneksi HTTP ke PMA remote: ${trimmedUrl}...`,
    timestamp: new Date().toLocaleTimeString(),
  });

  try {
    if (isTauri.value) {
      let pmaLogUnlisten = null;
      try {
        pmaLogUnlisten = await safeListen('pma-log', (event) => {
          const { type: t, message } = event.payload || {};
          const logType = t === 'warn' ? 'warning' : (t || 'info');
          addLog({ type: logType, message: `[PMA] ${message}`, timestamp: new Date().toLocaleTimeString() });
        });
      } catch (_) {}

      try {
        const msg = await safeInvoke('test_pma_connection', {
          pmaConfig: {
            url: trimmedUrl,
            username: trimmedUser,
            password: pmaConfig.value.password,
            database: trimmedDb,
            tables: [],
          },
        });
        pmaStatus.value.connected = true;
        notifyToast({ type: 'success', title: 'PMA terhubung', message: 'Koneksi ke phpMyAdmin berhasil.' });
        addLog({
          type: 'success',
          message: `PMA Remote OK: ${msg}`,
          timestamp: new Date().toLocaleTimeString(),
        });
      } finally {
        if (pmaLogUnlisten) pmaLogUnlisten();
      }
    } else {
      const client = new PmaClient(pmaConfig.value);
      const res = await client.authenticate();
      pmaStatus.value.connected = true;
      notifyToast({ type: 'success', title: 'PMA terhubung', message: 'Koneksi ke phpMyAdmin berhasil.' });
      addLog({
        type: 'success',
        message: `PMA Remote OK: ${res.message}`,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  } catch (err) {
    pmaStatus.value.connected = false;
    notifyToast({ type: 'error', title: 'Koneksi PMA gagal', message: err?.message || String(err) });
    addLog({
      type: 'error',
      message: `Tes PMA Remote Gagal: ${err?.message || err}`,
      timestamp: new Date().toLocaleTimeString(),
    });
  } finally {
    testingPma.value = false;
  }
};

// Test Local MySQL connection via Rust IPC
const testLocalConnection = async () => {
  testingLocal.value = true;
  const targetDesc = localConfig.value.use_docker && localConfig.value.docker_container
    ? `Docker [${localConfig.value.docker_container}] & ${localConfig.value.host}:${localConfig.value.port || 3306}`
    : `${localConfig.value.host}:${localConfig.value.port || 3306}`;

  addLog({
    type: 'info',
    message: `Menguji koneksi port native MySQL lokal (${targetDesc})...`,
    timestamp: new Date().toLocaleTimeString(),
  });

  try {
    const res = await safeInvoke('test_local_connection', {
      config: {
        host: localConfig.value.host || '127.0.0.1',
        port: parseInt(localConfig.value.port || 3306, 10),
        username: localConfig.value.username || 'root',
        password: localConfig.value.password || '',
        database: localConfig.value.database || '',
        use_docker: Boolean(localConfig.value.use_docker),
        docker_container: localConfig.value.docker_container || '',
      },
    });

    localStatus.value.connected = true;
    notifyToast({ type: 'success', title: 'MySQL lokal terhubung', message: 'Koneksi ke database lokal berhasil.' });
    addLog({
      type: 'success',
      message: `MySQL Lokal OK: ${res}`,
      timestamp: new Date().toLocaleTimeString(),
    });
  } catch (err) {
    localStatus.value.connected = false;
    notifyToast({ type: 'error', title: 'Koneksi MySQL gagal', message: err?.message || String(err) });
    addLog({
      type: 'error',
      message: `Tes MySQL Lokal Gagal: ${err.message || err}`,
      timestamp: new Date().toLocaleTimeString(),
    });
  } finally {
    testingLocal.value = false;
  }
};

// Live sync progress tracking
let activeEngineInstance = null;

const syncProgress = ref({
  currentTableIndex: 0,
  totalTables: 0,
  currentTableName: '',
  rowsSyncedCurrentTable: 0,
  totalSyncedAllTables: 0,
  status: 'idle',
});

// Stop ongoing sync cycle safely
const handleStopSync = () => {
  if (activeEngineInstance) {
    activeEngineInstance.stopSync();
    notifyToast({ type: 'info', title: 'Sinkronisasi dihentikan', message: 'Permintaan berhenti telah dikirim. Data yang sudah tersimpan tetap aman.' });
  }
  // Safety fallback: pastikan state UI kembali responsif dalam 2 detik
  setTimeout(() => {
    if (isSyncing.value && (!activeEngineInstance || !activeEngineInstance.isSyncing)) {
      isSyncing.value = false;
      syncProgress.value.status = 'idle';
    }
  }, 2000);
};

// Execute full sync cycle across selected tables
const handleStartSync = async () => {
  if (isSyncing.value) return;

  const tablesToSync = selectedTables.value.length > 0
    ? selectedTables.value
    : [pmaConfig.value.table || 'users'];

  const expectedTotal = tablesToSync.length;

  notifyToast({
    type: 'info',
    title: 'Sinkronisasi dimulai',
    message: `Memproses ${expectedTotal} tabel dengan mode ${syncMode.value === 'fresh' ? 'Fresh Sync' : 'Sync Server'}.`,
  });
  isSyncing.value = true;
  syncProgress.value = {
    currentTableIndex: 0,
    totalTables: expectedTotal,
    currentTableName: tablesToSync[0] || '',
    rowsSyncedCurrentTable: 0,
    totalSyncedAllTables: 0,
    status: 'starting',
  };

  const engine = new SyncEngine(pmaConfig.value, localConfig.value, {
    onLog: addLog,
    onTableSynced: refreshTableStates,
    onProgress: (p) => {
      const rowsCount = p.rowsSyncedCurrentTable ?? p.rowsSyncedForCurrentTable ?? 0;
      const rawTableIndex = p.currentTableIndex || 0;
      // Pastikan index tabel tidak pernah melebihi total dan tidak melompat mundur karena out-of-order event multi-worker
      const safeTableIndex = Math.min(
        Math.max(rawTableIndex, syncProgress.value.currentTableIndex || 0),
        expectedTotal
      );
      const safeTotalRows = Math.max(
        p.totalSyncedAllTables || 0,
        syncProgress.value.totalSyncedAllTables || 0
      );

      syncProgress.value = {
        currentTableIndex: safeTableIndex,
        totalTables: expectedTotal, // Terkunci presisi ke jumlah tabel yang dipilih
        currentTableName: p.currentTableName || syncProgress.value.currentTableName || '',
        rowsSyncedCurrentTable: rowsCount,
        rowsSyncedForCurrentTable: rowsCount,
        totalSyncedAllTables: safeTotalRows,
        status: p.status || 'idle',
      };
    },
  });
  activeEngineInstance = engine;

  try {
    const res = await engine.runMultiTableSync({
      tables: tablesToSync,
      syncMode: syncMode.value,
      rowLimit: rowLimit.value,
      batchSize: 2000,
    });

    const countSynced = (res && res.totalRowsSynced !== undefined ? res.totalRowsSynced : res?.count) || syncProgress.value.totalSyncedAllTables || 0;
    stats.value.totalSynced = countSynced;
    if (res && res.durationMs) stats.value.lastDuration = res.durationMs;
    stats.value.lastSyncTime = new Date().toLocaleTimeString('id-ID').replace(/\./g, ':');

    if (res && res.success) {
      pmaStatus.value.connected = true;
      localStatus.value.connected = true;
      notifyToast({
        type: 'success',
        title: 'Sinkronisasi selesai',
        message: `${Number(countSynced).toLocaleString('id-ID')} baris berhasil diproses.`,
      });
    } else {
      notifyToast({ type: 'warning', title: 'Sinkronisasi selesai dengan catatan', message: 'Periksa Console Log untuk detail hasil sinkronisasi.' });
    }
  } catch (err) {
    notifyToast({ type: 'error', title: 'Sinkronisasi gagal', message: err?.message || String(err) });
    addLog({
      type: 'error',
      message: `Sinkronisasi gagal: ${err?.message || err}`,
      timestamp: new Date().toLocaleTimeString(),
    });
  } finally {
    activeEngineInstance = null;
    isSyncing.value = false;
    refreshTableStates();
  }
};
</script>

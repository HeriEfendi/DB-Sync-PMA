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

          <!-- Connection Configuration Modal -->
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

          <!-- Console Dialog / Minimized Dock -->
          <ConsoleModal
            :show="showConsoleModal"
            v-model:minimized="consoleMinimized"
            :is-syncing="isSyncing"
            :logs="logs"
            @close="showConsoleModal = false"
            @clear-logs="clearLogs"
          />

          <!-- Action Dialog (Confirm & Input) -->
          <ActionDialogModal
            :dialog="actionDialog"
            @confirm="finishActionDialog"
            @cancel="cancelActionDialog"
          />

          <!-- Toast Notifications -->
          <ToastNotificationStack
            :toasts="toasts"
            @dismiss="dismissToast"
          />
        </main>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { getVersion } from '@tauri-apps/api/app';
import packageJson from '../package.json';

import Navbar from './components/Navbar.vue';
import ConnectionConfigSection from './components/ConnectionConfigSection.vue';
import TableConfig from './components/TableConfig.vue';
import SyncControl from './components/SyncControl.vue';
import ConsoleModal from './components/modals/ConsoleModal.vue';
import ActionDialogModal from './components/modals/ActionDialogModal.vue';
import ToastNotificationStack from './components/modals/ToastNotificationStack.vue';

import { isTauriEnvironment } from './services/tauriHelper.js';
import { useToast } from './composables/useToast.js';
import { useActionDialog } from './composables/useActionDialog.js';
import { useSyncLogs } from './composables/useSyncLogs.js';
import { useConnectionConfig } from './composables/useConnectionConfig.js';
import { useTableSync } from './composables/useTableSync.js';
import { useSyncRunner } from './composables/useSyncRunner.js';

const isTauri = ref(isTauriEnvironment());
const appVersion = ref(packageJson.version);
const showConnectionModal = ref(false);
const showConsoleModal = ref(false);
const consoleMinimized = ref(false);
const connectionConfigRef = ref(null);

const { toasts, notifyToast, dismissToast } = useToast();
const { actionDialog, requestConfirmation, requestInput, finishActionDialog, cancelActionDialog } = useActionDialog();
const { logs, addLog, clearLogs, loadSavedLogs } = useSyncLogs();

const {
  pmaConfig,
  localConfig,
  pmaStatus,
  localStatus,
  currentPresetName,
  currentServerKey,
  loadSavedConnectionConfig,
  debounceStorageSave,
} = useConnectionConfig();

const {
  availableTables,
  selectedTables,
  tableStates,
  fetchingTables,
  refreshTableStates,
  handleResetTableState,
  handleResetAllTableStates,
  loadTablesForServerKey,
  fetchTablesFromPma,
} = useTableSync({
  pmaConfig,
  localConfig,
  currentServerKey,
  pmaStatus,
  isTauri,
  addLog,
  notifyToast,
});

const {
  isSyncing,
  syncMode,
  rowLimit,
  autoSyncInterval,
  testingPma,
  testingLocal,
  stats,
  syncProgress,
  testPmaConnection,
  testLocalConnection,
  handleStartSync,
  handleStopSync,
} = useSyncRunner({
  pmaConfig,
  localConfig,
  selectedTables,
  pmaStatus,
  localStatus,
  isTauri,
  refreshTableStates,
  addLog,
  notifyToast,
  debounceStorageSave,
});

const openConsole = () => {
  showConsoleModal.value = true;
  consoleMinimized.value = false;
};

watch(isSyncing, (syncing, wasSyncing) => {
  if (syncing && !wasSyncing) openConsole();
});

const handlePresetChanged = (presetName) => {
  pmaStatus.value.connected = false;
  localStatus.value.connected = false;
  if (presetName !== undefined && presetName !== null) {
    currentPresetName.value = presetName;
  }
  refreshTableStates();
};

onMounted(async () => {
  loadSavedConnectionConfig();
  loadSavedLogs();

  try {
    const savedMode = localStorage.getItem('db_sync_mode');
    const savedLimit = localStorage.getItem('db_sync_row_limit');
    const savedStats = localStorage.getItem('db_sync_stats');
    if (savedMode) syncMode.value = savedMode;
    if (savedLimit !== null && savedLimit !== undefined) rowLimit.value = parseInt(savedLimit, 10);
    if (savedStats) Object.assign(stats.value, JSON.parse(savedStats));
  } catch (e) {
    console.error('Failed reading saved sync config:', e);
  }

  loadTablesForServerKey(currentServerKey.value);
  refreshTableStates();

  if (isTauri.value) {
    try {
      const tauriVer = await getVersion();
      if (tauriVer) appVersion.value = tauriVer;
    } catch (_) {}
    addLog({ type: 'success', message: 'Runtime Desktop Tauri terdeteksi dan aktif.' });
  } else {
    addLog({
      type: 'warning',
      message: 'Aplikasi berjalan di Web Browser. Untuk sinkronisasi ke port MySQL lokal, jalankan: npm run tauri dev',
    });
  }

  addLog({
    type: 'info',
    message: 'DB-Sync Desktop Client siap. Pilih tabel dan mode sinkronisasi, lalu tekan "Mulai Sinkronisasi Data".',
  });
});
</script>

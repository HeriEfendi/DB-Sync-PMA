import { ref, watch, onUnmounted } from 'vue';
import { safeInvoke, safeListen } from '../services/tauriHelper.js';
import { PmaClient } from '../services/pmaClient.js';
import { SyncEngine } from '../services/syncEngine.js';

export function useSyncRunner({
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
}) {
  const isSyncing = ref(false);
  const syncMode = ref('incremental');
  const rowLimit = ref(0);
  const autoSyncInterval = ref(0);
  let timerId = null;

  const testingPma = ref(false);
  const testingLocal = ref(false);

  const stats = ref({
    totalSynced: 0,
    lastDuration: 0,
    lastSyncTime: '',
  });

  const syncProgress = ref({
    currentTableIndex: 0,
    totalTables: 0,
    currentTableName: '',
    rowsSyncedCurrentTable: 0,
    totalSyncedAllTables: 0,
    status: 'idle',
  });

  let activeEngineInstance = null;

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
    });

    try {
      if (isTauri.value) {
        let pmaLogUnlisten = null;
        try {
          pmaLogUnlisten = await safeListen('pma-log', (event) => {
            const { type: t, message } = event.payload || {};
            const logType = t === 'warn' ? 'warning' : (t || 'info');
            addLog({ type: logType, message: `[PMA] ${message}` });
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
          addLog({ type: 'success', message: `PMA Remote OK: ${msg}` });
        } finally {
          if (pmaLogUnlisten) pmaLogUnlisten();
        }
      } else {
        const client = new PmaClient(pmaConfig.value);
        const res = await client.authenticate();
        pmaStatus.value.connected = true;
        notifyToast({ type: 'success', title: 'PMA terhubung', message: 'Koneksi ke phpMyAdmin berhasil.' });
        addLog({ type: 'success', message: `PMA Remote OK: ${res.message}` });
      }
    } catch (err) {
      pmaStatus.value.connected = false;
      notifyToast({ type: 'error', title: 'Koneksi PMA gagal', message: err?.message || String(err) });
      addLog({ type: 'error', message: `Tes PMA Remote Gagal: ${err?.message || err}` });
    } finally {
      testingPma.value = false;
    }
  };

  const testLocalConnection = async () => {
    testingLocal.value = true;
    const targetDesc = localConfig.value.use_docker && localConfig.value.docker_container
      ? `Docker [${localConfig.value.docker_container}] & ${localConfig.value.host}:${localConfig.value.port || 3306}`
      : `${localConfig.value.host}:${localConfig.value.port || 3306}`;

    addLog({
      type: 'info',
      message: `Menguji koneksi port native MySQL lokal (${targetDesc})...`,
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
      addLog({ type: 'success', message: `MySQL Lokal OK: ${res}` });
    } catch (err) {
      localStatus.value.connected = false;
      notifyToast({ type: 'error', title: 'Koneksi MySQL gagal', message: err?.message || String(err) });
      addLog({ type: 'error', message: `Tes MySQL Lokal Gagal: ${err.message || err}` });
    } finally {
      testingLocal.value = false;
    }
  };

  const handleStopSync = () => {
    if (activeEngineInstance) {
      activeEngineInstance.stopSync();
      notifyToast({
        type: 'info',
        title: 'Sinkronisasi dihentikan',
        message: 'Permintaan berhenti telah dikirim. Data yang sudah tersimpan tetap aman.',
      });
    }
    setTimeout(() => {
      if (isSyncing.value && (!activeEngineInstance || !activeEngineInstance.isSyncing)) {
        isSyncing.value = false;
        syncProgress.value.status = 'idle';
      }
    }, 2000);
  };

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
          totalTables: expectedTotal,
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
        notifyToast({
          type: 'warning',
          title: 'Sinkronisasi selesai dengan catatan',
          message: 'Periksa Console Log untuk detail hasil sinkronisasi.',
        });
      }
    } catch (err) {
      notifyToast({
        type: 'error',
        title: 'Sinkronisasi gagal',
        message: err?.message || String(err),
      });
      addLog({
        type: 'error',
        message: `Sinkronisasi gagal: ${err?.message || err}`,
      });
    } finally {
      activeEngineInstance = null;
      isSyncing.value = false;
      refreshTableStates();
    }
  };

  watch(autoSyncInterval, (sec) => {
    if (timerId) clearInterval(timerId);

    if (sec > 0) {
      addLog({
        type: 'warning',
        message: `Sinkronisasi Otomatis Dihidupkan (Setiap ${sec} detik).`,
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
      });
    }
  });

  watch(syncMode, (val) => debounceStorageSave('db_sync_mode', val));
  watch(rowLimit, (val) => debounceStorageSave('db_sync_row_limit', String(val)));
  watch(stats, (val) => debounceStorageSave('db_sync_stats', val), { deep: true });

  onUnmounted(() => {
    if (timerId) clearInterval(timerId);
  });

  return {
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
  };
}


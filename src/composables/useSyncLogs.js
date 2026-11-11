import { ref } from 'vue';

export function useSyncLogs() {
  const logs = ref([]);
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
      logs.value = logs.value.filter(
        (l) =>
          !(
            (l.tableName === tableName ||
              (l.message && l.message.includes(`[Tabel '${tableName}']`))) &&
            (l.isTransient || l.type === 'info')
          )
      );
    }

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
        } catch (_) {}
        logSaveTimer = null;
      }, 2500);
    }
  };

  const clearLogs = () => {
    logs.value = [];
  };

  const loadSavedLogs = () => {
    try {
      const savedLogs = localStorage.getItem('db_sync_logs');
      if (savedLogs) {
        const parsed = JSON.parse(savedLogs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          logs.value = parsed;
        }
      }
    } catch (_) {}
  };

  return {
    logs,
    addLog,
    clearLogs,
    loadSavedLogs,
  };
}


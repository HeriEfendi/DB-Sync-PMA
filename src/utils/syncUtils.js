import { safeInvoke } from '../services/tauriHelper.js';
import { getTableState, saveTableState } from '../services/syncStateStore.js';
import { formatMySQLDateTime } from './formatters.js';

export const normalizeLocalDbConfig = (localDbConfig) => ({
  host: localDbConfig?.host || '127.0.0.1',
  port: parseInt(localDbConfig?.port || 3306, 10),
  username: localDbConfig?.username || 'root',
  password: localDbConfig?.password || '',
  database: localDbConfig?.database || '',
  use_docker: Boolean(localDbConfig?.use_docker),
  docker_container: localDbConfig?.docker_container || '',
});

export const updateSyncedTableStates = async (serverHost, database, tableNames, tablePrimaryKeys, pmaDefaultPk, localConfig, onTableSynced) => {
  const lastSyncTime = formatMySQLDateTime();

  let batchResults = null;
  try {
    batchResults = await safeInvoke('get_all_tables_last_local_ids', {
      config: localConfig,
      tables: tableNames,
    });
  } catch (batchErr) {
    console.warn('[Sync state] Batch last ID query gagal, fallback ke sequential:', batchErr);
  }

  for (const tableName of tableNames) {
    const tableInfo = batchResults ? batchResults[tableName] : null;
    const detectedPk = tableInfo?.primary_key || tablePrimaryKeys[tableName] || pmaDefaultPk?.trim() || 'id';
    const existingState = getTableState(serverHost, database, tableName);
    let lastSyncedId = tableInfo?.last_id ?? null;

    if (!tableInfo) {
      try {
        lastSyncedId = await safeInvoke('get_last_local_id', {
          config: localConfig,
          tableName,
          primaryKey: detectedPk,
        });
      } catch (error) {
        console.warn(`[Sync state] Gagal membaca MAX(${detectedPk}) untuk '${tableName}':`, error);
      }
    }

    const isValidNewId = lastSyncedId !== null && lastSyncedId !== undefined && lastSyncedId !== 0 && lastSyncedId !== '0';
    const finalLastSyncedId = isValidNewId ? lastSyncedId : (existingState?.lastSyncedId ?? null);

    saveTableState(serverHost, database, tableName, {
      lastSyncedId: finalLastSyncedId,
      lastSyncTime,
      rowsSynced: 0,
      primaryKey: detectedPk,
    });
    if (typeof onTableSynced === 'function') {
      onTableSynced(tableName);
    }
  }
};


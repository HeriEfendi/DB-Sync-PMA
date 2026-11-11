import { ref, watch } from 'vue';
import { safeInvoke, safeListen } from '../services/tauriHelper.js';
import { PmaClient } from '../services/pmaClient.js';
import { SyncEngine } from '../services/syncEngine.js';
import { getAllTableStates, clearTableState, clearAllTableStates } from '../services/syncStateStore.js';

export function useTableSync({
  pmaConfig,
  localConfig,
  currentServerKey,
  pmaStatus,
  isTauri,
  addLog,
  notifyToast,
}) {
  const availableTables = ref([]);
  const selectedTables = ref([]);
  const tableStates = ref([]);
  const fetchingTables = ref(false);

  const refreshTableStates = () => {
    tableStates.value = getAllTableStates(pmaConfig.value.url, pmaConfig.value.database);
  };

  const handleResetTableState = (st) => {
    clearTableState(st.server, st.database, st.table);
    refreshTableStates();
    notifyToast({
      type: 'success',
      title: 'State tabel direset',
      message: `Riwayat sinkronisasi tabel ${st.table} dihapus.`,
    });
    addLog({
      type: 'info',
      message: `State sync tabel '${st.table}' di-reset. Sync berikutnya akan mengecek dari awal.`,
    });
  };

  const handleResetAllTableStates = () => {
    clearAllTableStates();
    refreshTableStates();
    notifyToast({
      type: 'success',
      title: 'Semua state direset',
      message: 'Seluruh riwayat sinkronisasi tabel telah dihapus.',
    });
    addLog({
      type: 'warning',
      message: `Semua riwayat sync state tabel berhasil di-reset.`,
    });
  };

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

      const globalAvail = localStorage.getItem('db_sync_available_tables');
      const globalSel = localStorage.getItem('db_sync_selected_tables');
      if (globalAvail) {
        try {
          availableTables.value = JSON.parse(globalAvail);
          selectedTables.value = globalSel ? JSON.parse(globalSel) : [];
          saveTablesForServerKey(key, availableTables.value, selectedTables.value);
          return;
        } catch (_) {}
      }

      availableTables.value = [];
      selectedTables.value = [];
    } catch (e) {
      console.error('Failed loading tables for server key:', key, e);
      availableTables.value = [];
      selectedTables.value = [];
    }
  };

  const isPmaArtifact = (name) =>
    ['td', 'text', 'not_null', 'text_plain', 'pre_wrap', 'data'].includes(String(name).toLowerCase());

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
    });

    let pmaLogUnlisten = null;

    try {
      let tables = [];
      if (isTauri.value) {
        try {
          pmaLogUnlisten = await safeListen('pma-log', (event) => {
            const { type: t, message } = event.payload || {};
            const logType = t === 'warn' ? 'warning' : (t || 'info');
            addLog({ type: logType, message: `[PMA] ${message}` });
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
          });
        }
      }

      if (!tables || tables.length === 0) {
        addLog({ type: 'info', message: 'Mencoba fallback JS PmaClient...' });
        try {
          const client = new PmaClient(pmaConfig.value);
          await client.authenticate();
          tables = await client.fetchTablesList();
        } catch (jsErr) {
          addLog({ type: 'warning', message: `JS PmaClient fallback gagal: ${jsErr.message}` });
        }
      }

      if (tables && tables.length > 0) {
        tables = tables.filter((t) => !isPmaArtifact(t));
        availableTables.value = tables;
        pmaStatus.value.connected = true;

        addLog({
          type: 'success',
          message: `✅ Berhasil mengekstrak ${tables.length} tabel dari PMA: ${tables.slice(0, 10).join(', ')}${tables.length > 10 ? ` ... +${tables.length - 10} lainnya` : ''}`,
        });

        // Reconcile with local MySQL database if Tauri is active
        if (isTauri.value && localConfig.value.database) {
          try {
            addLog({
              type: 'info',
              message: `Memeriksa perbedaan skema tabel dengan database MySQL lokal (${localConfig.value.database})...`,
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
              const prevServerTables = new Set(availableTables.value || []);

              const droppedTables = localTables.filter(
                (t) => (prevServerTables.has(t) || isPmaArtifact(t)) && !pmaTableSet.has(t)
              );
              const newTables = tables.filter((t) => !localTableSet.has(t));

              if (droppedTables.length > 0) {
                addLog({
                  type: 'warning',
                  message: `🗑️ Menghapus ${droppedTables.length} tabel di MySQL lokal yang sudah tidak ada di PMA: ${droppedTables.join(', ')}...`,
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
                });
              }

              if (newTables.length > 0) {
                addLog({
                  type: 'info',
                  message: `📥 Ditemukan ${newTables.length} tabel baru di PMA: ${newTables.join(', ')}. Membuat struktur tabel di MySQL lokal...`,
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
                  message: `✅ Selesai membuat struktur ${newTables.length} tabel baru di MySQL lokal.`,
                });
              }

              if (droppedTables.length === 0 && newTables.length === 0) {
                addLog({
                  type: 'info',
                  message: `✨ Semua ${tables.length} tabel di PMA dan MySQL lokal sudah sinkron dan selaras.`,
                });
              }

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
          message: `Tidak ada tabel yang ditemukan di database '${pmaConfig.value.database}'.`,
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
      });
    } finally {
      fetchingTables.value = false;
      if (pmaLogUnlisten) pmaLogUnlisten();
    }
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

  watch(availableTables, (val) => {
    saveTablesForServerKey(currentServerKey.value, val, selectedTables.value);
  }, { deep: true });

  watch(selectedTables, (val) => {
    saveTablesForServerKey(currentServerKey.value, availableTables.value, val);
  }, { deep: true });

  return {
    availableTables,
    selectedTables,
    tableStates,
    fetchingTables,
    refreshTableStates,
    handleResetTableState,
    handleResetAllTableStates,
    loadTablesForServerKey,
    saveTablesForServerKey,
    fetchTablesFromPma,
  };
}


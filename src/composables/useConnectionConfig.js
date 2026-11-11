import { ref, computed, watch } from 'vue';

export const computeServerKey = (pma, preset = '') => {
  const p = (preset || '').trim();
  if (p) {
    return `preset_${p.replace(/[^a-zA-Z0-9_\-]/g, '_')}`;
  }
  const u = (pma?.url || '').trim().toLowerCase().replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9_\-]/g, '_');
  const d = (pma?.database || '').trim().toLowerCase().replace(/[^a-zA-Z0-9_\-]/g, '_');
  if (!u && !d) return 'default';
  return `server_${u}___${d}`;
};

export function useConnectionConfig() {
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

  const pmaStatus = ref({ connected: false });
  const localStatus = ref({ connected: false });
  const currentPresetName = ref(localStorage.getItem('db_sync_last_preset') || '');

  const currentServerKey = computed(() => computeServerKey(pmaConfig.value, currentPresetName.value));

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

  watch(pmaConfig, (val) => debounceStorageSave('db_sync_pma_config', val), { deep: true });
  watch(localConfig, (val) => debounceStorageSave('db_sync_local_config', val), { deep: true });

  const loadSavedConnectionConfig = () => {
    try {
      const savedPma = localStorage.getItem('db_sync_pma_config');
      const savedLocal = localStorage.getItem('db_sync_local_config');
      if (savedPma) Object.assign(pmaConfig.value, JSON.parse(savedPma));
      if (savedLocal) Object.assign(localConfig.value, JSON.parse(savedLocal));
    } catch (e) {
      console.error('Failed reading saved connection config:', e);
    }
  };

  return {
    pmaConfig,
    localConfig,
    pmaStatus,
    localStatus,
    currentPresetName,
    currentServerKey,
    loadSavedConnectionConfig,
    debounceStorageSave,
  };
}


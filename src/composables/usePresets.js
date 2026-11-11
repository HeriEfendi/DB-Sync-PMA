import { ref, watch } from 'vue';

export function usePresets({ pmaConfig, localConfig, emit, notifyToast, requestInput, requestConfirmation }) {
  const presets = ref({});
  const selectedPresetName = ref('');

  const loadPresetList = () => {
    try {
      const raw = localStorage.getItem('db_sync_presets');
      if (raw) presets.value = JSON.parse(raw);
    } catch (e) {
      console.error('Failed loading presets:', e);
    }
  };

  const createPreset = async () => {
    const name = await requestInput({
      title: 'Tambah profil koneksi',
      placeholder: 'Contoh: Production Core Sync',
      confirmLabel: 'Tambah profil',
    });
    if (!name || !name.trim()) return;
    const trimmed = name.trim();

    presets.value[trimmed] = {
      pmaConfig: { ...pmaConfig.value },
      localConfig: { ...localConfig.value },
    };

    localStorage.setItem('db_sync_presets', JSON.stringify(presets.value));
    selectedPresetName.value = trimmed;
    emit('update:selected-preset', trimmed);
    emit('preset-changed', trimmed);
    notifyToast({
      type: 'success',
      title: 'Profil ditambahkan',
      message: `Profil koneksi "${trimmed}" berhasil dibuat.`,
    });
  };

  const updatePreset = () => {
    const name = selectedPresetName.value;
    if (!name || !presets.value[name]) return;

    presets.value[name] = {
      pmaConfig: { ...pmaConfig.value },
      localConfig: { ...localConfig.value },
    };

    localStorage.setItem('db_sync_presets', JSON.stringify(presets.value));
    notifyToast({
      type: 'success',
      title: 'Profil diperbarui',
      message: `Perubahan profil "${name}" berhasil disimpan.`,
    });
  };

  const deletePreset = async () => {
    const name = selectedPresetName.value;
    if (!name || !presets.value[name]) return;
    const confirmed = await requestConfirmation({
      title: 'Hapus profil koneksi?',
      message: `Profil "${name}" akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`,
      confirmLabel: 'Hapus profil',
    });
    if (!confirmed) return;

    delete presets.value[name];
    localStorage.setItem('db_sync_presets', JSON.stringify(presets.value));
    selectedPresetName.value = '';
    emit('update:selected-preset', '');
    emit('preset-changed', '');
    emit('update:pma-config', { url: '', username: '', password: '', database: '' });
    emit('update:local-config', { host: '', port: 3306, username: '', password: '', database: '' });
    notifyToast({
      type: 'success',
      title: 'Profil dihapus',
      message: `Profil koneksi "${name}" berhasil dihapus.`,
    });
  };

  const loadPreset = async () => {
    const name = selectedPresetName.value;
    emit('update:selected-preset', name);
    emit('preset-changed', name);

    if (!name) {
      emit('update:pma-config', { url: '', username: '', password: '', database: '' });
      emit('update:local-config', { host: '', port: 3306, username: '', password: '', database: '' });
    } else if (presets.value[name]) {
      const p = presets.value[name];
      if (p.pmaConfig) emit('update:pma-config', { ...p.pmaConfig });
      if (p.localConfig) emit('update:local-config', { ...p.localConfig });
    }

    if (name) {
      notifyToast({
        type: 'success',
        title: 'Profil dimuat',
        message: `Konfigurasi profil "${name}" diterapkan.`,
      });
    }
    emit('test-pma');
    emit('test-local');
  };

  const selectPreset = async (name) => {
    selectedPresetName.value = name;
    await loadPreset();
  };

  watch(selectedPresetName, (name) => {
    if (name) {
      localStorage.setItem('db_sync_last_preset', name);
    } else {
      localStorage.removeItem('db_sync_last_preset');
    }
    emit('update:selected-preset', name);
  });

  return {
    presets,
    selectedPresetName,
    loadPresetList,
    createPreset,
    updatePreset,
    deletePreset,
    loadPreset,
    selectPreset,
  };
}


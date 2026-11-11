<template>
  <div data-ui="connection" class="glass-panel config-card">
    <div class="card-header">
      <div class="title-wrap">
        <h3>Konfigurasi Database</h3>
        <p class="subtitle">Atur kredensial remote PMA dan MySQL lokal untuk sinkronisasi.</p>
      </div>

      <div class="preset-controls">
        <button
          class="btn btn-secondary btn-sm"
          title="Simpan perubahan ke preset yang dipilih"
          :disabled="!selectedPresetName"
          @click="updatePreset"
        >
          Simpan
        </button>
        <button
          class="btn btn-danger btn-sm"
          type="button"
          :disabled="!selectedPresetName"
          @click="deletePreset"
        >
          Hapus
        </button>
      </div>
    </div>

    <div class="tab-header">
      <button
        data-tab="remote"
        class="tab-btn"
        :class="{ active: activeTab === 'remote' }"
        @click="activeTab = 'remote'"
      >
        <span>1. Remote PMA</span>
      </button>
      <button
        data-tab="local"
        class="tab-btn"
        :class="{ active: activeTab === 'local' }"
        @click="activeTab = 'local'"
      >
        <span>2. MySQL Lokal</span>
      </button>
    </div>

    <PmaConnectionTab
      v-show="activeTab === 'remote'"
      :config="pmaConfig"
      @update:config="$emit('update:pma-config', $event)"
    />

    <LocalConnectionTab
      v-show="activeTab === 'local'"
      :config="localConfig"
      @update:config="$emit('update:local-config', $event)"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { usePresets } from '../composables/usePresets.js';
import PmaConnectionTab from './connection/PmaConnectionTab.vue';
import LocalConnectionTab from './connection/LocalConnectionTab.vue';

const props = defineProps({
  pmaConfig: { type: Object, required: true },
  localConfig: { type: Object, required: true },
  selectedPreset: { type: String, default: '' },
  requestConfirmation: { type: Function, required: true },
  requestInput: { type: Function, required: true },
  notifyToast: { type: Function, required: true },
});

const emit = defineEmits([
  'update:pma-config',
  'update:local-config',
  'update:selected-preset',
  'test-pma',
  'test-local',
  'preset-changed',
]);

const activeTab = ref('remote');
const pmaConfig = ref({ ...props.pmaConfig });
const localConfig = ref({ ...props.localConfig });

watch(() => props.pmaConfig, (val) => { pmaConfig.value = { ...val }; }, { deep: true });
watch(() => props.localConfig, (val) => { localConfig.value = { ...val }; }, { deep: true });

const {
  presets,
  selectedPresetName,
  loadPresetList,
  createPreset,
  updatePreset,
  deletePreset,
  selectPreset,
} = usePresets({
  pmaConfig,
  localConfig,
  emit,
  notifyToast: props.notifyToast,
  requestInput: props.requestInput,
  requestConfirmation: props.requestConfirmation,
});

watch(() => props.selectedPreset, (val) => {
  if (val !== undefined && val !== selectedPresetName.value) {
    selectedPresetName.value = val;
  }
});

onMounted(() => {
  loadPresetList();
  const lastPreset = localStorage.getItem('db_sync_last_preset');
  if (lastPreset && presets.value[lastPreset]) {
    selectedPresetName.value = lastPreset;
    emit('update:selected-preset', lastPreset);
    const p = presets.value[lastPreset];
    if ((!props.pmaConfig?.url || !props.pmaConfig?.database) && p?.pmaConfig) {
      emit('update:pma-config', { ...p.pmaConfig });
    }
    if (!props.localConfig?.database && p?.localConfig) {
      emit('update:local-config', { ...p.localConfig });
    }
  } else {
    selectedPresetName.value = '';
    emit('update:selected-preset', '');
  }
});

defineExpose({ presets, selectPreset, createPreset, updatePreset, deletePreset });
</script>

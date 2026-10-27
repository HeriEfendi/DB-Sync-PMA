<template>
  <div data-ui="tables" class="glass-panel config-card">
    <div class="card-header">
      <div class="title-wrap">
        <div class="title-row">
          <h3>Daftar Tabel</h3>
        </div>
        <p class="subtitle">Pilih tabel yang akan disinkronkan dan simpan template centangan untuk reuse.</p>
      </div>
    </div>
    <div class="table-tools-bar">
      <button class="btn btn-primary btn-sm" :disabled="fetchingTables" @click="$emit('fetch-tables')">
        <span v-if="fetchingTables" class="spin-sm"></span>
        <span>Ambil Tabel</span>
      </button>
      <div class="table-search-box"><input v-model="tableSearchQuery" type="text" class="form-input form-input-sm" placeholder="Cari tabel..." /></div>
      <button class="btn btn-ghost btn-xs" @click="selectAllTables">Centang Semua</button>
      <button class="btn btn-ghost btn-xs" @click="deselectAllTables">Hapus Centang</button>
      <div class="selection-info-pill">
        <span>Terpilih: <strong>{{ selectedTables.length }}</strong> / {{ availableTables.length }}</span>
      </div>
      <div class="tools-divider"></div>
      <select v-model="selectedTemplateName" class="form-select preset-select" @change="loadTableTemplate"><option value="">-- Template Tabel --</option><option v-for="(t, key) in tableTemplates" :key="key" :value="key">{{ key }}</option></select>
      <button class="btn btn-secondary btn-xs" :disabled="!selectedTemplateName" @click="updateTableTemplate">Simpan</button>
      <button class="btn btn-primary btn-xs" @click="createTableTemplate">Buat</button>
      <button class="btn btn-danger btn-xs" :disabled="!selectedTemplateName" @click="deleteTableTemplate">Hapus</button>
    </div>

    <div class="table-select-container">
      <div v-if="availableTables.length === 0" class="empty-tables-hint">
        <span>Belum ada daftar tabel. Klik <strong>"Ambil Tabel"</strong> untuk mendeteksi tabel dari database remote, atau ketik nama tabel secara manual.</span>
        <div class="manual-table-input">
          <input v-model="manualTableName" type="text" class="form-input form-input-sm" placeholder="Nama tabel manual (misal: users)" @keyup.enter="addManualTable" />
          <button class="btn btn-secondary btn-xs" @click="addManualTable">+ Tambah</button>
        </div>
      </div>

      <div v-else class="table-checkbox-grid-wrap">
        <div class="table-checkbox-grid">
          <label
            v-for="tableName in displayedTables"
            :key="tableName"
            class="table-checkbox-card"
            :class="{ selected: selectedTablesSet.has(tableName) }"
          >
            <input
              type="checkbox"
              :value="tableName"
              :checked="selectedTablesSet.has(tableName)"
              @change="toggleTableSelection(tableName)"
            />
            <div class="table-card-body">
              <span class="table-name-text" :title="tableName">{{ tableName }}</span>
              <div class="table-card-meta">
                <template v-if="tableStateMap.get(tableName)">
                  <span class="meta-item">
                    <span class="meta-label">Last ID:</span>
                    <strong class="text-amber">{{ tableStateMap.get(tableName).lastSyncedId !== null && tableStateMap.get(tableName).lastSyncedId !== undefined ? tableStateMap.get(tableName).lastSyncedId : '-' }}</strong>
                  </span>
                  <span class="meta-item">
                    <span class="meta-label">Sync:</span>
                    <span class="text-muted">{{ formatDate(tableStateMap.get(tableName).lastSyncTime) }}</span>
                  </span>
                </template>
                <span v-else class="meta-item text-dim">Belum pernah sync</span>
              </div>
            </div>
          </label>
        </div>

        <div v-if="filteredTables.length > displayLimit" class="show-more-tables">
          <button type="button" class="btn btn-ghost btn-xs" @click="displayLimit += 60">
            + Tampilkan {{ Math.min(60, filteredTables.length - displayLimit) }} tabel lagi (sisa {{ filteredTables.length - displayLimit }})
          </button>
          <button type="button" class="btn btn-ghost btn-xs" @click="displayLimit = filteredTables.length">
            Tampilkan Semua ({{ filteredTables.length }})
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';

const props = defineProps({
  serverKey: { type: String, default: 'default' },
  selectedTables: { type: Array, default: () => [] },
  availableTables: { type: Array, default: () => [] },
  fetchingTables: { type: Boolean, default: false },
  syncTableStates: { type: Array, default: () => [] },
});

const emit = defineEmits([
  'update:selectedTables',
  'update:availableTables',
  'fetch-tables',
]);

const selectedTablesSet = computed(() => new Set(props.selectedTables));

const tableStateMap = computed(() => {
  const map = new Map();
  if (Array.isArray(props.syncTableStates)) {
    for (let i = 0; i < props.syncTableStates.length; i++) {
      const st = props.syncTableStates[i];
      const key = st._table || st.table;
      if (key) map.set(key, st);
    }
  }
  return map;
});

const formatDate = (isoString) => {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const datePart = d.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timePart = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':');
    return `${datePart}, ${timePart}`;
  } catch {
    return isoString;
  }
};

const tableSearchQuery = ref('');
const manualTableName = ref('');
const selectedTemplateName = ref('');
const tableTemplates = ref({});
const displayLimit = ref(60);

watch(tableSearchQuery, () => {
  displayLimit.value = 60;
});

const getTemplatesStorageKey = () => `db_sync_table_templates_${props.serverKey || 'default'}`;
const getLastTemplateStorageKey = () => `db_sync_last_table_template_${props.serverKey || 'default'}`;

watch(selectedTemplateName, (name) => {
  const lastKey = getLastTemplateStorageKey();
  if (name) {
    localStorage.setItem(lastKey, name);
  } else {
    localStorage.removeItem(lastKey);
  }
});

watch(() => props.serverKey, (newKey) => {
  loadTableTemplateList();
  const lastKey = `db_sync_last_table_template_${newKey || 'default'}`;
  let lastTemplate = localStorage.getItem(lastKey);
  if (!lastTemplate && newKey === 'default') {
    lastTemplate = localStorage.getItem('db_sync_last_table_template');
  }
  if (lastTemplate && tableTemplates.value[lastTemplate]) {
    selectedTemplateName.value = lastTemplate;
  } else {
    selectedTemplateName.value = '';
  }
});

onMounted(() => {
  loadTableTemplateList();
  const lastKey = getLastTemplateStorageKey();
  let lastTemplate = localStorage.getItem(lastKey);
  if (!lastTemplate) {
    lastTemplate = localStorage.getItem('db_sync_last_table_template');
  }
  if (lastTemplate && tableTemplates.value[lastTemplate]) {
    selectedTemplateName.value = lastTemplate;
    if ((!props.selectedTables || props.selectedTables.length === 0) && tableTemplates.value[lastTemplate]?.length > 0) {
      emit('update:selectedTables', [...tableTemplates.value[lastTemplate]]);
    }
  } else {
    selectedTemplateName.value = '';
  }
});

const filteredTables = computed(() => {
  if (!tableSearchQuery.value) return props.availableTables;
  const q = tableSearchQuery.value.toLowerCase().trim();
  return props.availableTables.filter((t) => t.toLowerCase().includes(q));
});

const displayedTables = computed(() => {
  return filteredTables.value.slice(0, displayLimit.value);
});

const toggleTableSelection = (tableName) => {
  const current = [...props.selectedTables];
  const idx = current.indexOf(tableName);
  if (idx > -1) current.splice(idx, 1);
  else current.push(tableName);
  emit('update:selectedTables', current);
};

const selectAllTables = () => {
  const current = new Set(props.selectedTables);
  filteredTables.value.forEach((t) => current.add(t));
  emit('update:selectedTables', [...current]);
};

const deselectAllTables = () => {
  const filtered = new Set(filteredTables.value);
  emit('update:selectedTables', props.selectedTables.filter((t) => !filtered.has(t)));
};

const addManualTable = () => {
  const tName = manualTableName.value.trim();
  if (!tName) return;

  const currentAvailable = [...props.availableTables];
  if (!currentAvailable.includes(tName)) {
    currentAvailable.push(tName);
    emit('update:availableTables', currentAvailable);
  }

  const currentSelected = [...props.selectedTables];
  if (!currentSelected.includes(tName)) {
    currentSelected.push(tName);
    emit('update:selectedTables', currentSelected);
  }

  manualTableName.value = '';
};

const loadTableTemplateList = () => {
  try {
    const key = getTemplatesStorageKey();
    let raw = localStorage.getItem(key);
    if (!raw) {
      raw = localStorage.getItem('db_sync_table_templates');
    }
    tableTemplates.value = raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Failed loading table templates:', e);
    tableTemplates.value = {};
  }
};

const loadTableTemplate = () => {
  const name = selectedTemplateName.value;
  if (!name || !tableTemplates.value[name]) return;
  emit('update:selectedTables', [...tableTemplates.value[name]]);
};

const createTableTemplate = () => {
  const name = prompt('Nama template tabel baru (misal: "Core Tables" atau "HR Module")');
  if (!name || !name.trim()) return;

  const trimmed = name.trim();
  tableTemplates.value[trimmed] = [...props.selectedTables];
  localStorage.setItem(getTemplatesStorageKey(), JSON.stringify(tableTemplates.value));
  selectedTemplateName.value = trimmed;
};

const updateTableTemplate = () => {
  const name = selectedTemplateName.value;
  if (!name) return;
  tableTemplates.value[name] = [...props.selectedTables];
  localStorage.setItem(getTemplatesStorageKey(), JSON.stringify(tableTemplates.value));
};

const deleteTableTemplate = () => {
  const name = selectedTemplateName.value;
  if (!name || !tableTemplates.value[name]) return;
  if (!confirm(`Hapus template "${name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
  delete tableTemplates.value[name];
  localStorage.setItem(getTemplatesStorageKey(), JSON.stringify(tableTemplates.value));
  selectedTemplateName.value = '';
};
</script>

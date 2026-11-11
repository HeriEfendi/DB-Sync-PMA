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
      <div class="table-search-box">
        <input v-model="tableSearchQuery" type="text" class="form-input form-input-sm" placeholder="Cari tabel..." />
      </div>
      <button class="btn btn-ghost btn-xs" @click="selectAllTables">Centang Semua</button>
      <button class="btn btn-ghost btn-xs" @click="deselectAllTables">Hapus Centang</button>
      <div class="selection-info-pill">
        <span>Terpilih: <strong>{{ selectedTables.length }}</strong> / {{ availableTables.length }}</span>
      </div>
      <div class="tools-divider"></div>
      <select v-model="selectedTemplateName" class="form-select preset-select" @change="loadTableTemplate">
        <option value="">-- Template Tabel --</option>
        <option v-for="(t, key) in tableTemplates" :key="key" :value="key">{{ key }}</option>
      </select>
      <label class="sr-only" for="table-template-action">Kelola template tabel</label>
      <select id="table-template-action" class="form-select preset-select" value="" @change="handleTableTemplateAction">
        <option value="" disabled>Kelola Template Tabel</option>
        <option value="update" :disabled="!selectedTemplateName">Update</option>
        <option value="create">Tambah</option>
        <option value="delete" :disabled="!selectedTemplateName">Delete</option>
      </select>
    </div>

    <div class="table-select-container">
      <div v-if="availableTables.length === 0" class="empty-tables-hint">
        <span>Belum ada daftar tabel. Klik <strong>"Ambil Tabel"</strong> untuk mendeteksi tabel dari database remote, atau ketik nama tabel secara manual.</span>
        <div class="manual-table-input">
          <input
            v-model="manualTableName"
            type="text"
            class="form-input form-input-sm"
            placeholder="Nama tabel manual (misal: users)"
            @keyup.enter="addManualTable"
          />
          <button class="btn btn-secondary btn-xs" @click="addManualTable">+ Tambah</button>
        </div>
      </div>

      <div v-else class="table-checkbox-grid-wrap">
        <div class="table-checkbox-grid">
          <TableItemCard
            v-for="tableName in displayedTables"
            :key="tableName"
            :table-name="tableName"
            :is-selected="selectedTablesSet.has(tableName)"
            :table-state="tableStateMap.get(tableName)"
            @toggle="toggleTableSelection"
          />
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
import { ref, computed, watch, onMounted, toRef } from 'vue';
import { useTableTemplates } from '../composables/useTableTemplates.js';
import TableItemCard from './table/TableItemCard.vue';

const props = defineProps({
  serverKey: { type: String, default: 'default' },
  selectedTables: { type: Array, default: () => [] },
  availableTables: { type: Array, default: () => [] },
  fetchingTables: { type: Boolean, default: false },
  syncTableStates: { type: Array, default: () => [] },
  requestConfirmation: { type: Function, required: true },
  requestInput: { type: Function, required: true },
  notifyToast: { type: Function, required: true },
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

const tableSearchQuery = ref('');
const manualTableName = ref('');
const displayLimit = ref(60);

watch(tableSearchQuery, () => {
  displayLimit.value = 60;
});

const {
  selectedTemplateName,
  tableTemplates,
  loadTableTemplateList,
  loadTableTemplate,
  handleTableTemplateAction,
  getLastTemplateStorageKey,
} = useTableTemplates({
  serverKeyRef: toRef(props, 'serverKey'),
  selectedTablesRef: toRef(props, 'selectedTables'),
  emit,
  notifyToast: props.notifyToast,
  requestInput: props.requestInput,
  requestConfirmation: props.requestConfirmation,
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

const displayedTables = computed(() => filteredTables.value.slice(0, displayLimit.value));

const toggleTableSelection = (tableName) => {
  const current = [...props.selectedTables];
  const idx = current.indexOf(tableName);
  if (idx > -1) current.splice(idx, 1);
  else current.push(tableName);
  emit('update:selectedTables', current);
};

const selectAllTables = () => {
  const previousCount = props.selectedTables.length;
  const current = new Set(props.selectedTables);
  filteredTables.value.forEach((t) => current.add(t));
  emit('update:selectedTables', [...current]);
  const addedCount = current.size - previousCount;
  props.notifyToast({
    type: addedCount ? 'success' : 'info',
    title: addedCount ? 'Tabel dipilih' : 'Pilihan sudah lengkap',
    message: addedCount ? `${addedCount} tabel ditambahkan ke pilihan.` : 'Semua tabel yang tampil sudah dipilih.',
  });
};

const deselectAllTables = () => {
  const filtered = new Set(filteredTables.value);
  emit('update:selectedTables', props.selectedTables.filter((t) => !filtered.has(t)));
  props.notifyToast({
    type: 'info',
    title: 'Pilihan tabel dibersihkan',
    message: 'Tabel yang tampil pada daftar sudah tidak dipilih.',
  });
};

const addManualTable = () => {
  const tName = manualTableName.value.trim();
  if (!tName) return;

  const currentAvailable = [...props.availableTables];
  const alreadyExists = currentAvailable.includes(tName);
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
  props.notifyToast({
    type: alreadyExists ? 'info' : 'success',
    title: alreadyExists ? 'Tabel sudah tersedia' : 'Tabel ditambahkan',
    message: alreadyExists
      ? `Tabel ${tName} sudah ada dan dipilih untuk sinkronisasi.`
      : `Tabel ${tName} ditambahkan ke daftar pilihan.`,
  });
};
</script>

import { ref, watch } from 'vue';

export function useTableTemplates({ serverKeyRef, selectedTablesRef, emit, notifyToast, requestInput, requestConfirmation }) {
  const selectedTemplateName = ref('');
  const tableTemplates = ref({});

  const getTemplatesStorageKey = () => `db_sync_table_templates_${serverKeyRef.value || 'default'}`;
  const getLastTemplateStorageKey = () => `db_sync_last_table_template_${serverKeyRef.value || 'default'}`;

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
    notifyToast({
      type: 'success',
      title: 'Template diterapkan',
      message: `${tableTemplates.value[name].length} tabel dipilih dari "${name}".`,
    });
  };

  const createTableTemplate = async () => {
    const name = await requestInput({
      title: 'Tambah template tabel',
      placeholder: 'Contoh: Core Tables',
      confirmLabel: 'Tambah template',
    });
    if (!name || !name.trim()) return;

    const trimmed = name.trim();
    tableTemplates.value[trimmed] = [...selectedTablesRef.value];
    localStorage.setItem(getTemplatesStorageKey(), JSON.stringify(tableTemplates.value));
    selectedTemplateName.value = trimmed;
    notifyToast({
      type: 'success',
      title: 'Template ditambahkan',
      message: `Template "${trimmed}" menyimpan ${selectedTablesRef.value.length} tabel.`,
    });
  };

  const updateTableTemplate = () => {
    const name = selectedTemplateName.value;
    if (!name) return;
    tableTemplates.value[name] = [...selectedTablesRef.value];
    localStorage.setItem(getTemplatesStorageKey(), JSON.stringify(tableTemplates.value));
    notifyToast({
      type: 'success',
      title: 'Template diperbarui',
      message: `${selectedTablesRef.value.length} tabel disimpan ke "${name}".`,
    });
  };

  const deleteTableTemplate = async () => {
    const name = selectedTemplateName.value;
    if (!name || !tableTemplates.value[name]) return;
    const confirmed = await requestConfirmation({
      title: 'Hapus template tabel?',
      message: `Template "${name}" akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`,
      confirmLabel: 'Hapus template',
    });
    if (!confirmed) return;
    delete tableTemplates.value[name];
    localStorage.setItem(getTemplatesStorageKey(), JSON.stringify(tableTemplates.value));
    selectedTemplateName.value = '';
    notifyToast({
      type: 'success',
      title: 'Template dihapus',
      message: `Template "${name}" berhasil dihapus.`,
    });
  };

  const handleTableTemplateAction = (event) => {
    const action = event.target.value;
    event.target.value = '';

    if (action === 'update') updateTableTemplate();
    if (action === 'create') createTableTemplate();
    if (action === 'delete') deleteTableTemplate();
  };

  watch(selectedTemplateName, (name) => {
    const lastKey = getLastTemplateStorageKey();
    if (name) {
      localStorage.setItem(lastKey, name);
    } else {
      localStorage.removeItem(lastKey);
    }
  });

  return {
    selectedTemplateName,
    tableTemplates,
    loadTableTemplateList,
    loadTableTemplate,
    createTableTemplate,
    updateTableTemplate,
    deleteTableTemplate,
    handleTableTemplateAction,
    getLastTemplateStorageKey,
  };
}


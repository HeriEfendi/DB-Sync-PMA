<template>
  <label
    class="table-checkbox-card"
    :class="{ selected: isSelected }"
  >
    <input
      type="checkbox"
      :value="tableName"
      :checked="isSelected"
      @change="$emit('toggle', tableName)"
    />
    <div class="table-card-body">
      <span class="table-name-text" :title="tableName">{{ tableName }}</span>
      <div class="table-card-meta">
        <template v-if="tableState">
          <span class="meta-item">
            <span class="meta-label">Last ID:</span>
            <strong class="text-amber">
              {{ tableState.lastSyncedId !== null && tableState.lastSyncedId !== undefined ? tableState.lastSyncedId : '-' }}
            </strong>
          </span>
          <span class="meta-item">
            <span class="meta-label">Sync:</span>
            <span class="text-muted">{{ formatDate(tableState.lastSyncTime) }}</span>
          </span>
        </template>
        <span v-else class="meta-item text-dim">Belum pernah sync</span>
      </div>
    </div>
  </label>
</template>

<script setup>
import { formatDate } from '../../utils/formatters.js';

defineProps({
  tableName: { type: String, required: true },
  isSelected: { type: Boolean, default: false },
  tableState: { type: Object, default: null },
});

defineEmits(['toggle']);
</script>


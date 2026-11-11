<template>
  <div v-if="syncTableStates && syncTableStates.length > 0" class="sync-states-card">
    <div class="states-header">
      <button
        class="states-toggle"
        type="button"
        :aria-expanded="showSyncStates"
        aria-controls="sync-states-table"
        @click="showSyncStates = !showSyncStates"
      >
        <span class="states-title-wrap">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 8v4l3 3"></path><circle cx="12" cy="12" r="9"></circle>
          </svg>
          <span class="states-title">State &amp; ID Sync Terakhir per Tabel</span>
          <span class="state-count">{{ syncTableStates.length }}</span>
        </span>
        <svg class="toggle-chevron" :class="{ open: showSyncStates }" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m6 9 6 6 6-6"></path>
        </svg>
      </button>
      <button
        v-if="showSyncStates"
        class="btn btn-ghost btn-xs text-rose"
        title="Reset semua riwayat sync state"
        @click="$emit('reset-all')"
      >
        Reset Semua State
      </button>
    </div>

    <div v-if="showSyncStates" id="sync-states-table" class="states-table-wrapper">
      <table class="states-table">
        <thead>
          <tr>
            <th>Server / DB</th>
            <th>Tabel</th>
            <th>Last Synced ID</th>
            <th>Waktu Sync Terakhir</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="st in visibleStates" :key="st.key">
            <td class="font-mono text-dim">{{ st.server }} / {{ st.database }}</td>
            <td class="font-mono text-emerald"><strong>{{ st.table }}</strong></td>
            <td class="font-mono text-amber">
              <strong>{{ st.lastSyncedId !== null && st.lastSyncedId !== undefined ? st.lastSyncedId : '-' }}</strong>
              <small v-if="st.primaryKey" class="text-dim"> ({{ st.primaryKey }})</small>
            </td>
            <td class="text-muted">{{ formatDate(st.lastSyncTime) }}</td>
            <td>
              <button class="btn btn-danger btn-xs" title="Reset state tabel ini" @click="$emit('reset-state', st)">
                Reset
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <div ref="sentinelRef" class="scroll-sentinel"></div>
      <div v-if="visibleStates.length < syncTableStates.length" class="load-more-hint">
        Menampilkan {{ visibleStates.length }} / {{ syncTableStates.length }} — scroll untuk muat lebih banyak
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue';
import { formatDate } from '../../utils/formatters.js';

const props = defineProps({
  syncTableStates: { type: Array, default: () => [] },
});

defineEmits(['reset-state', 'reset-all']);

const showSyncStates = ref(false);
const PAGE_SIZE = 20;
const sentinelRef = ref(null);
const visibleCount = ref(PAGE_SIZE);
let observer = null;

function loadMore() {
  if (visibleCount.value < props.syncTableStates.length) {
    visibleCount.value = Math.min(
      visibleCount.value + PAGE_SIZE,
      props.syncTableStates.length
    );
  }
}

function setupObserver() {
  if (observer) { observer.disconnect(); observer = null; }
  setTimeout(() => {
    if (!sentinelRef.value) return;
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.value);
  }, 100);
}

function teardownObserver() {
  if (observer) { observer.disconnect(); observer = null; }
}

watch(showSyncStates, (val) => {
  if (val) {
    visibleCount.value = PAGE_SIZE;
    setupObserver();
  } else {
    teardownObserver();
  }
});

watch(() => props.syncTableStates, () => {
  visibleCount.value = PAGE_SIZE;
});

const visibleStates = computed(() =>
  props.syncTableStates.slice(0, visibleCount.value)
);

onUnmounted(() => {
  teardownObserver();
});
</script>


<template>
  <aside
    class="flex w-full shrink-0 flex-col border-t border-[#232936] bg-[#0b0f18] md:w-[290px] md:border-l md:border-t-0 lg:w-[310px]"
    aria-label="Status sinkronisasi tabel"
  >
    <div class="flex items-center justify-between border-b border-[#232936] px-3 py-2.5">
      <div class="flex items-center gap-2">
        <span class="text-[12px] font-semibold text-[#edf0f7]">Daftar Tabel</span>
        <span class="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-[#cbd5e1]">
          {{ tables.length }}
        </span>
      </div>
      <div class="flex items-center gap-2 text-[10px] font-semibold">
        <span v-if="counts.completed > 0" class="text-emerald-400" title="Selesai">
          ✓ {{ counts.completed }}
        </span>
        <span v-if="counts.processing > 0" class="text-sky-400" title="Sedang proses">
          ⟳ {{ counts.processing }}
        </span>
        <span v-if="counts.failed > 0" class="text-rose-400" title="Gagal">
          ✕ {{ counts.failed }}
        </span>
      </div>
    </div>

    <div class="flex items-center gap-1 border-b border-[#232936] px-2.5 py-1.5">
      <button
        v-for="tab in filterTabs"
        :key="tab.key"
        type="button"
        :class="[
          'rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
          statusFilter === tab.key
            ? 'bg-[#2563eb]/25 text-[#93c5fd] ring-1 ring-[#3b82f6]/40'
            : 'text-[#94a3b8] hover:bg-white/5 hover:text-[#e2e8f0]',
        ]"
        @click="statusFilter = tab.key"
      >
        {{ tab.label }}
        <span v-if="tab.count > 0" class="ml-0.5 opacity-75">({{ tab.count }})</span>
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto p-1.5">
      <div
        v-if="filteredTables.length === 0"
        class="px-2 py-6 text-center text-[11px] italic text-[#64748b]"
      >
        Tidak ada tabel pada filter ini.
      </div>

      <button
        v-for="item in filteredTables"
        :key="item.name"
        type="button"
        :title="item.detail ? `${item.name} — ${item.detail}` : item.name"
        :class="[
          'mb-1 flex w-full items-start gap-2 rounded-[5px] border px-2.5 py-1.5 text-left transition-colors',
          selectedTable === item.name
            ? 'border-[#3b82f6]/50 bg-[#2563eb]/15'
            : item.status === 'failed'
              ? 'border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10'
              : item.status === 'processing'
                ? 'border-sky-500/30 bg-sky-500/5 hover:bg-sky-500/10'
                : 'border-transparent hover:border-white/10 hover:bg-white/5',
        ]"
        @click="toggleTableSelect(item.name)"
      >
        <CheckCircle2
          v-if="item.status === 'completed'"
          :size="14"
          class="mt-0.5 shrink-0 text-emerald-400"
        />
        <Loader2
          v-else-if="item.status === 'processing'"
          :size="14"
          class="mt-0.5 shrink-0 animate-spin text-sky-400"
        />
        <XCircle
          v-else-if="item.status === 'failed'"
          :size="14"
          class="mt-0.5 shrink-0 text-rose-400"
        />
        <AlertTriangle
          v-else-if="item.status === 'skipped'"
          :size="14"
          class="mt-0.5 shrink-0 text-amber-400"
        />
        <CircleDashed
          v-else
          :size="14"
          class="mt-0.5 shrink-0 text-[#64748b]"
        />

        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-1.5">
            <span
              :class="[
                'truncate font-mono text-[11px]',
                item.status === 'failed'
                  ? 'font-semibold text-rose-200'
                  : item.status === 'processing'
                    ? 'font-semibold text-sky-200'
                    : item.status === 'completed'
                      ? 'text-[#e2e8f0]'
                      : 'text-[#94a3b8]',
              ]"
            >
              {{ item.name }}
            </span>
            <span
              :class="[
                'shrink-0 rounded px-1 py-0.2 text-[9px] font-semibold uppercase',
                badgeClass(item.status),
              ]"
            >
              {{ statusLabel(item.status) }}
            </span>
          </div>
          <p
            v-if="item.detail"
            :class="[
              'mt-0.5 truncate text-[10px]',
              item.status === 'failed' ? 'text-rose-300/90' : 'text-[#64748b]',
            ]"
          >
            {{ item.detail }}
          </p>
        </div>
      </button>
    </div>
  </aside>
</template>

<script>
import { AlertTriangle, CheckCircle2, CircleDashed, Loader2, XCircle } from 'lucide-vue-next';

export default {
  name: 'SyncTableStatusSidebar',
  components: {
    AlertTriangle,
    CheckCircle2,
    CircleDashed,
    Loader2,
    XCircle,
  },
  props: {
    tables: {
      type: Array,
      default: () => [],
    },
    selectedTable: {
      type: String,
      default: '',
    },
  },
  emits: ['select-table'],
  data() {
    return {
      statusFilter: 'all',
    };
  },
  computed: {
    counts() {
      const result = { completed: 0, processing: 0, failed: 0, pending: 0, skipped: 0 };
      for (const item of this.tables) {
        if (result[item.status] !== undefined) {
          result[item.status] += 1;
        } else {
          result.pending += 1;
        }
      }
      return result;
    },
    filterTabs() {
      return [
        { key: 'all', label: 'Semua', count: this.tables.length },
        { key: 'processing', label: 'Proses', count: this.counts.processing },
        { key: 'completed', label: 'Selesai', count: this.counts.completed },
        { key: 'failed', label: 'Gagal', count: this.counts.failed },
      ];
    },
    filteredTables() {
      if (this.statusFilter === 'all') return this.tables;
      return this.tables.filter((item) => item.status === this.statusFilter);
    },
  },
  methods: {
    toggleTableSelect(name) {
      this.$emit('select-table', this.selectedTable === name ? '' : name);
    },
    statusLabel(status) {
      switch (status) {
        case 'completed':
          return 'Selesai';
        case 'processing':
          return 'Proses';
        case 'failed':
          return 'Gagal';
        case 'skipped':
          return 'Skip';
        default:
          return 'Antre';
      }
    },
    badgeClass(status) {
      switch (status) {
        case 'completed':
          return 'bg-emerald-500/15 text-emerald-300';
        case 'processing':
          return 'bg-sky-500/15 text-sky-300';
        case 'failed':
          return 'bg-rose-500/20 text-rose-300';
        case 'skipped':
          return 'bg-amber-500/15 text-amber-300';
        default:
          return 'bg-white/5 text-[#64748b]';
      }
    },
  },
};
</script>

<template>
  <header data-ui="navbar" class="navbar">
    <div class="nav-brand">
      <div class="logo-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
        </svg>
      </div>
      <div class="brand-text">
        <h1 class="brand-title">DB-Sync <span class="badge-tag">v{{ displayVersion }}</span></h1>
        <p class="brand-subtitle">PMA Remote &rarr; Local MySQL Port</p>
      </div>
    </div>

    <div class="nav-status">
      <!-- Remote PMA Badge -->
      <button class="status-pill" :class="pmaStatus.connected ? 'pill-success' : 'pill-muted'" type="button" :disabled="testingPma" title="Klik untuk mengetes koneksi PMA" @click="$emit('test-pma')">
        <span v-if="testingPma" class="spin-sm"></span>
        <span v-else class="dot" :class="{ pulse: pmaStatus.connected }"></span>
        <span class="label">PMA:</span>
        <span class="value">{{ pmaStatus.connected ? 'Terhubung' : 'Terputus' }}</span>
      </button>

      <!-- Local MySQL Badge -->
      <button class="status-pill" :class="localStatus.connected ? 'pill-success' : 'pill-muted'" type="button" :disabled="testingLocal" title="Klik untuk mengetes koneksi MySQL lokal" @click="$emit('test-local')">
        <span v-if="testingLocal" class="spin-sm"></span>
        <span v-else class="dot" :class="{ pulse: localStatus.connected }"></span>
        <span class="label">MySQL Lokal:</span>
        <span class="value">{{ localStatus.connected ? 'Terhubung' : 'Terputus' }}</span>
      </button>
    </div>

    <div class="nav-profile">
      <p class="profile-route">
        {{ remoteDatabase || 'Remote belum diatur' }}
        <span aria-hidden="true">→</span>
        {{ localDatabase || 'Lokal belum diatur' }}
      </p>
      <label class="sr-only" for="main-connection-select">Pilih koneksi database</label>
      <select
        id="main-connection-select"
        class="profile-select"
        :value="selectedPreset"
        @change="$emit('select-preset', $event.target.value)"
      >
        <option v-if="!selectedPreset" value="" disabled>Pilih koneksi tersimpan</option>
        <option v-for="(preset, name) in presetOptions" :key="name" :value="name">{{ name }}</option>
      </select>
    </div>

    <div class="profile-actions">
      <button class="btn btn-secondary btn-sm" type="button" @click="$emit('edit-config')">Edit Koneksi</button>
      <button class="btn btn-primary btn-sm" type="button" @click="$emit('create-profile')">Buat Profil</button>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue';
import packageJson from '../../package.json';

const props = defineProps({
  pmaStatus: {
    type: Object,
    default: () => ({ connected: false }),
  },
  localStatus: {
    type: Object,
    default: () => ({ connected: false }),
  },
  isSyncing: {
    type: Boolean,
    default: false,
  },
  appVersion: {
    type: String,
    default: '',
  },
  testingPma: { type: Boolean, default: false },
  testingLocal: { type: Boolean, default: false },
  selectedPreset: { type: String, default: '' },
  presetOptions: { type: Object, default: () => ({}) },
  remoteDatabase: { type: String, default: '' },
  localDatabase: { type: String, default: '' },
});

const displayVersion = computed(() => props.appVersion || packageJson.version);

defineEmits(['trigger-sync', 'test-pma', 'test-local', 'select-preset', 'edit-config', 'create-profile']);
</script>

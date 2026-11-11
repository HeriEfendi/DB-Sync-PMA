<template>
  <div class="tab-content">
    <div class="form-row">
      <div class="form-group flex-2">
        <label class="form-label">Host Server MySQL</label>
        <input
          v-model="config.host"
          type="text"
          class="form-input"
          placeholder="localhost / 127.0.0.1"
          @change="$emit('update:config', config)"
        />
      </div>
      <div class="form-group flex-1">
        <label class="form-label">Port TCP</label>
        <input
          v-model.number="config.port"
          type="number"
          class="form-input"
          placeholder="3306"
          @change="$emit('update:config', config)"
        />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group flex-1">
        <label class="form-label">Username DB Lokal</label>
        <input
          v-model="config.username"
          type="text"
          class="form-input"
          placeholder="root"
          @change="$emit('update:config', config)"
        />
      </div>
      <div class="form-group flex-1">
        <label class="form-label">Password DB Lokal</label>
        <input
          v-model="config.password"
          type="password"
          class="form-input"
          placeholder="Kosongkan jika tanpa password"
          @change="$emit('update:config', config)"
        />
      </div>
      <div class="form-group flex-1">
        <label class="form-label">Database Target Lokal</label>
        <input
          v-model="config.database"
          type="text"
          class="form-input"
          placeholder="my_local_db"
          @change="$emit('update:config', config)"
        />
      </div>
    </div>

    <div class="form-row docker-row">
      <div class="form-group flex-1">
        <label class="docker-toggle-label">
          <input
            v-model="config.use_docker"
            type="checkbox"
            class="docker-toggle-input"
            @change="$emit('update:config', config)"
          />
          <span class="docker-toggle-title">Gunakan Docker Container (docker exec)</span>
        </label>
        <p class="docker-help">
          Gunakan opsi ini jika MySQL berjalan di Docker dan OS host tidak memiliki client CLI 'mysql'.
        </p>
      </div>
      <div v-if="config.use_docker" class="form-group flex-1">
        <label class="form-label">Nama / ID Kontainer Docker</label>
        <input
          v-model="config.docker_container"
          type="text"
          class="form-input"
          placeholder="misal: my-mysql atau mysql-server"
          @change="$emit('update:config', config)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  config: {
    type: Object,
    required: true,
  },
});

defineEmits(['update:config']);
</script>


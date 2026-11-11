<template>
  <div class="tab-content">
    <div class="form-row">
      <div class="form-group flex-2">
        <label class="form-label">URL PhpMyAdmin Remote</label>
        <input
          v-model="config.url"
          type="url"
          class="form-input"
          placeholder="https://server.domain.com/phpmyadmin"
          @change="$emit('update:config', config)"
        />
      </div>
      <div class="form-group flex-1">
        <label class="form-label">PMA Username</label>
        <input
          v-model="config.username"
          type="text"
          class="form-input"
          placeholder="root / admin"
          @change="$emit('update:config', config)"
        />
      </div>
      <div class="form-group flex-1">
        <label class="form-label">PMA Password</label>
        <input
          v-model="config.password"
          type="password"
          class="form-input"
          placeholder="••••••••"
          @change="$emit('update:config', config)"
        />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group flex-2">
        <label class="form-label">Database Remote</label>
        <input
          v-model="config.database"
          type="text"
          class="form-input"
          placeholder="my_remote_db"
          @change="$emit('update:config', config)"
        />
      </div>
      <div class="form-group flex-1">
        <label class="form-label">Default Primary Key</label>
        <input
          v-model="config.primaryKey"
          type="text"
          class="form-input"
          placeholder="id"
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


import { ref, onUnmounted } from 'vue';

export function useToast() {
  const toasts = ref([]);
  const toastTimers = new Map();
  let nextToastId = 0;

  const dismissToast = (id) => {
    const timer = toastTimers.get(id);
    if (timer) clearTimeout(timer);
    toastTimers.delete(id);
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
  };

  const notifyToast = ({ type = 'info', title = 'Informasi', message, duration = 3600 }) => {
    const toast = { id: ++nextToastId, type, title, message };
    toasts.value.push(toast);
    if (toasts.value.length > 4) {
      dismissToast(toasts.value[0].id);
    }
    toastTimers.set(toast.id, setTimeout(() => dismissToast(toast.id), duration));
  };

  onUnmounted(() => {
    toastTimers.forEach((timer) => clearTimeout(timer));
    toastTimers.clear();
  });

  return {
    toasts,
    notifyToast,
    dismissToast,
  };
}


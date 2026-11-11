import { ref, computed, watch, onUnmounted } from 'vue';
import { formatElapsed } from '../utils/formatters.js';

export function useElapsedTimer(isSyncingRef) {
  const elapsedSeconds = ref(0);
  let timerId = null;

  const startTimer = () => {
    elapsedSeconds.value = 0;
    if (timerId) clearInterval(timerId);
    timerId = setInterval(() => {
      elapsedSeconds.value++;
    }, 1000);
  };

  const stopTimer = () => {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  };

  const resetTimer = () => {
    stopTimer();
    elapsedSeconds.value = 0;
  };

  if (isSyncingRef) {
    watch(isSyncingRef, (syncing) => {
      if (syncing) {
        startTimer();
      } else {
        stopTimer();
      }
    });
  }

  onUnmounted(() => {
    stopTimer();
  });

  const elapsedDisplay = computed(() => formatElapsed(elapsedSeconds.value));

  return {
    elapsedSeconds,
    elapsedDisplay,
    startTimer,
    stopTimer,
    resetTimer,
  };
}


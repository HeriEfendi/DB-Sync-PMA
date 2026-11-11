import { ref } from 'vue';

export function useActionDialog() {
  const actionDialog = ref({
    open: false,
    mode: 'confirm',
    title: '',
    message: '',
    confirmLabel: 'Lanjutkan',
    placeholder: '',
    value: '',
  });

  let resolveActionDialog = null;

  const openActionDialog = (options) =>
    new Promise((resolve) => {
      if (resolveActionDialog) {
        resolveActionDialog(actionDialog.value.mode === 'input' ? null : false);
      }
      resolveActionDialog = resolve;
      actionDialog.value = {
        open: true,
        mode: 'confirm',
        title: '',
        message: '',
        confirmLabel: 'Lanjutkan',
        placeholder: '',
        value: '',
        ...options,
      };
    });

  const requestConfirmation = ({ title, message, confirmLabel = 'Lanjutkan' }) =>
    openActionDialog({ mode: 'confirm', title, message, confirmLabel });

  const requestInput = ({ title, placeholder = '', confirmLabel = 'Simpan' }) =>
    openActionDialog({ mode: 'input', title, placeholder, confirmLabel });

  const finishActionDialog = (result) => {
    const resolve = resolveActionDialog;
    resolveActionDialog = null;
    actionDialog.value.open = false;
    if (resolve) resolve(result);
  };

  const cancelActionDialog = () => {
    finishActionDialog(actionDialog.value.mode === 'input' ? null : false);
  };

  return {
    actionDialog,
    openActionDialog,
    requestConfirmation,
    requestInput,
    finishActionDialog,
    cancelActionDialog,
  };
}


const listeners = new Set();

const emit = (event) => {
  listeners.forEach(listener => listener(event));
};

export const subscribeToNotifications = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const showToast = ({ type = 'info', message, duration, id } = {}) => {
  if (!message) return undefined;
  const toastId = id || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  emit({
    kind: 'toast',
    id: toastId,
    type,
    message,
    duration: duration ?? (type === 'loading' ? 0 : 4200),
  });
  return toastId;
};

export const dismissToast = (id) => emit({ kind: 'dismiss-toast', id });

export const showConfirmation = (options = {}) => new Promise(resolve => {
  emit({
    kind: 'confirmation',
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    options,
    resolve,
  });
});

export const notificationService = { showToast, dismissToast, showConfirmation };

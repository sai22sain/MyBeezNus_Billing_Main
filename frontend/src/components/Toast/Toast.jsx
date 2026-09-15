import React, { useEffect } from 'react';
import { dismissToast } from '../../services/notificationService';

const icons = {
  success: 'fa-check-circle',
  error: 'fa-circle-exclamation',
  warning: 'fa-triangle-exclamation',
  info: 'fa-circle-info',
  loading: 'fa-spinner fa-spin',
};

function Toast({ toast }) {
  useEffect(() => {
    if (!toast.duration) return undefined;
    const timer = window.setTimeout(() => dismissToast(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration]);

  return (
    <div className={`app-toast app-toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'} aria-live={toast.type === 'error' ? 'assertive' : 'polite'}>
      <i className={`fas ${icons[toast.type] || icons.info}`} aria-hidden="true"></i>
      <span className="app-toast-message">{toast.message}</span>
      {toast.type !== 'loading' && (
        <button className="app-toast-close" type="button" onClick={() => dismissToast(toast.id)} aria-label="Dismiss notification">
          <i className="fas fa-times" aria-hidden="true"></i>
        </button>
      )}
    </div>
  );
}

export default Toast;

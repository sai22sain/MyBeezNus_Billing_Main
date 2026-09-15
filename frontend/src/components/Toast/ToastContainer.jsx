import React, { useEffect, useState } from 'react';
import Toast from './Toast';
import { subscribeToNotifications } from '../../services/notificationService';
import ConfirmationDialog from '../ConfirmationDialog/ConfirmationDialog';
import './toast.css';

function ToastContainer() {
  const [toasts, setToasts] = useState([]);
  const [confirmation, setConfirmation] = useState(null);

  useEffect(() => subscribeToNotifications(event => {
    if (event.kind === 'toast') {
      setToasts(current => {
        const withoutDuplicate = current.filter(toast => toast.id !== event.id && toast.message !== event.message);
        return [...withoutDuplicate, event].slice(-4);
      });
    }
    if (event.kind === 'dismiss-toast') {
      setToasts(current => current.filter(toast => toast.id !== event.id));
    }
    if (event.kind === 'confirmation') setConfirmation(event);
  }), []);

  const resolveConfirmation = async (confirmed) => {
    if (!confirmation) return;
    if (!confirmed) {
      confirmation.resolve(false);
      setConfirmation(null);
      return;
    }
    setConfirmation(current => ({ ...current, loading: true }));
    try {
      await confirmation.options.onConfirm?.();
      confirmation.resolve(true);
      setConfirmation(null);
    } catch (error) {
      confirmation.options.onError?.(error);
      confirmation.resolve(false);
      setConfirmation(null);
    }
  };

  return (
    <>
      <div className="app-toast-container" aria-label="Notifications">
        {toasts.map(toast => <Toast key={toast.id} toast={toast} />)}
      </div>
      {confirmation && (
        <ConfirmationDialog
          {...confirmation.options}
          loading={confirmation.loading}
          onConfirm={() => resolveConfirmation(true)}
          onCancel={() => resolveConfirmation(false)}
        />
      )}
    </>
  );
}

export default ToastContainer;

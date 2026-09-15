import React, { useEffect, useRef } from 'react';

function ConfirmationDialog({
  title = 'Are you sure?',
  message = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !loading) onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [loading, onCancel]);

  return (
    <div className="confirmation-backdrop" role="presentation" onMouseDown={event => event.target === event.currentTarget && !loading && onCancel()}>
      <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-message">
        <div className={`confirmation-icon ${destructive ? 'confirmation-icon-danger' : ''}`}><i className={`fas ${destructive ? 'fa-triangle-exclamation' : 'fa-circle-question'}`} aria-hidden="true"></i></div>
        <h2 id="confirmation-title">{title}</h2>
        <p id="confirmation-message">{message}</p>
        <div className="confirmation-actions">
          <button ref={cancelRef} className="btn btn-ghost" type="button" onClick={onCancel} disabled={loading}>{cancelText}</button>
          <button className={`btn ${destructive ? 'btn-danger' : 'btn-primary'}`} type="button" onClick={onConfirm} disabled={loading}>
            {loading && <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>}
            {loading ? 'Working...' : confirmText}
          </button>
        </div>
      </section>
    </div>
  );
}

export default ConfirmationDialog;

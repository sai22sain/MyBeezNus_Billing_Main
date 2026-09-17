import React, { useEffect, useRef } from 'react';

function ResponsiveFormModal({
  title,
  children,
  onClose,
  primaryAction,
  secondaryAction,
  footer,
  labelledBy,
  maxWidth,
}) {
  const dialogRef = useRef(null);
  const previouslyFocused = useRef(null);
  const onCloseRef = useRef(onClose);
  const previousOverflow = useRef('');
  onCloseRef.current = onClose;

  useEffect(() => {
    previouslyFocused.current = document.activeElement;
    previousOverflow.current = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = dialogRef.current?.querySelector('input, select, textarea, button:not([disabled])');
    focusable?.focus();
    const onKeyDown = event => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus?.();
      document.body.style.overflow = previousOverflow.current;
    };
  }, []);

  return (
    <div className="responsive-modal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section
        ref={dialogRef}
        className="responsive-form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        style={maxWidth ? { '--responsive-modal-max-width': `${maxWidth}px` } : undefined}
      >
        <header className="responsive-form-modal-header">
          <h2 id={labelledBy}>{title}</h2>
          <button type="button" className="close-btn" aria-label={`Close ${title}`} onClick={onClose}>×</button>
        </header>
        <div className="responsive-form-modal-body">{children}</div>
        {footer && <footer className="responsive-form-modal-footer">{footer}</footer>}
        {(primaryAction || secondaryAction) && (
          <footer className="responsive-form-modal-footer">
            {secondaryAction && <button type="button" className="btn btn-ghost" onClick={secondaryAction.onClick} disabled={secondaryAction.disabled}>{secondaryAction.label}</button>}
            {primaryAction && <button type="button" className="btn btn-primary" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>{primaryAction.loading ? 'Saving...' : primaryAction.label}</button>}
          </footer>
        )}
      </section>
    </div>
  );
}

export default ResponsiveFormModal;

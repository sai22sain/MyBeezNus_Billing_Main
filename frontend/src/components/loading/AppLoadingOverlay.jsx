import React from 'react';
import './AppLoadingOverlay.css';

const AppLoadingOverlay = ({ visible }) => {
  if (!visible) return null;

  return (
    <div
      className="app-loading-overlay"
      role="status"
      aria-live="polite"
      aria-label="Loading, please wait."
      aria-busy="true"
    >
      <span aria-hidden="true">
        Loading<span className="app-loading-overlay__dots"></span> Please wait.
      </span>
    </div>
  );
};

export default AppLoadingOverlay;
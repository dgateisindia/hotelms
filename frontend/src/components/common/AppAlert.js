import React, { useEffect } from "react";

function AppAlert({
  type = "error",
  message,
  onClose,
  autoClose = false,
  duration = 4000,
}) {
  useEffect(() => {
    if (!message || !autoClose || !onClose) return;

    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [message, autoClose, duration, onClose]);

  if (!message) return null;

  return (
    <div
      className={`alert alert-${type} app-alert`}
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
    >
      <span className="app-alert__message">{message}</span>

      {onClose && (
        <button
          type="button"
          className="app-alert__close"
          onClick={onClose}
          aria-label="Dismiss message"
        >
          ×
        </button>
      )}
    </div>
  );
}

export default AppAlert;
import React, { useState } from 'react';

export interface ErrorBannerProps {
  readonly message: string;
  /** If provided, a "Retry" button is rendered. */
  readonly onRetry?: () => void;
  /** Called when the X dismiss button is clicked. */
  readonly onDismiss?: () => void;
}

export default function ErrorBanner({
  message,
  onRetry,
  onDismiss,
}: ErrorBannerProps): React.ReactElement | null {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      role="alert"
      data-testid="error-banner"
      style={{
        width: '100%',
        padding: '12px 20px',
        backgroundColor: '#c0392b',
        color: '#ffffff',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxSizing: 'border-box',
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            background: '#ffffff',
            color: '#c0392b',
            border: 'none',
            borderRadius: 4,
            padding: '6px 14px',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss error"
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          color: '#ffffff',
          border: 'none',
          fontSize: 20,
          lineHeight: 1,
          cursor: 'pointer',
          padding: '0 4px',
          fontWeight: 700,
        }}
      >
        ×
      </button>
    </div>
  );
}

import React, { useEffect, useState } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastProps {
  readonly message: string;
  readonly variant: ToastVariant;
  /** Auto-dismiss duration in ms. Defaults to 3000. */
  readonly duration?: number;
  /** Called when the toast dismisses (timeout or manual). */
  readonly onDismiss?: () => void;
}

const VARIANT_COLORS: Record<ToastVariant, string> = {
  success: '#1b7a3d',
  error: '#c0392b',
  info: '#2563eb',
};

export default function Toast({
  message,
  variant,
  duration = 3000,
  onDismiss,
}: ToastProps): React.ReactElement | null {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid={`toast-${variant}`}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        padding: '12px 20px',
        borderRadius: 6,
        backgroundColor: VARIANT_COLORS[variant],
        color: '#ffffff',
        fontSize: 14,
        fontFamily: 'system-ui, sans-serif',
        fontWeight: 500,
        zIndex: 10000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        minWidth: 200,
        maxWidth: 400,
      }}
    >
      {message}
    </div>
  );
}

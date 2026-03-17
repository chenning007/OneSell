import React, { useEffect, useRef, useCallback } from 'react';

export interface ConfirmDialogProps {
  readonly heading: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export default function ConfirmDialog({
  heading,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.ReactElement {
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingId = 'confirm-dialog-heading';

  // Focus the dialog container on mount
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Escape key closes
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
        return;
      }
      // Focus trapping: Tab cycles within the dialog
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [onCancel],
  );

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      data-testid="confirm-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 10001,
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 8,
          padding: 32,
          maxWidth: 420,
          width: '90%',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h2
          id={headingId}
          style={{ margin: '0 0 12px', fontSize: 18, color: '#1a1a1a' }}
        >
          {heading}
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#333333', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '8px 18px',
              borderRadius: 4,
              border: '1px solid #cccccc',
              background: '#ffffff',
              color: '#333333',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '8px 18px',
              borderRadius: 4,
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

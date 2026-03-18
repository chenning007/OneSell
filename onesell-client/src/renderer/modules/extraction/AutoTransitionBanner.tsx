/**
 * AutoTransitionBanner — Countdown banner for auto-navigating to analysis (R-11, #263).
 *
 * PRD §7.2, ADR-005 D2:
 * - When extractionStore.allDone becomes true, show countdown: "All data collected! Starting analysis in 3... 2... 1..."
 * - After 3 seconds, navigate to step 3 (Agent Analysis)
 * - "Analyze Now" click in ExtractionDashboard skips countdown (via onSkip prop)
 *
 * Closes #263
 */

import React, { useState, useEffect, useRef } from 'react';
import { useWizardStore } from '../../store/wizardStore.js';

export interface AutoTransitionBannerProps {
  onSkip: () => void;
}

export default function AutoTransitionBanner({ onSkip }: AutoTransitionBannerProps): React.ReactElement {
  const [countdown, setCountdown] = useState(3);
  const setStep = useWizardStore((s) => s.setStep);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navigated = useRef(false);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (!navigated.current) {
            navigated.current = true;
            setStep(3);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [setStep]);

  function handleSkip(): void {
    if (timerRef.current) clearInterval(timerRef.current);
    navigated.current = true;
    onSkip();
  }

  return (
    <div
      data-testid="auto-transition-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        borderRadius: '8px',
        background: '#eafaf1',
        border: '1px solid #27ae60',
        marginBottom: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '20px' }}>✅</span>
        <span
          data-testid="countdown-text"
          style={{ fontSize: '15px', fontWeight: 600, color: '#27ae60' }}
        >
          All data collected! Starting analysis in {countdown}...
        </span>
      </div>
      <button
        data-testid="skip-countdown-button"
        onClick={handleSkip}
        style={{
          padding: '6px 14px',
          border: 'none',
          borderRadius: '6px',
          background: '#27ae60',
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Analyze Now
      </button>
    </div>
  );
}

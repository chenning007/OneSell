import React from 'react';
import { useTranslation } from 'react-i18next';
import { useExtractionStore } from '../../store/extractionStore.js';
import { useWizardStore } from '../../store/wizardStore.js';
import { useExtractionRunner } from './useExtractionRunner.js';
import type { PlatformStatus } from '../../store/extractionStore.js';

const spinnerKeyframes = `
@keyframes onesell-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes onesell-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
`;

function StatusIndicator({ status, productCount, errorMessage }: {
  status: PlatformStatus;
  productCount: number;
  errorMessage?: string;
}): React.ReactElement {
  const { t } = useTranslation();

  if (status === 'waiting') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 10, height: 10, borderRadius: '50%',
          backgroundColor: '#aaa', display: 'inline-block',
        }} />
        <span style={{ color: '#888', fontSize: 13 }}>{t('progress.waiting')}</span>
      </span>
    );
  }

  if (status === 'extracting') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 14, height: 14, borderRadius: '50%',
          border: '2px solid #ddd', borderTopColor: '#4a90e2',
          display: 'inline-block',
          animation: 'onesell-spin 0.8s linear infinite',
        }} />
        <span style={{ color: '#4a90e2', fontSize: 13 }}>{t('progress.extracting')}</span>
      </span>
    );
  }

  if (status === 'done') {
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: '#27ae60', fontSize: 16, fontWeight: 'bold' }}>✓</span>
        <span style={{ color: '#27ae60', fontSize: 13 }}>
          {t('progress.productsFound', { count: productCount })}
        </span>
      </span>
    );
  }

  // error
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: '#e74c3c', fontSize: 16, fontWeight: 'bold' }}>✗</span>
      <span style={{ color: '#e74c3c', fontSize: 13 }}>{errorMessage ?? t('progress.error')}</span>
    </span>
  );
}

export default function ProgressScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { platforms, cancelled, allDone, cancel } = useExtractionStore();
  const { selectedPlatforms, setStep } = useWizardStore();

  // Start the extraction runner
  useExtractionRunner(selectedPlatforms);

  // BUG-B fix: require at least one successful platform for Analyze Now
  const hasAnySuccess = platforms.some((p) => p.status === 'done');
  const allErrored = allDone && !hasAnySuccess && platforms.length > 0;
  const analyzeEnabled = allDone && !cancelled && hasAnySuccess;

  function handleCancel(): void {
    cancel();
  }

  function handleAnalyzeNow(): void {
    setStep(9);
  }

  function handleBack(): void {
    setStep(7);
  }

  return (
    <>
      <style>{spinnerKeyframes}</style>
      <div
        style={{
          fontFamily: 'system-ui, sans-serif',
          maxWidth: 600,
          margin: '0 auto',
          padding: '40px 24px',
        }}
        aria-label={t('progress.ariaLabel')}
      >
        <h2 style={{ marginBottom: 8, fontSize: 22, fontWeight: 600 }}>
          {t('progress.heading')}
        </h2>

        {/* BUG-A fix: security indicator */}
        <div style={{ color: '#888', fontSize: 12, marginBottom: 32, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden="true">🛡️</span>
          <span>{t('progress.secureConnection')}</span>
        </div>

        {/* BUG-E fix: aria-live region wraps status section */}
        <div aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
          {platforms.map((p) => (
            <div key={p.platformId} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: 8,
              backgroundColor: '#f9f9f9',
              border: '1px solid #eee',
            }}>
              <span style={{ fontWeight: 500, fontSize: 14 }}>
                {t(`platforms.${p.platformId}`, { defaultValue: p.platformId })}
              </span>
              <StatusIndicator
                status={p.status}
                productCount={p.productCount}
                errorMessage={p.errorMessage}
              />
            </div>
          ))}

          {/* BUG-C fix: summary error when all platforms fail */}
          {allErrored && (
            <div style={{ color: '#e74c3c', fontSize: 14, padding: '12px 16px', textAlign: 'center' }}>
              {t('progress.allFailed')}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {!allDone && !cancelled && (
            <button
              onClick={handleCancel}
              style={{
                padding: '10px 24px',
                borderRadius: 6,
                border: '1px solid #ccc',
                backgroundColor: '#fff',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              {t('progress.cancel')}
            </button>
          )}
          <button
            onClick={handleAnalyzeNow}
            disabled={!analyzeEnabled}
            style={{
              padding: '10px 24px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: analyzeEnabled ? '#4a90e2' : '#ccc',
              color: '#fff',
              cursor: analyzeEnabled ? 'pointer' : 'not-allowed',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {t('progress.analyzeNow')}
          </button>

          {/* BUG-D fix: Back link when all platforms fail */}
          {allErrored && (
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); handleBack(); }}
              style={{
                color: '#4a90e2',
                fontSize: 14,
                textDecoration: 'none',
                marginLeft: 8,
              }}
            >
              {t('progress.backToDataSources')}
            </a>
          )}
        </div>
      </div>
    </>
  );
}

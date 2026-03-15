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

  function handleCancel(): void {
    cancel();
  }

  function handleAnalyzeNow(): void {
    setStep(9);
  }

  return (
    <>
      <style>{spinnerKeyframes}</style>
      <div style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: 600,
        margin: '0 auto',
        padding: '40px 24px',
      }}>
        <h2 style={{ marginBottom: 32, fontSize: 22, fontWeight: 600 }}>
          {t('progress.heading')}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 40 }}>
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
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
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
            disabled={!allDone || cancelled}
            style={{
              padding: '10px 24px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: allDone && !cancelled ? '#4a90e2' : '#ccc',
              color: '#fff',
              cursor: allDone && !cancelled ? 'pointer' : 'not-allowed',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {t('progress.analyzeNow')}
          </button>
        </div>
      </div>
    </>
  );
}

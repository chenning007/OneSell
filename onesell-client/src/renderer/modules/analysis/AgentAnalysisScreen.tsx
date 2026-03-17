import React, { useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnalysisStore } from '../../store/analysisStore.js';
import { useWizardStore } from '../../store/wizardStore.js';
import type { AnalysisStatus } from '../../store/analysisStore.js';

const POLL_INTERVAL = 2000;

const STAGES: { key: AnalysisStatus; labelKey: string }[] = [
  { key: 'planning', labelKey: 'analysis.stagePlanning' },
  { key: 'executing', labelKey: 'analysis.stageExecuting' },
  { key: 'synthesizing', labelKey: 'analysis.stageSynthesizing' },
  { key: 'complete', labelKey: 'analysis.stageComplete' },
];

function stageIndex(status: AnalysisStatus): number {
  const idx = STAGES.findIndex((s) => s.key === status);
  return idx === -1 ? -1 : idx;
}

const spinnerKeyframes = `
@keyframes analysis-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

function StageIcon({ stage, currentStatus }: { stage: AnalysisStatus; currentStatus: AnalysisStatus }): React.ReactElement {
  const current = stageIndex(currentStatus);
  const target = stageIndex(stage);

  if (currentStatus === 'error') {
    return <span style={{ color: '#e74c3c', fontSize: 18, fontWeight: 'bold' }}>✗</span>;
  }
  if (current > target) {
    return <span style={{ color: '#27ae60', fontSize: 18, fontWeight: 'bold' }}>✓</span>;
  }
  if (current === target) {
    return (
      <span style={{
        display: 'inline-block', width: 16, height: 16, borderRadius: '50%',
        border: '2px solid #ddd', borderTopColor: '#4a90e2',
        animation: 'analysis-spin 0.8s linear infinite',
      }} />
    );
  }
  return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ccc' }} />;
}

export default function AgentAnalysisScreen(): React.ReactElement {
  const { t } = useTranslation();
  const { analysisId, status, error, setStatus, setError } = useAnalysisStore();
  const { setStep } = useWizardStore();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async () => {
    if (!analysisId) return;
    try {
      const res = await window.electronAPI.analysis.getStatus(analysisId);
      const mapped = mapBackendStatus(res.status);
      setStatus(mapped);
      if (mapped === 'complete') {
        stopPolling();
        setStep(10);
      } else if (mapped === 'error') {
        setError(res.message ?? t('analysis.unknownError'));
        stopPolling();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('analysis.unknownError'));
      setStatus('error');
      stopPolling();
    }
  }, [analysisId, setStatus, setError, setStep, stopPolling, t]);

  useEffect(() => {
    if (!analysisId || status === 'complete' || status === 'error') return;
    timerRef.current = setInterval(() => { void pollStatus(); }, POLL_INTERVAL);
    return () => { stopPolling(); };
  }, [analysisId, status, pollStatus, stopPolling]);

  function handleRetry(): void {
    setError(null);
    setStatus('planning');
    // Polling will resume on next effect cycle
  }

  return (
    <>
      <style>{spinnerKeyframes}</style>
      <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 520, margin: '40px auto', padding: '0 20px' }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>{t('analysis.heading')}</h1>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 24 }}>{t('analysis.explainer')}</p>

        <div role="list" aria-label={t('analysis.ariaStages')}>
          {STAGES.map((stage) => (
            <div
              key={stage.key}
              role="listitem"
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0', borderBottom: '1px solid #f0f0f0',
              }}
            >
              <StageIcon stage={stage.key} currentStatus={status} />
              <span style={{ fontSize: 15, color: stageIndex(status) >= stageIndex(stage.key) ? '#222' : '#999' }}>
                {t(stage.labelKey)}
              </span>
            </div>
          ))}
        </div>

        {status === 'error' && (
          <div style={{ marginTop: 20 }}>
            <p style={{ color: '#e74c3c', fontSize: 14, marginBottom: 12 }} role="alert">
              {error ?? t('analysis.unknownError')}
            </p>
            <button
              aria-label={t('analysis.retry')}
              onClick={handleRetry}
              style={{
                padding: '8px 20px', border: 'none', borderRadius: 6,
                backgroundColor: '#4a90e2', color: '#fff', fontSize: 14,
                cursor: 'pointer',
              }}
            >
              {t('analysis.retry')}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function mapBackendStatus(raw: string): AnalysisStatus {
  switch (raw) {
    case 'planning': return 'planning';
    case 'executing': return 'executing';
    case 'synthesizing': return 'synthesizing';
    case 'complete': return 'complete';
    case 'error': return 'error';
    default: return 'planning';
  }
}

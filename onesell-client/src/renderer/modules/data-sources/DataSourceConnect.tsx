import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { useWizardStore } from '../../store/wizardStore.js';
import { useExtractionStore } from '../../store/extractionStore.js';

type ConnectionStatus = 'idle' | 'connected' | 'extracting';

interface PlatformState {
  status: ConnectionStatus;
}

const POLL_INTERVAL_MS = 2000;

/**
 * DataSourceConnect — lists platforms for the selected market and lets the user
 * open/close isolated BrowserView sessions per platform (P1: cookies stay in client).
 * Connection state is ephemeral UI — not persisted in the global wizard store.
 */
export default function DataSourceConnect(): React.ReactElement {
  const { t } = useTranslation();
  const market = useWizardStore((s) => s.market);
  const setStep = useWizardStore((s) => s.setStep);
  const platforms: readonly string[] = market?.platforms ?? [];
  const keywords = useExtractionStore((s) => (s as Record<string, unknown>).keywords as string | undefined) ?? '';
  const setKeywords = useExtractionStore((s) => (s as Record<string, unknown>).setKeywords as ((v: string) => void) | undefined);

  const [platformStates, setPlatformStates] = useState<Record<string, PlatformState>>(() =>
    Object.fromEntries(platforms.map((id) => [id, { status: 'idle' as ConnectionStatus }])),
  );

  // Track active poll timers
  const pollTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const setStatus = useCallback((platformId: string, status: ConnectionStatus) => {
    setPlatformStates((prev) => ({
      ...prev,
      [platformId]: { status },
    }));
  }, []);

  const startPolling = useCallback(
    (platformId: string) => {
      if (pollTimers.current[platformId]) return;
      pollTimers.current[platformId] = setInterval(async () => {
        try {
          const url = await window.electronAPI.extraction.getCurrentUrl(platformId);
          if (url && url !== '' && url !== 'about:blank') {
            setStatus(platformId, 'connected');
          }
        } catch {
          // view may not be ready yet — ignore
        }
      }, POLL_INTERVAL_MS);
    },
    [setStatus],
  );

  const stopPolling = useCallback((platformId: string) => {
    if (pollTimers.current[platformId]) {
      clearInterval(pollTimers.current[platformId]);
      delete pollTimers.current[platformId];
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    const timers = pollTimers.current;
    return () => {
      Object.keys(timers).forEach((id) => clearInterval(timers[id]));
    };
  }, []);

  const handleConnect = useCallback(
    async (platformId: string) => {
      console.log('[DataSourceConnect] Connect clicked for:', platformId);
      try {
        console.log('[DataSourceConnect] Calling electronAPI.extraction.openView...');
        await window.electronAPI.extraction.openView(platformId);
        console.log('[DataSourceConnect] openView resolved OK for:', platformId);
        setStatus(platformId, 'connected');
        startPolling(platformId);
      } catch (err) {
        console.error('[DataSourceConnect] openView FAILED for', platformId, err);
      }
    },
    [setStatus, startPolling],
  );

  const handleClose = useCallback(
    async (platformId: string) => {
      stopPolling(platformId);
      try {
        await window.electronAPI.extraction.closeView(platformId);
      } catch (err) {
        console.error('Failed to close view for', platformId, err);
      }
      setStatus(platformId, 'idle');
    },
    [setStatus, stopPolling],
  );

  const handleBack = useCallback(async () => {
    // Close all open platform views before navigating back
    const openPlatforms = Object.entries(platformStates)
      .filter(([, s]) => s.status !== 'idle')
      .map(([id]) => id);
    for (const id of openPlatforms) {
      stopPolling(id);
      try {
        await window.electronAPI.extraction.closeView(id);
      } catch { /* best-effort */ }
    }
    setStep(6);
  }, [platformStates, stopPolling, setStep]);

  const connectedCount = Object.values(platformStates).filter((s) => s.status === 'connected').length;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '24px' }}>
      {/* BUG-C fix: Back to Wizard button */}
      <button
        onClick={() => void handleBack()}
        aria-label="Back to wizard"
        style={{
          marginBottom: '16px',
          padding: '6px 16px',
          borderRadius: '4px',
          border: '1px solid #6c757d',
          background: '#fff',
          color: '#6c757d',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        ← {t('dataSources.backToWizard', { defaultValue: 'Back to Wizard' })}
      </button>

      <h2>{t('dataSources.title')}</h2>
      {/* BUG-A fix: Lock icon before privacy text */}
      <p style={{ color: '#666' }}>
        <span aria-label="lock" role="img">🔒</span>{' '}
        {t('dataSources.description')}
      </p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {platforms.map((platformId) => {
          const state = platformStates[platformId] ?? { status: 'idle' };
          return (
            <li
              key={platformId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 0',
                borderBottom: '1px solid #eee',
              }}
            >
              <span style={{ flex: 1, fontWeight: 500 }}>
                {t(`platforms.${platformId}`, { defaultValue: platformId })}
              </span>

              {state.status !== 'idle' && (
                <span
                  style={{
                    fontSize: '12px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: state.status === 'connected' ? '#d4edda' : '#fff3cd',
                    color: state.status === 'connected' ? '#155724' : '#856404',
                  }}
                >
                  {t(`dataSources.status.${state.status}`)}
                </span>
              )}

              {state.status === 'idle' ? (
                <button
                  onClick={() => void handleConnect(platformId)}
                  aria-label={`Connect to ${t(`platforms.${platformId}`, { defaultValue: platformId })}`}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '4px',
                    border: '1px solid #0d6efd',
                    background: '#0d6efd',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  {t('dataSources.connect')}
                </button>
              ) : (
                <button
                  onClick={() => void handleClose(platformId)}
                  aria-label={`Disconnect ${t(`platforms.${platformId}`, { defaultValue: platformId })}`}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '4px',
                    border: '1px solid #dc3545',
                    background: '#fff',
                    color: '#dc3545',
                    cursor: 'pointer',
                  }}
                >
                  {t('dataSources.close')}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {/* BUG-B fix: Keyword input for extraction runner */}
      <div style={{ marginTop: '24px' }}>
        <label
          htmlFor="keyword-input"
          style={{ display: 'block', marginBottom: '4px', fontSize: '14px', color: '#555' }}
        >
          {t('dataSources.keywordsLabel', { defaultValue: 'Search keywords (optional)' })}
        </label>
        <input
          id="keyword-input"
          type="text"
          value={keywords}
          onChange={(e) => setKeywords?.(e.target.value)}
          aria-label="Search keywords"
          placeholder={t('dataSources.keywordsPlaceholder', { defaultValue: 'e.g. wireless earbuds' })}
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            fontSize: '14px',
          }}
        />
      </div>

      {/* Start Extraction button — enabled once at least one platform is connected */}
      <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={() => { setStep(8); }}
          disabled={connectedCount === 0}
          aria-label="Start extraction"
          style={{
            padding: '12px 32px',
            borderRadius: '8px',
            border: 'none',
            background: connectedCount > 0 ? '#0066cc' : '#ccc',
            color: '#fff',
            fontSize: '16px',
            fontWeight: 600,
            cursor: connectedCount > 0 ? 'pointer' : 'not-allowed',
          }}
        >
          {t('dataSources.startExtraction', { defaultValue: 'Start Extraction' })}
        </button>
      </div>
    </div>
  );
}

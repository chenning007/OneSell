import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../../i18n/index.js';
import { useWizardStore } from '../../store/wizardStore.js';

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
  const platforms: readonly string[] = market?.platforms ?? [];

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
      try {
        await window.electronAPI.extraction.openView(platformId);
        setStatus(platformId, 'connected');
        startPolling(platformId);
      } catch (err) {
        console.error('Failed to open view for', platformId, err);
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

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '24px' }}>
      <h2>{t('dataSources.title')}</h2>
      <p style={{ color: '#666' }}>{t('dataSources.description')}</p>
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
    </div>
  );
}

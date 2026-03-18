/**
 * QuickStartScreen — Returning-user 1-click re-launch (W-11, #265).
 *
 * PRD §3.1, §4.2, ADR-005 D1:
 * - Displayed at wizard step 0 when wizardStore.hasProfile is true
 * - Shows saved profile: market name + flag, last analysis date
 * - "Go" button → step 2 (ExtractionDashboard) using saved market
 * - "Change Market" link → step 1 (MarketSelection)
 * - "Clear Profile" link → clears profile via IPC, sets hasProfile false, nav to step 1
 *
 * Closes #265
 */

import React, { useEffect, useState } from 'react';
import { useWizardStore } from '../../store/wizardStore.js';
import { MARKET_CONFIGS } from '../../config/markets.js';
import type { SavedProfile } from '../../../main/store/LocalStore.js';

export default function QuickStartScreen(): React.ReactElement {
  const market = useWizardStore((s) => s.market);
  const setStep = useWizardStore((s) => s.setStep);
  const setMarket = useWizardStore((s) => s.setMarket);
  const setHasProfile = useWizardStore((s) => s.setHasProfile);

  const [profile, setProfile] = useState<SavedProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const saved = await window.electronAPI.store.getProfile();
        setProfile(saved);
        if (saved) {
          const config = MARKET_CONFIGS[saved.marketId];
          if (config) {
            setMarket({
              marketId: config.marketId,
              language: config.language,
              currency: config.currency,
            });
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [setMarket]);

  function handleGo(): void {
    setStep(2);
  }

  function handleChangeMarket(): void {
    setStep(1);
  }

  async function handleClearProfile(): Promise<void> {
    await window.electronAPI.store.clearProfile();
    setHasProfile(false);
  }

  if (loading) {
    return (
      <div data-testid="quick-start-loading" style={{ textAlign: 'center', paddingTop: '20vh', fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ color: '#7f8c8d' }}>Loading profile…</p>
      </div>
    );
  }

  const marketId = profile?.marketId ?? market?.marketId;
  const config = marketId ? MARKET_CONFIGS[marketId] : undefined;
  const flag = config?.flag ?? '🌍';
  const marketName = config ? marketId!.toUpperCase() : 'Unknown';
  const platformList = config?.platforms.join(', ') ?? '';
  const lastSession = profile?.lastSessionAt
    ? new Date(profile.lastSessionAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div
      data-testid="quick-start-screen"
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: '560px',
        margin: '0 auto',
        paddingTop: '12vh',
        textAlign: 'center',
      }}
    >
      <h2 style={{ fontSize: '24px', color: '#2c3e50', marginBottom: '24px' }}>
        Welcome back!
      </h2>

      {/* ── Saved profile card ──────────────────────────────────── */}
      <div
        data-testid="profile-card"
        style={{
          background: '#f8f9fa',
          border: '1px solid #ecf0f1',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '32px',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
          <span style={{ fontSize: '32px' }}>{flag}</span>
          <div>
            <div data-testid="market-name" style={{ fontSize: '18px', fontWeight: 700, color: '#2c3e50' }}>
              {marketName} Market
            </div>
            <div style={{ fontSize: '13px', color: '#7f8c8d', marginTop: '2px' }}>
              Will scan: {platformList}
            </div>
          </div>
        </div>
        {lastSession && (
          <div data-testid="last-session" style={{ fontSize: '13px', color: '#95a5a6' }}>
            Last session: {lastSession}
          </div>
        )}
      </div>

      {/* ── Actions ─────────────────────────────────────────────── */}
      <button
        data-testid="go-button"
        onClick={handleGo}
        style={{
          display: 'block',
          width: '100%',
          padding: '14px 24px',
          border: 'none',
          borderRadius: '10px',
          background: '#3498db',
          color: '#fff',
          fontSize: '16px',
          fontWeight: 700,
          cursor: 'pointer',
          marginBottom: '16px',
        }}
      >
        🚀 Go — Start Scanning
      </button>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '24px' }}>
        <button
          data-testid="change-market-link"
          onClick={handleChangeMarket}
          style={{
            background: 'none',
            border: 'none',
            color: '#3498db',
            fontSize: '14px',
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          Change Market
        </button>
        <button
          data-testid="clear-profile-link"
          onClick={() => void handleClearProfile()}
          style={{
            background: 'none',
            border: 'none',
            color: '#e74c3c',
            fontSize: '14px',
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          🗑️ Clear profile &amp; start fresh
        </button>
      </div>
    </div>
  );
}

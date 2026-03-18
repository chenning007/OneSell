/**
 * ExtractionDashboard — Container for extraction step 2 (E-03, #239).
 *
 * PRD §5.3, ADR-005 D2:
 * - Header: market badge (flag + name from wizardStore)
 * - Body top: TaskPipeline component
 * - Body bottom: PlatformTabPanel component
 * - Footer: "Cancel" button (goes back to step 1) + "Analyze Now" button (goes to step 3)
 * - "Analyze Now" disabled until extractionStore.canAnalyze is true
 * - Gear icon (⚙) button in header (placeholder)
 * - AutoTransitionBanner shown when allDone
 *
 * Closes #239
 */

import React, { useState } from 'react';
import { useWizardStore } from '../../store/wizardStore.js';
import { useExtractionStore } from '../../store/extractionStore.js';
import { MARKET_CONFIGS } from '../../config/markets.js';
import TaskPipeline from './TaskPipeline.js';
import PlatformTabPanel from './PlatformTabPanel.js';
import AutoTransitionBanner from './AutoTransitionBanner.js';
import AdvancedPreferencesDrawer from '../wizard/AdvancedPreferencesDrawer.js';
import { useAutonomousExtraction } from './useAutonomousExtraction.js';

export default function ExtractionDashboard(): React.ReactElement {
  const market = useWizardStore((s) => s.market);
  const setStep = useWizardStore((s) => s.setStep);
  const canAnalyze = useExtractionStore((s) => s.canAnalyze);
  const allDone = useExtractionStore((s) => s.allDone);
  const cancel = useExtractionStore((s) => s.cancel);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useAutonomousExtraction();

  function handleCancel(): void {
    cancel();
    setStep(1);
  }

  function handleAnalyzeNow(): void {
    setStep(3);
  }

  return (
    <div
      data-testid="extraction-dashboard"
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: '960px',
        margin: '0 auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderBottom: '1px solid #ecf0f1',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {market && (
            <span
              data-testid="market-badge"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                background: '#ebf5fb',
                borderRadius: '20px',
                fontSize: '15px',
                fontWeight: 600,
                color: '#2c3e50',
              }}
            >
              <span style={{ fontSize: '20px' }}>
                {MARKET_CONFIGS[market.marketId as keyof typeof MARKET_CONFIGS]?.flag ?? '🌍'}
              </span>
            </span>
          )}
          <h2 style={{ margin: 0, fontSize: '20px', color: '#2c3e50' }}>
            Extraction Dashboard
          </h2>
        </div>
        <button
          data-testid="gear-icon"
          aria-label="Settings"
          onClick={() => setDrawerOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '22px',
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: '6px',
            color: '#7f8c8d',
          }}
        >
          ⚙
        </button>
      </div>

      {/* ── Auto-transition banner ──────────────────────────────── */}
      {allDone && <AutoTransitionBanner onSkip={handleAnalyzeNow} />}

      {/* ── Task Pipeline ───────────────────────────────────────── */}
      <TaskPipeline />

      {/* ── Platform Tab Panel ──────────────────────────────────── */}
      <PlatformTabPanel />

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 0',
        borderTop: '1px solid #ecf0f1',
      }}>
        <button
          data-testid="cancel-button"
          onClick={handleCancel}
          style={{
            padding: '10px 24px',
            border: '1px solid #bdc3c7',
            borderRadius: '8px',
            background: '#fff',
            color: '#7f8c8d',
            fontSize: '14px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          data-testid="analyze-now-button"
          onClick={handleAnalyzeNow}
          disabled={!canAnalyze}
          style={{
            padding: '10px 24px',
            border: 'none',
            borderRadius: '8px',
            background: canAnalyze ? '#3498db' : '#bdc3c7',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: canAnalyze ? 'pointer' : 'not-allowed',
            opacity: canAnalyze ? 1 : 0.6,
          }}
        >
          Analyze Now
        </button>
      </div>

      {/* ── Advanced Preferences Drawer (W-15, #269) ─────────── */}
      <AdvancedPreferencesDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

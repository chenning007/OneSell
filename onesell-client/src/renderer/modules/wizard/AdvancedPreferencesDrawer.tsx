/**
 * AdvancedPreferencesDrawer — Slide-out drawer for optional preferences (W-15, #269).
 *
 * PRD §4.1, ADR-005 D1:
 * - Slide-out drawer from right, triggered by gear icon ⚙ in ExtractionDashboard
 * - Budget slider: $0–$10,000, default $500, step $100
 * - Product type toggle: Physical | Digital (default: Physical)
 * - Fulfillment time radio: Fast (<7d) | Medium (7-30d) | Slow (>30d) (default: Medium)
 * - "Apply" saves to wizardStore.preferences + IPC store:set-preferences
 * - "Reset" restores defaults
 * - Close button / click-outside closes drawer
 *
 * Closes #269
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useWizardStore } from '../../store/wizardStore.js';

// ── Defaults ────────────────────────────────────────────────────────

const DEFAULT_BUDGET = 500;
const BUDGET_MIN = 0;
const BUDGET_MAX = 10_000;
const BUDGET_STEP = 100;
const DEFAULT_PRODUCT_TYPE: 'physical' | 'digital' = 'physical';
const DEFAULT_FULFILLMENT: 'low' | 'medium' | 'high' = 'medium';

const FULFILLMENT_OPTIONS = [
  { value: 'low' as const, label: 'Fast (< 7 days)' },
  { value: 'medium' as const, label: 'Medium (7–30 days)' },
  { value: 'high' as const, label: 'Slow (> 30 days)' },
];

// ── Props ───────────────────────────────────────────────────────────

export interface AdvancedPreferencesDrawerProps {
  open: boolean;
  onClose: () => void;
}

// ── Component ───────────────────────────────────────────────────────

export default function AdvancedPreferencesDrawer({
  open,
  onClose,
}: AdvancedPreferencesDrawerProps): React.ReactElement | null {
  const preferences = useWizardStore((s) => s.preferences);
  const updatePreferences = useWizardStore((s) => s.updatePreferences);

  // Local state for in-progress edits
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [productType, setProductType] = useState<'physical' | 'digital'>(DEFAULT_PRODUCT_TYPE);
  const [fulfillment, setFulfillment] = useState<'low' | 'medium' | 'high'>(DEFAULT_FULFILLMENT);

  const drawerRef = useRef<HTMLDivElement>(null);

  // Sync local state from store on open
  useEffect(() => {
    if (open) {
      setBudget(preferences.budget ?? DEFAULT_BUDGET);
      setProductType((preferences.productType as 'physical' | 'digital') ?? DEFAULT_PRODUCT_TYPE);
      setFulfillment((preferences.fulfillmentTime as 'low' | 'medium' | 'high') ?? DEFAULT_FULFILLMENT);
    }
  }, [open, preferences]);

  // Click outside to close
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  function handleApply(): void {
    const prefs = {
      budget,
      productType,
      fulfillmentTime: fulfillment,
    };
    updatePreferences(prefs);
    void window.electronAPI.store.setPreferences({
      budget: { min: 0, max: budget, currency: 'USD' },
      productType,
      fulfillmentTime: fulfillment,
    });
    onClose();
  }

  function handleReset(): void {
    setBudget(DEFAULT_BUDGET);
    setProductType(DEFAULT_PRODUCT_TYPE);
    setFulfillment(DEFAULT_FULFILLMENT);
  }

  if (!open) return null;

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      data-testid="preferences-backdrop"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        ref={drawerRef}
        data-testid="preferences-drawer"
        role="dialog"
        aria-label="Advanced Preferences"
        style={{
          width: '360px',
          maxWidth: '90vw',
          background: '#fff',
          height: '100%',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'system-ui, sans-serif',
          animation: 'slideInRight 0.25s ease-out',
        }}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #ecf0f1',
        }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#2c3e50' }}>
            ⚙ Advanced Preferences
          </h3>
          <button
            data-testid="drawer-close"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#7f8c8d',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {/* Budget slider */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', color: '#2c3e50', marginBottom: '8px' }}>
              Budget
            </label>
            <input
              data-testid="budget-slider"
              type="range"
              min={BUDGET_MIN}
              max={BUDGET_MAX}
              step={BUDGET_STEP}
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              style={{ width: '100%', accentColor: '#3498db' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#7f8c8d', marginTop: '4px' }}>
              <span>${BUDGET_MIN.toLocaleString()}</span>
              <span data-testid="budget-value" style={{ fontWeight: 600, color: '#2c3e50' }}>${budget.toLocaleString()}</span>
              <span>${BUDGET_MAX.toLocaleString()}</span>
            </div>
          </div>

          {/* Product type toggle */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', color: '#2c3e50', marginBottom: '8px' }}>
              Product Type
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['physical', 'digital'] as const).map((type) => (
                <button
                  key={type}
                  data-testid={`product-type-${type}`}
                  onClick={() => setProductType(type)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '8px',
                    border: `2px solid ${productType === type ? '#3498db' : '#ecf0f1'}`,
                    background: productType === type ? '#ebf5fb' : '#fff',
                    color: productType === type ? '#2980b9' : '#7f8c8d',
                    fontWeight: productType === type ? 600 : 400,
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  {type === 'physical' ? 'Physical' : 'Digital'}
                </button>
              ))}
            </div>
          </div>

          {/* Fulfillment time radio */}
          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '14px', color: '#2c3e50', marginBottom: '8px' }}>
              Fulfillment Time
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {FULFILLMENT_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  data-testid={`fulfillment-${opt.value}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: `2px solid ${fulfillment === opt.value ? '#3498db' : '#ecf0f1'}`,
                    background: fulfillment === opt.value ? '#ebf5fb' : '#fff',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: fulfillment === opt.value ? '#2980b9' : '#7f8c8d',
                    fontWeight: fulfillment === opt.value ? 600 : 400,
                  }}
                >
                  <input
                    type="radio"
                    name="fulfillment"
                    value={opt.value}
                    checked={fulfillment === opt.value}
                    onChange={() => setFulfillment(opt.value)}
                    style={{ accentColor: '#3498db' }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* ── Footer buttons ──────────────────────────────────── */}
        <div style={{
          display: 'flex',
          gap: '12px',
          padding: '16px 20px',
          borderTop: '1px solid #ecf0f1',
        }}>
          <button
            data-testid="reset-button"
            onClick={handleReset}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid #bdc3c7',
              background: '#fff',
              color: '#7f8c8d',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
          <button
            data-testid="apply-button"
            onClick={handleApply}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: '#3498db',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * ResultsDashboardV2 — Container for categorized results (R-03, #255).
 *
 * PRD §8.1, §8.5, ADR-005 D3:
 * - Renders one CategoryGroup per CandidateCategory from analysisStore
 * - Actions bar: "Re-analyze ↻" button, "Export CSV ↓" button, "Save to My List ★" button
 * - Gear icon opens preferences drawer (placeholder)
 * - Empty state: "No results yet" message when categories empty
 *
 * Closes #255
 */

import React, { useState, useCallback } from 'react';
import { useAnalysisStore } from '../../store/analysisStore.js';
import { useWizardStore } from '../../store/wizardStore.js';
import CategoryGroup from './CategoryGroup.js';

// ── CSV export helper ───────────────────────────────────────────────

function exportCsv(categories: ReadonlyArray<{ name: string; products: ReadonlyArray<{ productName: string; overallScore: number; oneLineReason: string; category: string; primaryPlatform: string }> }>): void {
  const header = 'Category,Rank,Product Name,Score,Platform,Reason\n';
  const rows: string[] = [];
  for (const cat of categories) {
    cat.products.forEach((p, i) => {
      const escape = (s: string): string => `"${s.replace(/"/g, '""')}"`;
      rows.push([
        escape(cat.name),
        String(i + 1),
        escape(p.productName),
        String(p.overallScore),
        escape(p.primaryPlatform),
        escape(p.oneLineReason),
      ].join(','));
    });
  }
  const csv = header + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `onesell-results-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── ResultsDashboardV2 ──────────────────────────────────────────────

export default function ResultsDashboardV2(): React.ReactElement {
  const categories = useAnalysisStore((s) => s.categories);
  const analysisId = useAnalysisStore((s) => s.analysisId);
  const market = useWizardStore((s) => s.market);
  const [saved, setSaved] = useState(false);
  const [showToast, setShowToast] = useState(false);

  function handleReAnalyze(): void {
    setSaved(false); // reset saved state for new analysis
    void window.electronAPI.agent.runAnalysis(market?.marketId ?? 'us');
  }

  function handleExportCsv(): void {
    exportCsv(categories);
  }

  const handleSaveToList = useCallback(async (): Promise<void> => {
    if (saved) return;
    const entry = {
      sessionId: analysisId ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      marketId: market?.marketId ?? 'us',
      timestamp: new Date().toISOString(),
      productCount: categories.reduce((sum, cat) => sum + cat.products.length, 0),
      categoryCount: categories.length,
    };
    await window.electronAPI.store.addHistory(entry);
    setSaved(true);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  }, [saved, analysisId, market, categories]);

  const isEmpty = categories.length === 0;

  return (
    <div
      data-testid="results-dashboard-v2"
      style={{
        fontFamily: 'system-ui, sans-serif',
        maxWidth: '960px',
        margin: '0 auto',
        padding: '24px',
      }}
    >
      {/* ── Header ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        padding: '12px 0',
        borderBottom: '1px solid #ecf0f1',
      }}>
        <h2 style={{ margin: 0, fontSize: '22px', color: '#2c3e50' }}>
          Product Recommendations
        </h2>
        <button
          data-testid="gear-icon"
          aria-label="Preferences"
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

      {/* ── Actions bar ─────────────────────────────────────────── */}
      <div
        data-testid="actions-bar"
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        <button
          data-testid="re-analyze-button"
          onClick={handleReAnalyze}
          style={{
            padding: '8px 16px',
            border: '1px solid #3498db',
            borderRadius: '6px',
            background: '#fff',
            color: '#3498db',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Re-analyze ↻
        </button>
        <button
          data-testid="export-csv-button"
          onClick={handleExportCsv}
          style={{
            padding: '8px 16px',
            border: '1px solid #27ae60',
            borderRadius: '6px',
            background: '#fff',
            color: '#27ae60',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Export CSV ↓
        </button>
        <button
          data-testid="save-to-list-button"
          onClick={() => void handleSaveToList()}
          disabled={saved}
          style={{
            padding: '8px 16px',
            border: `1px solid ${saved ? '#27ae60' : '#f39c12'}`,
            borderRadius: '6px',
            background: '#fff',
            color: saved ? '#27ae60' : '#f39c12',
            fontSize: '13px',
            fontWeight: 600,
            cursor: saved ? 'default' : 'pointer',
            opacity: saved ? 0.8 : 1,
          }}
        >
          {saved ? '✓ Saved' : 'Save to My List ★'}
        </button>
      </div>

      {/* ── Save toast (R-13, #295, PRD §8.7) ───────────────────── */}
      {showToast && (
        <div
          data-testid="save-toast"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            background: '#27ae60',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
          }}
        >
          Saved!
        </div>
      )}

      {/* ── Category groups or empty state ───────────────────────── */}
      {isEmpty ? (
        <div
          data-testid="empty-state"
          style={{
            textAlign: 'center',
            padding: '64px 16px',
            color: '#95a5a6',
            fontSize: '16px',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
          <p>No results yet</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            Run an analysis to see product recommendations here.
          </p>
        </div>
      ) : (
        <div data-testid="category-list">
          {categories.map((category) => (
            <CategoryGroup key={category.name} category={category} />
          ))}
        </div>
      )}
    </div>
  );
}

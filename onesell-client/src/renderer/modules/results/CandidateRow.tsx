/**
 * CandidateRow — Product row with rank, name, score badge, and reasoning (R-07, #259).
 *
 * PRD §8.3, ADR-005 D3:
 * - Shows: rank (#N), product name, score badge (0-100), one-line reason
 * - Click row expands inline CandidateDetail
 * - "▸ Detail" button navigates to full ProductDetail (sets step to 5)
 *
 * Closes #259
 */

import React, { useState } from 'react';
import type { ProductCandidate } from '../../../shared/types/index.js';
import { useWizardStore } from '../../store/wizardStore.js';
import { useAnalysisStore } from '../../store/analysisStore.js';
import CandidateDetail from './CandidateDetail.js';

export interface CandidateRowProps {
  candidate: ProductCandidate;
  rank: number;
}

function scoreColor(score: number): string {
  if (score >= 75) return '#27ae60';
  if (score >= 50) return '#f39c12';
  return '#e74c3c';
}

export default function CandidateRow({ candidate, rank }: CandidateRowProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const setStep = useWizardStore((s) => s.setStep);
  const setSelectedCardId = useAnalysisStore((s) => s.setSelectedCardId);

  function handleDetailNavigation(e: React.MouseEvent): void {
    e.stopPropagation();
    setSelectedCardId(candidate.cardId);
    setStep(5);
  }

  return (
    <div data-testid={`candidate-row-${candidate.cardId}`} style={{ marginBottom: '4px' }}>
      {/* ── Collapsed row ───────────────────────────────────────── */}
      <div
        onClick={() => setExpanded((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '10px 12px',
          borderRadius: '6px',
          cursor: 'pointer',
          background: expanded ? '#f7f9fc' : '#fff',
          border: '1px solid #ecf0f1',
          transition: 'background 0.15s ease',
        }}
      >
        {/* Rank */}
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: '#ecf0f1',
          fontSize: '12px',
          fontWeight: 700,
          color: '#2c3e50',
          flexShrink: 0,
        }}>
          #{rank}
        </span>

        {/* Product name */}
        <span style={{
          flex: 1,
          fontSize: '14px',
          fontWeight: 500,
          color: '#2c3e50',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {candidate.productName}
        </span>

        {/* Score badge */}
        <span
          data-testid={`score-badge-${candidate.cardId}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '36px',
            padding: '2px 8px',
            borderRadius: '12px',
            background: scoreColor(candidate.overallScore),
            color: '#fff',
            fontSize: '12px',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {candidate.overallScore}
        </span>

        {/* One-line reason */}
        <span style={{
          flex: 2,
          fontSize: '13px',
          color: '#7f8c8d',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {candidate.oneLineReason}
        </span>

        {/* Detail navigation button */}
        <button
          data-testid={`detail-button-${candidate.cardId}`}
          onClick={handleDetailNavigation}
          style={{
            padding: '4px 10px',
            border: '1px solid #bdc3c7',
            borderRadius: '4px',
            background: '#fff',
            fontSize: '12px',
            cursor: 'pointer',
            color: '#3498db',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          ▸ Detail
        </button>
      </div>

      {/* ── Expanded detail ─────────────────────────────────────── */}
      {expanded && (
        <div style={{ padding: '8px 12px 8px 40px' }}>
          <CandidateDetail candidate={candidate} />
        </div>
      )}
    </div>
  );
}

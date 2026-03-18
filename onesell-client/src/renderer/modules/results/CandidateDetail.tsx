/**
 * CandidateDetail — Expanded detail view with reasoning and score breakdown (R-09, #261).
 *
 * PRD §8.3, ADR-005 D3:
 * - "Why this product?" section: 3-5 bullets from whyBullets
 * - Score breakdown: horizontal bars for demand, competition, margin, trend
 * - Source platforms: list with data points
 * - Risk flags with ⚠️ icon
 * - Suggested next steps (placeholder text)
 *
 * Closes #261
 */

import React from 'react';
import type { ProductCandidate } from '../../../shared/types/index.js';

export interface CandidateDetailProps {
  candidate: ProductCandidate;
}

// ── Score bar component ─────────────────────────────────────────────

function ScoreBar({ label, value }: { label: string; value: number }): React.ReactElement {
  function barColor(v: number): string {
    if (v >= 75) return '#27ae60';
    if (v >= 50) return '#f39c12';
    return '#e74c3c';
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
      <span style={{ width: '100px', fontSize: '13px', color: '#34495e', textTransform: 'capitalize' }}>
        {label}
      </span>
      <div style={{
        flex: 1,
        height: '10px',
        background: '#ecf0f1',
        borderRadius: '5px',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(100, Math.max(0, value))}%`,
          height: '100%',
          background: barColor(value),
          borderRadius: '5px',
          transition: 'width 0.3s ease',
        }} />
      </div>
      <span style={{ width: '32px', fontSize: '12px', color: '#7f8c8d', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

// ── CandidateDetail ─────────────────────────────────────────────────

export default function CandidateDetail({ candidate }: CandidateDetailProps): React.ReactElement {
  const scores = candidate.rawScores;
  const riskFlags = candidate.candidateRiskFlags ?? [];
  const structuredRisks = candidate.riskFlags ?? [];

  return (
    <div data-testid={`candidate-detail-${candidate.cardId}`} style={{
      background: '#fafbfc',
      borderRadius: '8px',
      padding: '16px',
      border: '1px solid #ecf0f1',
    }}>
      {/* ── Why this product? ────────────────────────────────────── */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#2c3e50' }}>
          💡 Why this product?
        </h4>
        <ul data-testid="why-bullets" style={{ margin: 0, paddingLeft: '20px' }}>
          {candidate.whyBullets.map((bullet, i) => (
            <li key={i} style={{ fontSize: '13px', color: '#34495e', marginBottom: '4px' }}>
              {bullet}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Score breakdown ──────────────────────────────────────── */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#2c3e50' }}>
          📊 Score Breakdown
        </h4>
        <div data-testid="score-breakdown">
          <ScoreBar label="Demand" value={scores.demand} />
          <ScoreBar label="Competition" value={scores.competition} />
          <ScoreBar label="Margin" value={scores.margin} />
          <ScoreBar label="Trend" value={scores.trend} />
        </div>
      </div>

      {/* ── Source platforms ─────────────────────────────────────── */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#2c3e50' }}>
          🌐 Source Platforms
        </h4>
        <div data-testid="source-platforms">
          {candidate.sourcePlatforms.map((source, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              marginBottom: '6px',
              fontSize: '13px',
            }}>
              <span style={{ fontWeight: 600, color: '#3498db', minWidth: '100px' }}>
                {source.platformId}
              </span>
              <span style={{ color: '#7f8c8d' }}>
                {source.dataPoints.join(', ')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Risk flags ───────────────────────────────────────────── */}
      {(riskFlags.length > 0 || structuredRisks.length > 0) && (
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#2c3e50' }}>
            ⚠️ Risk Flags
          </h4>
          <div data-testid="risk-flags">
            {structuredRisks.map((flag, i) => (
              <div key={`struct-${i}`} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: flag.severity === 'high' ? '#e74c3c' : flag.severity === 'medium' ? '#f39c12' : '#7f8c8d',
                marginBottom: '4px',
              }}>
                <span>⚠️</span>
                <span>{flag.description}</span>
              </div>
            ))}
            {riskFlags.map((flag, i) => (
              <div key={`simple-${i}`} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                color: '#f39c12',
                marginBottom: '4px',
              }}>
                <span>⚠️</span>
                <span>{flag}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Suggested next steps ─────────────────────────────────── */}
      <div>
        <h4 style={{ margin: '0 0 8px', fontSize: '14px', color: '#2c3e50' }}>
          🚀 Suggested Next Steps
        </h4>
        <ul data-testid="next-steps" style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#7f8c8d' }}>
          <li style={{ marginBottom: '4px' }}>Research supplier options on 1688 or Alibaba</li>
          <li style={{ marginBottom: '4px' }}>Order product samples for quality assessment</li>
          <li style={{ marginBottom: '4px' }}>Analyze competitor listings for positioning ideas</li>
          <li>Check regulatory requirements for target market</li>
        </ul>
      </div>
    </div>
  );
}

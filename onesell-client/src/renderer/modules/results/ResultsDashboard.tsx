import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnalysisStore } from '../../store/analysisStore.js';
import { useWizardStore } from '../../store/wizardStore.js';
import type { ProductCard } from '../../../shared/types/index.js';

type SortKey = 'score' | 'margin' | 'competition' | 'trend';
type RiskFilter = 'all' | 'SAFE' | 'WARNING' | 'FLAGGED';

function riskBadgeColor(risk: ProductCard['riskFlags'][number]['severity'] | string): string {
  switch (risk) {
    case 'SAFE': case 'low': return '#27ae60';
    case 'WARNING': case 'medium': return '#f39c12';
    case 'FLAGGED': case 'high': return '#e74c3c';
    default: return '#888';
  }
}

function getRiskLevel(card: ProductCard): 'SAFE' | 'WARNING' | 'FLAGGED' {
  if (card.riskFlags.some((f) => f.severity === 'high')) return 'FLAGGED';
  if (card.riskFlags.some((f) => f.severity === 'medium')) return 'WARNING';
  return 'SAFE';
}

function sortCards(cards: ProductCard[], key: SortKey): ProductCard[] {
  const sorted = [...cards];
  switch (key) {
    case 'score': sorted.sort((a, b) => b.overallScore - a.overallScore); break;
    case 'margin': sorted.sort((a, b) => b.estimatedMargin - a.estimatedMargin); break;
    case 'competition': sorted.sort((a, b) => a.rawScores.competition - b.rawScores.competition); break;
    case 'trend': sorted.sort((a, b) => b.rawScores.trend - a.rawScores.trend); break;
  }
  return sorted;
}

function exportCSV(cards: ProductCard[]): void {
  const header = 'Rank,Name,Score,Margin,Category,Risk\n';
  const rows = cards.map((c) =>
    `${c.rank},"${c.productName}",${c.overallScore},${(c.estimatedMargin * 100).toFixed(1)}%,"${c.category}",${getRiskLevel(c)}`
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'onesell-results.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResultsDashboard(): React.ReactElement {
  const { t } = useTranslation();
  const { analysisId, results, setResults, setSelectedCardId } = useAnalysisStore();
  const { setStep } = useWizardStore();
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedCards, setSavedCards] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!analysisId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await window.electronAPI.analysis.getResults(analysisId);
        if (!cancelled) {
          setResults(res.results as ProductCard[]);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t('results.fetchError'));
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [analysisId, setResults, t]);

  const displayed = useMemo(() => {
    let cards = results;
    if (riskFilter !== 'all') {
      cards = cards.filter((c) => getRiskLevel(c) === riskFilter);
    }
    return sortCards(cards, sortKey);
  }, [results, sortKey, riskFilter]);

  function handleSave(cardId: string): void {
    setSavedCards((prev) => new Set(prev).add(cardId));
  }

  function handleCardClick(cardId: string): void {
    setSelectedCardId(cardId);
    setStep(11);
  }

  function handleRetry(): void {
    setStep(9);
  }

  if (loading) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', paddingTop: '20vh' }}>
        <p>{t('results.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', paddingTop: '20vh' }}>
        <p role="alert" style={{ color: '#e74c3c' }}>{error}</p>
        <button aria-label={t('analysis.retry')} onClick={handleRetry} style={retryBtnStyle}>
          {t('analysis.retry')}
        </button>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', paddingTop: '20vh' }}>
        <h2>{t('results.emptyTitle')}</h2>
        <p style={{ color: '#666' }}>{t('results.emptyDescription')}</p>
        <button aria-label={t('analysis.retry')} onClick={handleRetry} style={retryBtnStyle}>
          {t('analysis.retry')}
        </button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 900, margin: '30px auto', padding: '0 20px' }}>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>{t('results.heading')}</h1>

      {/* Controls bar */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        <label style={{ fontSize: 13, color: '#555' }}>
          {t('results.sortBy')}
          <select
            aria-label={t('results.sortBy')}
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            style={{ marginLeft: 6, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
          >
            <option value="score">{t('results.sortScore')}</option>
            <option value="margin">{t('results.sortMargin')}</option>
            <option value="competition">{t('results.sortCompetition')}</option>
            <option value="trend">{t('results.sortTrend')}</option>
          </select>
        </label>

        <label style={{ fontSize: 13, color: '#555' }}>
          {t('results.filterRisk')}
          <select
            aria-label={t('results.filterRisk')}
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value as RiskFilter)}
            style={{ marginLeft: 6, padding: '4px 8px', borderRadius: 4, border: '1px solid #ccc' }}
          >
            <option value="all">{t('results.filterAll')}</option>
            <option value="SAFE">{t('results.filterSafe')}</option>
            <option value="WARNING">{t('results.filterWarning')}</option>
            <option value="FLAGGED">{t('results.filterFlagged')}</option>
          </select>
        </label>

        <button
          aria-label={t('results.exportCSV')}
          onClick={() => exportCSV(displayed)}
          style={{
            marginLeft: 'auto', padding: '6px 16px', border: '1px solid #ccc',
            borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13,
          }}
        >
          {t('results.exportCSV')}
        </button>
      </div>

      {/* Cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {displayed.map((card) => {
          const risk = getRiskLevel(card);
          return (
            <div
              key={card.cardId}
              data-testid={`product-card-${card.cardId}`}
              style={{
                border: '1px solid #e0e0e0', borderRadius: 8, padding: 16,
                cursor: 'pointer', transition: 'box-shadow 0.15s',
              }}
              onClick={() => handleCardClick(card.cardId)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCardClick(card.cardId); }}
              role="button"
              tabIndex={0}
              aria-label={`${card.productName} — ${t('results.score')} ${card.overallScore}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#888' }}>#{card.rank}</span>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 10,
                  backgroundColor: riskBadgeColor(risk), color: '#fff',
                }}>
                  {risk}
                </span>
              </div>
              <h3 style={{ fontSize: 16, margin: '0 0 6px' }}>{card.productName}</h3>
              <p style={{ fontSize: 13, color: '#555', margin: '0 0 4px' }}>
                {t('results.score')}: <strong>{card.overallScore}</strong>
              </p>
              <p style={{ fontSize: 13, color: '#555', margin: '0 0 4px' }}>
                {t('results.margin')}: {(card.estimatedMargin * 100).toFixed(1)}%
              </p>
              <p style={{ fontSize: 12, color: '#888', margin: '0 0 10px', minHeight: 32 }}>
                {card.agentJustification.slice(0, 80)}{card.agentJustification.length > 80 ? '…' : ''}
              </p>
              <button
                aria-label={`${t('results.save')} ${card.productName}`}
                onClick={(e) => { e.stopPropagation(); handleSave(card.cardId); }}
                disabled={savedCards.has(card.cardId)}
                style={{
                  padding: '4px 14px', border: '1px solid #ccc', borderRadius: 4,
                  background: savedCards.has(card.cardId) ? '#eee' : '#fff',
                  cursor: savedCards.has(card.cardId) ? 'default' : 'pointer', fontSize: 12,
                }}
              >
                {savedCards.has(card.cardId) ? t('results.saved') : t('results.save')}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const retryBtnStyle: React.CSSProperties = {
  padding: '8px 20px', border: 'none', borderRadius: 6,
  backgroundColor: '#4a90e2', color: '#fff', fontSize: 14, cursor: 'pointer', marginTop: 12,
};

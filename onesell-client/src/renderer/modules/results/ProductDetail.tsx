import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAnalysisStore } from '../../store/analysisStore.js';
import { useWizardStore } from '../../store/wizardStore.js';
import type { ProductCard } from '../../../shared/types/index.js';
import ReasoningLog from './ReasoningLog.js';

type Tab = 'overview' | 'trends' | 'competition' | 'margin' | 'reasoning';

function getRiskLevel(card: ProductCard): 'SAFE' | 'WARNING' | 'FLAGGED' {
  if (card.riskFlags.some((f) => f.severity === 'high')) return 'FLAGGED';
  if (card.riskFlags.some((f) => f.severity === 'medium')) return 'WARNING';
  return 'SAFE';
}

function riskColor(severity: string): string {
  switch (severity) {
    case 'high': return '#e74c3c';
    case 'medium': return '#f39c12';
    default: return '#27ae60';
  }
}

export default function ProductDetail(): React.ReactElement {
  const { t } = useTranslation();
  const { results, selectedCardId, setSelectedCardId } = useAnalysisStore();
  const { setStep } = useWizardStore();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const card = results.find((c) => c.cardId === selectedCardId) ?? null;

  function handleBack(): void {
    setSelectedCardId(null);
    setStep(10);
  }

  if (!card) {
    return (
      <div style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', paddingTop: '20vh' }}>
        <p>{t('detail.notFound')}</p>
        <button aria-label={t('detail.back')} onClick={handleBack} style={backBtnStyle}>
          {t('detail.back')}
        </button>
      </div>
    );
  }

  const tabs: { key: Tab; labelKey: string }[] = [
    { key: 'overview', labelKey: 'detail.tabOverview' },
    { key: 'trends', labelKey: 'detail.tabTrends' },
    { key: 'competition', labelKey: 'detail.tabCompetition' },
    { key: 'margin', labelKey: 'detail.tabMargin' },
    { key: 'reasoning', labelKey: 'detail.tabReasoning' },
  ];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 700, margin: '30px auto', padding: '0 20px' }}>
      <button aria-label={t('detail.back')} onClick={handleBack} style={backBtnStyle}>
        ← {t('detail.back')}
      </button>

      <h1 style={{ fontSize: 22, margin: '16px 0 4px' }}>{card.productName}</h1>
      <p style={{ color: '#888', fontSize: 13, marginBottom: 20 }}>
        #{card.rank} · {card.category} · {getRiskLevel(card)}
      </p>

      {/* Tabs */}
      <div role="tablist" aria-label={t('detail.tabs')} style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e0e0e0', marginBottom: 20 }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-label={t(tab.labelKey)}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '8px 18px', border: 'none', borderBottom: activeTab === tab.key ? '2px solid #4a90e2' : '2px solid transparent',
              background: 'none', cursor: 'pointer', fontSize: 14, marginBottom: -2,
              color: activeTab === tab.key ? '#4a90e2' : '#666', fontWeight: activeTab === tab.key ? 600 : 400,
            }}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div role="tabpanel">
        {activeTab === 'overview' && <OverviewPanel card={card} />}
        {activeTab === 'trends' && <TrendsPanel card={card} />}
        {activeTab === 'competition' && <CompetitionPanel card={card} />}
        {activeTab === 'margin' && <MarginCalculator card={card} />}
        {activeTab === 'reasoning' && (
          <ReasoningLog steps={card.reasoningSteps ?? []} justification={card.agentJustification} />
        )}
      </div>
    </div>
  );
}

function OverviewPanel({ card }: { card: ProductCard }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div>
      <h3 style={{ fontSize: 16, marginBottom: 8 }}>{t('detail.reasons')}</h3>
      <ul style={{ paddingLeft: 20, fontSize: 14, color: '#444', lineHeight: 1.8 }}>
        {(card.agentJustification ? [card.agentJustification] : []).map((r, i) => (
          <li key={i}>{r}</li>
        ))}
      </ul>

      {card.riskFlags.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, marginTop: 16, marginBottom: 8 }}>{t('detail.riskFlags')}</h3>
          <ul style={{ paddingLeft: 20, fontSize: 14, lineHeight: 1.8 }}>
            {card.riskFlags.map((flag, i) => (
              <li key={i} style={{ color: riskColor(flag.severity) }}>
                [{flag.severity.toUpperCase()}] {flag.description}
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 style={{ fontSize: 16, marginTop: 16, marginBottom: 8 }}>{t('detail.category')}</h3>
      <p style={{ fontSize: 14, color: '#444' }}>{card.category}</p>

      <h3 style={{ fontSize: 16, marginTop: 16, marginBottom: 8 }}>{t('detail.marketInsight')}</h3>
      <p style={{ fontSize: 14, color: '#444' }}>{card.marketInsight}</p>
    </div>
  );
}

function TrendsPanel({ card }: { card: ProductCard }): React.ReactElement {
  const { t } = useTranslation();
  const score = card.rawScores.trend;
  return (
    <div>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>{t('detail.trendScore')}: {score}/100</h3>
      {/* Simple bar chart using inline CSS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { label: t('detail.trendDemand'), value: card.rawScores.demand },
          { label: t('detail.trendTrend'), value: card.rawScores.trend },
          { label: t('detail.trendBeginner'), value: card.rawScores.beginner },
        ].map((item) => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 100, fontSize: 13, color: '#555', textAlign: 'right' }}>{item.label}</span>
            <div style={{ flex: 1, height: 20, backgroundColor: '#eee', borderRadius: 4, overflow: 'hidden' }}>
              <div
                data-testid={`bar-${item.label}`}
                style={{ width: `${item.value}%`, height: '100%', backgroundColor: '#4a90e2', borderRadius: 4, transition: 'width 0.3s' }}
              />
            </div>
            <span style={{ width: 36, fontSize: 13, color: '#444' }}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompetitionPanel({ card }: { card: ProductCard }): React.ReactElement {
  const { t } = useTranslation();
  const score = card.rawScores.competition;
  return (
    <div>
      <h3 style={{ fontSize: 16, marginBottom: 8 }}>{t('detail.competitionScore')}: {score}/100</h3>
      <p style={{ fontSize: 14, color: '#555', marginBottom: 12 }}>
        {score <= 30 ? t('detail.competitionLow') : score <= 60 ? t('detail.competitionMedium') : t('detail.competitionHigh')}
      </p>
      <div style={{ height: 24, backgroundColor: '#eee', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          width: `${score}%`, height: '100%', borderRadius: 4,
          backgroundColor: score <= 30 ? '#27ae60' : score <= 60 ? '#f39c12' : '#e74c3c',
        }} />
      </div>
    </div>
  );
}

function MarginCalculator({ card }: { card: ProductCard }): React.ReactElement {
  const { t } = useTranslation();
  const [cost, setCost] = useState(card.estimatedCogs.value);
  const [price, setPrice] = useState(card.estimatedSellPrice.value);
  const [fees, setFees] = useState(15); // default platform fee percentage

  const margin = useMemo(() => {
    if (price <= 0) return 0;
    const feeAmount = price * (fees / 100);
    return ((price - cost - feeAmount) / price) * 100;
  }, [cost, price, fees]);

  return (
    <div>
      <h3 style={{ fontSize: 16, marginBottom: 16 }}>{t('detail.marginCalculator')}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 320 }}>
        <label style={{ fontSize: 13, color: '#555' }}>
          {t('detail.costInput')}
          <input
            aria-label={t('detail.costInput')}
            type="number"
            min={0}
            step={0.01}
            value={cost}
            onChange={(e) => setCost(Number(e.target.value))}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 13, color: '#555' }}>
          {t('detail.priceInput')}
          <input
            aria-label={t('detail.priceInput')}
            type="number"
            min={0}
            step={0.01}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            style={inputStyle}
          />
        </label>
        <label style={{ fontSize: 13, color: '#555' }}>
          {t('detail.feesInput')}
          <input
            aria-label={t('detail.feesInput')}
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={fees}
            onChange={(e) => setFees(Number(e.target.value))}
            style={inputStyle}
          />
        </label>
      </div>
      <div style={{ marginTop: 20, padding: 16, backgroundColor: '#f8f9fa', borderRadius: 8 }}>
        <p style={{ fontSize: 14, color: '#444', margin: 0 }}>
          {t('detail.calculatedMargin')}:{' '}
          <strong data-testid="calculated-margin" style={{ fontSize: 20, color: margin >= 0 ? '#27ae60' : '#e74c3c' }}>
            {margin.toFixed(1)}%
          </strong>
        </p>
      </div>
    </div>
  );
}

const backBtnStyle: React.CSSProperties = {
  padding: '6px 14px', border: '1px solid #ccc', borderRadius: 6,
  background: '#fff', cursor: 'pointer', fontSize: 13,
};

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '6px 10px', marginTop: 4,
  border: '1px solid #ccc', borderRadius: 4, fontSize: 14,
};

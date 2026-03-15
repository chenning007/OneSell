import React from 'react';
import { useTranslation } from '../../i18n/index.js';
import { useWizardStore } from '../../store/wizardStore.js';
import { BUDGET_RANGES } from '../../config/markets.js';

export default function BudgetStep(): React.ReactElement {
  const { t } = useTranslation();
  const { market, preferences, updatePreferences } = useWizardStore();

  const marketId = market?.marketId ?? 'us';
  const range = BUDGET_RANGES[marketId] ?? BUDGET_RANGES['us']!;

  const currentBudgetMax = (preferences.budget?.max ?? range.mid);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>): void {
    const value = Number(e.target.value);
    updatePreferences({ budget: { min: range.min, max: value, currency: range.currency } });
  }

  return (
    <div>
      <h2 style={{ marginBottom: '32px' }}>{t('wizard.budget')}</h2>
      <div style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: '#666' }}>
          <span>{t('budget.low')}: {range.symbol}{range.min}</span>
          <span>{t('budget.mid')}: {range.symbol}{range.mid}</span>
          <span>{t('budget.high')}: {range.symbol}{range.max}</span>
        </div>
        <input
          type="range"
          min={range.min}
          max={range.max}
          step={(range.max - range.min) / 100}
          value={currentBudgetMax}
          onChange={handleChange}
          style={{ width: '100%', height: '8px', cursor: 'pointer' }}
        />
        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '24px', fontWeight: 700, color: '#0066cc' }}>
          {range.symbol}{currentBudgetMax.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

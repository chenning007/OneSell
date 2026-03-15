import React from 'react';
import { useTranslation } from '../../i18n/index.js';
import { useWizardStore } from '../../store/wizardStore.js';
import { MARKET_CATEGORIES } from '../../config/markets.js';

export default function CategoriesStep(): React.ReactElement {
  const { t } = useTranslation();
  const { market, preferences, updatePreferences } = useWizardStore();

  const marketId = market?.marketId ?? 'us';
  const categories = MARKET_CATEGORIES[marketId] ?? MARKET_CATEGORIES['us']!;
  const selected = preferences.categories ?? [];

  function toggleCategory(id: string): void {
    const next = selected.includes(id)
      ? selected.filter((c) => c !== id)
      : [...selected, id];
    updatePreferences({ categories: next });
  }

  return (
    <div>
      <h2 style={{ marginBottom: '24px' }}>{t('wizard.categories')}</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
        {categories.map((cat) => {
          const isSelected = selected.includes(cat.id);
          return (
            <button
              key={cat.id}
              onClick={() => toggleCategory(cat.id)}
              style={{
                padding: '10px 20px',
                border: `2px solid ${isSelected ? '#0066cc' : '#e0e0e0'}`,
                borderRadius: '24px',
                background: isSelected ? '#0066cc' : '#fff',
                color: isSelected ? '#fff' : '#333',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: isSelected ? 600 : 400,
                transition: 'all 0.15s ease',
              }}
            >
              {t(cat.i18nKey as never)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

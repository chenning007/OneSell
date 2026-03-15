import React from 'react';
import { useTranslation } from '../../i18n/index.js';
import { switchLanguage } from '../../i18n/index.js';
import { MARKET_CONFIGS } from '../../config/markets.js';
import { useWizardStore } from '../../store/wizardStore.js';
import type { MarketContext } from '../../../shared/types/index.js';

export default function MarketSelection(): React.ReactElement {
  const { t } = useTranslation();
  const { market, setMarket, setStep } = useWizardStore();

  function handleSelect(marketId: string): void {
    const config = MARKET_CONFIGS[marketId];
    if (!config) return;
    const ctx: MarketContext = {
      marketId: config.marketId,
      language: config.language,
      currency: config.currency,
      platforms: config.platforms,
    };
    setMarket(ctx);
    switchLanguage(config.i18nLang);
    setStep(2);
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '32px' }}>{t('wizard.selectMarket')}</h1>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '16px',
      }}>
        {Object.values(MARKET_CONFIGS).map((config) => {
          const isSelected = market?.marketId === config.marketId;
          return (
            <button
              key={config.marketId}
              onClick={() => handleSelect(config.marketId)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                border: `2px solid ${isSelected ? '#0066cc' : '#e0e0e0'}`,
                borderRadius: '12px',
                background: isSelected ? '#e8f0fe' : '#ffffff',
                cursor: 'pointer',
                fontSize: '16px',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ fontSize: '48px', lineHeight: 1, marginBottom: '12px' }}>{config.flag}</span>
              <span style={{ fontWeight: isSelected ? 700 : 400 }}>
                {t(`markets.${config.marketId}` as never)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

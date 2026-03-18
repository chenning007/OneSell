import React from 'react';
import { useTranslation } from '../../i18n/index.js';
import { useWizardStore } from '../../store/wizardStore.js';
import { MARKET_CONFIGS } from '../../config/markets.js';

/**
 * @deprecated v1 PlatformStep — will be removed in v2 (ADR-005 D1).
 * Platforms are now auto-selected from MARKET_CONFIGS[marketId].
 */
export default function PlatformStep(): React.ReactElement {
  const { t } = useTranslation();
  const { market } = useWizardStore();

  const marketId = market?.marketId ?? 'us';
  const config = MARKET_CONFIGS[marketId];
  const platforms = config?.platforms ?? [];

  return (
    <div>
      <h2 style={{ marginBottom: '24px' }}>{t('wizard.platforms')}</h2>
      <p style={{ marginBottom: '16px', color: '#666' }}>Platforms are auto-selected for your market.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
        {platforms.map((platformId) => (
          <div
            key={platformId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px',
              border: '2px solid #0066cc',
              borderRadius: '8px',
              background: '#e8f0fe',
              fontSize: '15px',
            }}
          >
            {t(`platforms.${platformId}` as never, { defaultValue: platformId })}
          </div>
        ))}
      </div>
    </div>
  );
}

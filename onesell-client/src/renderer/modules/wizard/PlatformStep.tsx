import React from 'react';
import { useTranslation } from '../../i18n/index.js';
import { useWizardStore } from '../../store/wizardStore.js';
import { MARKET_CONFIGS } from '../../config/markets.js';

export default function PlatformStep(): React.ReactElement {
  const { t } = useTranslation();
  const { market, selectedPlatforms, setSelectedPlatforms } = useWizardStore();

  const marketId = market?.marketId ?? 'us';
  const config = MARKET_CONFIGS[marketId];
  const platforms = config?.platforms ?? [];

  function togglePlatform(platformId: string): void {
    if (selectedPlatforms.includes(platformId)) {
      setSelectedPlatforms(selectedPlatforms.filter((p) => p !== platformId));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platformId]);
    }
  }

  return (
    <div>
      <h2 style={{ marginBottom: '24px' }}>{t('wizard.platforms')}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
        {platforms.map((platformId) => {
          const isChecked = selectedPlatforms.includes(platformId);
          return (
            <label
              key={platformId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '14px',
                border: `2px solid ${isChecked ? '#0066cc' : '#e0e0e0'}`,
                borderRadius: '8px',
                background: isChecked ? '#e8f0fe' : '#fff',
                cursor: 'pointer',
                fontSize: '15px',
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => togglePlatform(platformId)}
                style={{ accentColor: '#0066cc', width: '18px', height: '18px' }}
              />
              {t(`platforms.${platformId}` as never, { defaultValue: platformId })}
            </label>
          );
        })}
      </div>
      {selectedPlatforms.length === 0 && (
        <p style={{ color: '#cc0000', marginTop: '12px', fontSize: '14px' }}>Please select at least one platform.</p>
      )}
    </div>
  );
}

import React from 'react';
import { useTranslation } from '../../i18n/index.js';
import { useWizardStore } from '../../store/wizardStore.js';

type FulfillmentOption = 'lt5h' | '5to15h' | 'gt15h';

export default function FulfillmentStep(): React.ReactElement {
  const { t } = useTranslation();
  const { updatePreferences } = useWizardStore();
  const [selected, setSelected] = React.useState<FulfillmentOption | null>(null);

  const options: Array<{ id: FulfillmentOption; labelKey: string; emoji: string }> = [
    { id: 'lt5h',    labelKey: 'fulfillment.lt5h',    emoji: '⚡' },
    { id: '5to15h',  labelKey: 'fulfillment.5to15h',  emoji: '🕐' },
    { id: 'gt15h',   labelKey: 'fulfillment.gt15h',   emoji: '💪' },
  ];

  function handleSelect(id: FulfillmentOption): void {
    setSelected(id);
    const riskMap: Record<FulfillmentOption, 'low' | 'medium' | 'high'> = {
      lt5h: 'low',
      '5to15h': 'medium',
      gt15h: 'high',
    };
    updatePreferences({ riskTolerance: riskMap[id] });
  }

  return (
    <div>
      <h2 style={{ marginBottom: '24px' }}>{t('wizard.fulfillment')}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {options.map((opt) => {
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                padding: '20px 24px',
                border: `3px solid ${isSelected ? '#0066cc' : '#e0e0e0'}`,
                borderRadius: '12px',
                background: isSelected ? '#e8f0fe' : '#fff',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: isSelected ? 700 : 400,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: '32px' }}>{opt.emoji}</span>
              <span>{t(opt.labelKey as never)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

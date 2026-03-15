import React from 'react';
import { useTranslation } from '../../i18n/index.js';
import { useWizardStore } from '../../store/wizardStore.js';

type ProductType = 'physical' | 'digital';

export default function ProductTypeStep(): React.ReactElement {
  const { t } = useTranslation();
  const { updatePreferences } = useWizardStore();

  // Use riskTolerance as a proxy field — in a real app we'd extend UserPreferences
  // We store productType in preferences as a custom extension; for now we use a local approach
  const [selected, setSelected] = React.useState<ProductType | null>(null);

  function handleSelect(type: ProductType): void {
    setSelected(type);
    // Map to sellerExperience as a stand-in until UserPreferences is extended
    updatePreferences({ sellerExperience: type === 'physical' ? 'some' : 'none' });
  }

  const options: Array<{ id: ProductType; emoji: string; labelKey: string }> = [
    { id: 'physical', emoji: '📦', labelKey: 'productType.physical' },
    { id: 'digital',  emoji: '💾', labelKey: 'productType.digital' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: '24px' }}>{t('wizard.productType')}</h2>
      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
        {options.map((opt) => {
          const isSelected = selected === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              style={{
                flex: 1,
                maxWidth: '240px',
                padding: '40px 24px',
                border: `3px solid ${isSelected ? '#0066cc' : '#e0e0e0'}`,
                borderRadius: '16px',
                background: isSelected ? '#e8f0fe' : '#fff',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: isSelected ? 700 : 400,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
              }}
            >
              <span style={{ fontSize: '48px' }}>{opt.emoji}</span>
              <span>{t(opt.labelKey as never)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

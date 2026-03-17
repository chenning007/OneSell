import React from 'react';
import { useTranslation } from '../../i18n/index.js';
import { useWizardStore } from '../../store/wizardStore.js';

const TOTAL_STEPS = 6;

interface WizardLayoutProps {
  children: React.ReactNode;
  onNext: () => void;
  onBack: () => void;
  onSkip?: () => void;
  canNext?: boolean;
  showSkip?: boolean;
  isLastStep?: boolean;
}

export default function WizardLayout({
  children,
  onNext,
  onBack,
  onSkip,
  canNext = true,
  showSkip = false,
  isLastStep = false,
}: WizardLayoutProps): React.ReactElement {
  const { t } = useTranslation();
  const { currentStep } = useWizardStore();

  const progress = ((currentStep - 1) / TOTAL_STEPS) * 100;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: '700px', margin: '0 auto', padding: '24px' }}>
      {/* Progress bar */}
      <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#666' }}>
        <span>{t('common.step', { current: currentStep - 1, total: TOTAL_STEPS })}</span>
      </div>
      <div role="progressbar" aria-valuenow={currentStep} aria-valuemin={1} aria-valuemax={6} aria-label="Wizard progress" style={{ height: '6px', background: '#e0e0e0', borderRadius: '3px', marginBottom: '32px' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: '#0066cc', borderRadius: '3px', transition: 'width 0.3s ease' }} />
      </div>

      {/* Step content */}
      <div style={{ minHeight: '300px' }}>
        {children}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px' }}>
        <button
          onClick={onBack}
          disabled={currentStep <= 2}
          style={{
            padding: '10px 24px',
            border: '1px solid #ccc',
            borderRadius: '8px',
            background: currentStep <= 2 ? '#f5f5f5' : '#fff',
            color: currentStep <= 2 ? '#aaa' : '#333',
            cursor: currentStep <= 2 ? 'not-allowed' : 'pointer',
            fontSize: '16px',
          }}
        >
          {t('common.back')}
        </button>

        <div style={{ display: 'flex', gap: '12px' }}>
          {showSkip && onSkip && (
            <button
              onClick={onSkip}
              style={{ padding: '10px 24px', border: '1px solid #ccc', borderRadius: '8px', background: '#fff', cursor: 'pointer', fontSize: '16px', color: '#666' }}
            >
              {t('common.skip')}
            </button>
          )}
          <button
            onClick={onNext}
            disabled={!canNext}
            style={{
              padding: '10px 24px',
              border: 'none',
              borderRadius: '8px',
              background: canNext ? '#0066cc' : '#ccc',
              color: '#fff',
              cursor: canNext ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              fontWeight: 600,
            }}
          >
            {isLastStep ? t('common.analyze') : t('common.next')}
          </button>
        </div>
      </div>
    </div>
  );
}

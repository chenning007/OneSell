import React from 'react';
import { useWizardStore } from '../../store/wizardStore.js';
import WizardLayout from './WizardLayout.js';
import BudgetStep from './BudgetStep.js';
import PlatformStep from './PlatformStep.js';
import ProductTypeStep from './ProductTypeStep.js';
import CategoriesStep from './CategoriesStep.js';
import FulfillmentStep from './FulfillmentStep.js';

/** @deprecated v1 Wizard — will be removed in v2 (ADR-005 D1). */
export default function Wizard(): React.ReactElement {
  const { currentStep, setStep, updatePreferences } = useWizardStore();

  function handleNext(): void {
    setStep(currentStep + 1);
  }

  function handleBack(): void {
    if (currentStep > 2) setStep(currentStep - 1);
  }

  function handleSkip(): void {
    if (currentStep === 4) {
      updatePreferences({ sellerExperience: 'some' });
    }
    if (currentStep === 6) {
      updatePreferences({ riskTolerance: 'medium' });
    }
    setStep(currentStep + 1);
  }

  const stepContent: Record<number, React.ReactNode> = {
    2: <BudgetStep />,
    3: <PlatformStep />,
    4: <ProductTypeStep />,
    5: <CategoriesStep />,
    6: <FulfillmentStep />,
  };

  // v2: platforms are auto-selected; canNext is always true for step 3
  const canNext = true;
  const isLastStep = currentStep === 6;
  const showSkip = currentStep !== 3;

  return (
    <WizardLayout
      onNext={handleNext}
      onBack={handleBack}
      onSkip={handleSkip}
      canNext={canNext}
      showSkip={showSkip}
      isLastStep={isLastStep}
    >
      {stepContent[currentStep] ?? <div>Unknown step</div>}
    </WizardLayout>
  );
}

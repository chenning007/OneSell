import React from 'react';
import { useWizardStore } from '../../store/wizardStore.js';
import WizardLayout from './WizardLayout.js';
import BudgetStep from './BudgetStep.js';
import PlatformStep from './PlatformStep.js';
import ProductTypeStep from './ProductTypeStep.js';
import CategoriesStep from './CategoriesStep.js';
import FulfillmentStep from './FulfillmentStep.js';

export default function Wizard(): React.ReactElement {
  const { currentStep, selectedPlatforms, setStep } = useWizardStore();

  function handleNext(): void {
    setStep(currentStep + 1);
  }

  function handleBack(): void {
    if (currentStep > 2) setStep(currentStep - 1);
  }

  function handleSkip(): void {
    setStep(currentStep + 1);
  }

  const stepContent: Record<number, React.ReactNode> = {
    2: <BudgetStep />,
    3: <PlatformStep />,
    4: <ProductTypeStep />,
    5: <CategoriesStep />,
    6: <FulfillmentStep />,
  };

  const canNext = currentStep === 3 ? selectedPlatforms.length > 0 : true;
  const isLastStep = currentStep === 6;
  const showSkip = currentStep !== 3; // Platform step requires at least 1

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

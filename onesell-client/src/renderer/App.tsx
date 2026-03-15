import React from 'react';
import { useWizardStore } from './store/wizardStore.js';
import MarketSelection from './modules/wizard/MarketSelection.js';
import Wizard from './modules/wizard/Wizard.js';
import DataSourceConnect from './modules/data-sources/DataSourceConnect.js';

export default function App(): React.ReactElement {
  const { currentStep } = useWizardStore();

  if (currentStep === 1) {
    return <MarketSelection />;
  }

  if (currentStep >= 2 && currentStep <= 6) {
    return <Wizard />;
  }

  if (currentStep === 7) {
    return <DataSourceConnect />;
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', paddingTop: '20vh' }}>
      <h2>Analysis starting...</h2>
      <p>Please wait while we analyze your selections.</p>
    </div>
  );
}

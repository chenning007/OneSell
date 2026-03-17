import React from 'react';
import { useWizardStore } from './store/wizardStore.js';
import MarketSelection from './modules/wizard/MarketSelection.js';
import Wizard from './modules/wizard/Wizard.js';
import DataSourceConnect from './modules/data-sources/DataSourceConnect.js';
import ProgressScreen from './modules/progress/ProgressScreen.js';
import DebugPanel from './components/DebugPanel.js';
import GlobalStyles from './components/GlobalStyles.js';
import FadeTransition from './components/FadeTransition.js';

export default function App(): React.ReactElement {
  const { currentStep } = useWizardStore();

  let content: React.ReactElement;

  if (currentStep === 1) {
    content = <MarketSelection />;
  } else if (currentStep >= 2 && currentStep <= 6) {
    content = <Wizard />;
  } else if (currentStep === 7) {
    content = <DataSourceConnect />;
  } else if (currentStep === 8) {
    content = <ProgressScreen />;
  } else {
    content = (
      <div style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', paddingTop: '20vh' }}>
        <h2>Analysis starting...</h2>
        <p>Please wait while we analyze your selections.</p>
      </div>
    );
  }

  return (
    <>
      <GlobalStyles />
      {/* Add bottom padding so content isn't hidden behind debug panel */}
      <div style={{ paddingBottom: '220px' }}>
        <FadeTransition key={currentStep}>{content}</FadeTransition>
      </div>
      <DebugPanel />
    </>
  );
}

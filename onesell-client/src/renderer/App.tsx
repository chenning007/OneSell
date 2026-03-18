/**
 * App.tsx v2 — 6-screen routing (W-07, #233).
 *
 * PRD §9, ADR-005 D1:
 * Step 0 → QuickStartScreen (returning users)
 * Step 1 → MarketSelection
 * Step 2 → ExtractionDashboard
 * Step 3 → AgentAnalysisScreen
 * Step 4 → ResultsDashboardV2
 * Step 5 → ProductDetail
 *
 * Closes #233
 */

import React from 'react';
import { useWizardStore } from './store/wizardStore.js';
import QuickStartScreen from './modules/wizard/QuickStartScreen.js';
import MarketSelection from './modules/wizard/MarketSelection.js';
import ExtractionDashboard from './modules/extraction/ExtractionDashboard.js';
import AgentAnalysisScreen from './modules/analysis/AgentAnalysisScreen.js';
import ResultsDashboardV2 from './modules/results/ResultsDashboardV2.js';
import ProductDetail from './modules/results/ProductDetail.js';
import DebugPanel from './components/DebugPanel.js';
import GlobalStyles from './components/GlobalStyles.js';
import FadeTransition from './components/FadeTransition.js';

// ── Step → Screen mapping ───────────────────────────────────────────

const SCREEN_MAP: Record<number, React.ComponentType> = {
  0: QuickStartScreen,
  1: MarketSelection,
  2: ExtractionDashboard,
  3: AgentAnalysisScreen,
  4: ResultsDashboardV2,
  5: ProductDetail,
};

export default function App(): React.ReactElement {
  const { currentStep } = useWizardStore();

  const Screen = SCREEN_MAP[currentStep];
  const content: React.ReactElement = Screen
    ? <Screen />
    : (
      <div style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', paddingTop: '20vh' }}>
        <h2>Unknown screen</h2>
        <p>Step {currentStep} is not mapped to a screen.</p>
      </div>
    );

  return (
    <>
      <GlobalStyles />
      <div style={{ paddingBottom: '220px' }}>
        <FadeTransition key={currentStep}>{content}</FadeTransition>
      </div>
      <DebugPanel />
    </>
  );
}

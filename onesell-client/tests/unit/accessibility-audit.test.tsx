/**
 * Issue #61 — Accessibility Audit (WCAG 2.1 AA)
 *
 * Automated ARIA/keyboard/semantic checks on all key screens:
 *   1. MarketSelection (Step 1)
 *   2. WizardLayout (Steps 2-6 wrapper)
 *   3. DataSourceConnect (Step 7)
 *   4. ProgressScreen (Step 8)
 *   5. ResultsDashboard (Step 10)
 *   6. ProductDetail (Step 11)
 *
 * Uses @testing-library/react role queries to verify ARIA attributes,
 * keyboard navigation, heading hierarchy, form labels, and a11y regions.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, cleanup, fireEvent } from '@testing-library/react';
import React from 'react';
import { I18nextProvider } from 'react-i18next';

// Mock useExtractionRunner to prevent IPC calls during ProgressScreen render
vi.mock('../../src/renderer/modules/progress/useExtractionRunner.js', () => ({
  useExtractionRunner: () => ({ rawResults: new Map(), isRunning: false }),
}));

import MarketSelection from '../../src/renderer/modules/wizard/MarketSelection.js';
import WizardLayout from '../../src/renderer/modules/wizard/WizardLayout.js';
import DataSourceConnect from '../../src/renderer/modules/data-sources/DataSourceConnect.js';
import ProgressScreen from '../../src/renderer/modules/progress/ProgressScreen.js';
import ResultsDashboard from '../../src/renderer/modules/results/ResultsDashboard.js';
import ProductDetail from '../../src/renderer/modules/results/ProductDetail.js';

import { useWizardStore } from '../../src/renderer/store/wizardStore.js';
import { useAnalysisStore } from '../../src/renderer/store/analysisStore.js';
import { useExtractionStore } from '../../src/renderer/store/extractionStore.js';
import { MARKET_CONFIGS } from '../../src/renderer/config/markets.js';
import i18n from '../../src/renderer/i18n/index.js';
import type { ProductCard } from '../../src/shared/types/index.js';
import type { MarketContext } from '../../src/shared/types/index.js';

// ---------------------------------------------------------------------------
// Shared fixtures (P8: derived from config, not hardcoded)
// ---------------------------------------------------------------------------
const firstMarket = Object.values(MARKET_CONFIGS)[0];
const mockMarket: MarketContext = {
  marketId: firstMarket.marketId,
  language: firstMarket.language,
  currency: firstMarket.currency,
  platforms: firstMarket.platforms as string[],
};

const CARD: ProductCard = {
  cardId: 'c1',
  rank: 1,
  productName: 'Test Product',
  market: mockMarket,
  category: 'Test Category',
  overallScore: 85,
  estimatedCogs: { value: 10, currency: 'USD' },
  estimatedSellPrice: { value: 30, currency: 'USD' },
  estimatedMargin: 0.55,
  primaryPlatform: mockMarket.platforms[0] ?? 'amazon-us',
  supplierSearchTerms: ['test'],
  riskFlags: [
    { code: 'LOW_RISK', severity: 'low', description: 'Safe entry' },
  ],
  agentJustification: 'Strong demand with healthy margins.',
  rawScores: { demand: 80, competition: 30, margin: 75, trend: 65, beginner: 90 },
  marketInsight: 'Growing market segment.',
};

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------
function mockElectronAPI(overrides?: { getResultsReject?: boolean }) {
  const api = {
    extraction: {
      openView: vi.fn().mockResolvedValue(undefined),
      closeView: vi.fn().mockResolvedValue(undefined),
      hideView: vi.fn().mockResolvedValue(undefined),
      runExtraction: vi.fn().mockResolvedValue(null),
      getCurrentUrl: vi.fn().mockResolvedValue(''),
      getOpenPlatforms: vi.fn().mockResolvedValue([]),
      hideAll: vi.fn().mockResolvedValue(undefined),
    },
    payload: { build: vi.fn().mockResolvedValue({}) },
    analysis: {
      submit: vi.fn().mockResolvedValue({ analysisId: 'a1', status: 'complete' }),
      getStatus: vi.fn().mockResolvedValue({ analysisId: 'a1', status: 'complete' }),
      getResults: overrides?.getResultsReject
        ? vi.fn().mockRejectedValue(new Error('Network error'))
        : vi.fn().mockResolvedValue({ analysisId: 'a1', results: [CARD] }),
    },
  };
  window.electronAPI = api as unknown as typeof window.electronAPI;
  return api;
}

function wrap(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  mockElectronAPI();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ===========================================================================
// 1. MarketSelection — ARIA & keyboard
// ===========================================================================
describe('A11y: MarketSelection', () => {
  beforeEach(() => {
    useWizardStore.setState({ currentStep: 1, market: null, preferences: {}, hasProfile: false });
  });

  it('renders an h1 heading for the page title', () => {
    wrap(<MarketSelection />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeTruthy();
  });

  it('market buttons are natively focusable <button> elements', () => {
    wrap(<MarketSelection />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(Object.keys(MARKET_CONFIGS).length);
    for (const btn of buttons) {
      // Native <button> is focusable by default; tabIndex should not be -1
      expect(btn.tabIndex).not.toBe(-1);
    }
  });

  it('selected market button has distinguishable visual state (border color differs)', () => {
    useWizardStore.setState({ market: mockMarket });
    wrap(<MarketSelection />);
    const buttons = screen.getAllByRole('button');
    const selectedBtn = buttons.find((b) => {
      const border = (b as HTMLElement).style.borderColor || (b as HTMLElement).style.border;
      return border?.includes('#0066cc') || border?.includes('rgb(0, 102, 204)');
    });
    // At least one button should carry the selected style
    expect(selectedBtn).toBeTruthy();
  });
});

// ===========================================================================
// 2. WizardLayout — progress bar & navigation
// ===========================================================================
describe('A11y: WizardLayout', () => {
  const noop = () => {};

  beforeEach(() => {
    useWizardStore.setState({ currentStep: 3 });
  });

  it('progress bar has role="progressbar" with aria-valuenow/min/max', () => {
    wrap(
      <WizardLayout onNext={noop} onBack={noop}>
        <p>Step content</p>
      </WizardLayout>,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toBeTruthy();
    expect(bar.getAttribute('aria-valuenow')).toBeTruthy();
    expect(bar.getAttribute('aria-valuemin')).toBeTruthy();
    expect(bar.getAttribute('aria-valuemax')).toBeTruthy();
    expect(bar.getAttribute('aria-label')).toBeTruthy();
  });

  it('Back button is disabled when on first wizard step', () => {
    useWizardStore.setState({ currentStep: 2 });
    wrap(
      <WizardLayout onNext={noop} onBack={noop}>
        <p>Content</p>
      </WizardLayout>,
    );
    const buttons = screen.getAllByRole('button');
    const backBtn = buttons[0]; // Back is first
    expect(backBtn).toHaveProperty('disabled', true);
  });

  it('Next button is disabled when canNext=false', () => {
    wrap(
      <WizardLayout onNext={noop} onBack={noop} canNext={false}>
        <p>Content</p>
      </WizardLayout>,
    );
    const buttons = screen.getAllByRole('button');
    const nextBtn = buttons[buttons.length - 1];
    expect(nextBtn).toHaveProperty('disabled', true);
  });

  it('all navigation buttons are natively focusable', () => {
    wrap(
      <WizardLayout onNext={noop} onBack={noop} showSkip onSkip={noop}>
        <p>Content</p>
      </WizardLayout>,
    );
    const buttons = screen.getAllByRole('button');
    // Should have Back, Skip, Next
    expect(buttons.length).toBe(3);
    for (const btn of buttons) {
      expect(btn.tagName).toBe('BUTTON');
    }
  });
});

// ===========================================================================
// 3. DataSourceConnect — form labels & buttons
// ===========================================================================
describe('A11y: DataSourceConnect', () => {
  beforeEach(() => {
    useWizardStore.setState({
      currentStep: 2,
      market: mockMarket,
      preferences: {},
      hasProfile: false,
    });
  });

  it('page has an h2 heading', () => {
    wrap(<DataSourceConnect />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toBeTruthy();
  });

  it('keyword input has an associated label with htmlFor', () => {
    wrap(<DataSourceConnect />);
    const input = screen.getByLabelText(/keyword/i);
    expect(input).toBeTruthy();
    expect(input.tagName).toBe('INPUT');
  });

  it('Connect buttons have descriptive aria-labels', () => {
    wrap(<DataSourceConnect />);
    const connectButtons = screen.getAllByRole('button').filter(
      (b) => b.getAttribute('aria-label')?.toLowerCase().includes('connect'),
    );
    // One connect button per platform
    expect(connectButtons.length).toBeGreaterThanOrEqual(1);
    for (const btn of connectButtons) {
      const label = btn.getAttribute('aria-label') ?? '';
      // Label should include the platform name, not just "Connect"
      expect(label.length).toBeGreaterThan('Connect'.length);
    }
  });

  it('Back button has aria-label', () => {
    wrap(<DataSourceConnect />);
    const backBtn = screen.getByLabelText(/back/i);
    expect(backBtn).toBeTruthy();
    expect(backBtn.tagName).toBe('BUTTON');
  });

  it('Start Extraction button is disabled when no platform is connected', () => {
    wrap(<DataSourceConnect />);
    const startBtn = screen.getByLabelText(/start extraction/i);
    expect(startBtn).toHaveProperty('disabled', true);
  });
});

// ===========================================================================
// 4. ProgressScreen — live regions & status
// ===========================================================================
describe('A11y: ProgressScreen', () => {
  beforeEach(() => {
    useWizardStore.setState({
      currentStep: 2,
      market: mockMarket,
      preferences: {},
      hasProfile: false,
    });
    useExtractionStore.setState({
      tasks: (mockMarket.platforms as string[]).map((id) => ({
        platformId: id,
        status: 'queued' as const,
        label: `Scanning ${id}…`,
        doneLabel: '',
        productCount: 0,
        enabled: true,
        requiresAuth: false,
        progressEvents: [],
      })),
      cancelled: false,
      allDone: false,
      canAnalyze: false,
      activeTab: null,
    });
  });

  it('has an aria-live="polite" region for dynamic status updates', () => {
    wrap(<ProgressScreen />);
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
  });

  it('has an aria-label on the main container', () => {
    wrap(<ProgressScreen />);
    const container = document.querySelector('[aria-label]');
    expect(container).toBeTruthy();
  });

  it('Cancel and Analyze Now buttons are natively focusable', () => {
    wrap(<ProgressScreen />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    for (const btn of buttons) {
      expect(btn.tagName).toBe('BUTTON');
    }
  });

  it('Analyze Now button is disabled when extraction is not done', () => {
    wrap(<ProgressScreen />);
    const buttons = screen.getAllByRole('button');
    const analyzeBtn = buttons.find((b) => b.textContent?.toLowerCase().includes('analyze'));
    expect(analyzeBtn).toBeTruthy();
    expect(analyzeBtn!.hasAttribute('disabled')).toBe(true);
  });
});

// ===========================================================================
// 5. ResultsDashboard — headings, form controls, interactive cards
// ===========================================================================
describe('A11y: ResultsDashboard', () => {
  beforeEach(() => {
    useAnalysisStore.setState({
      analysisId: 'a1',
      status: 'complete',
      categories: [{ name: 'Test Category', products: [CARD as any] }],
      results: [CARD],
      error: null,
      selectedCardId: null,
    });
    useWizardStore.setState({ currentStep: 4 });
  });

  it('renders an h1 heading for Results', async () => {
    wrap(<ResultsDashboard />);
    // Wait for async load to resolve
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading).toBeTruthy();
  });

  it('sort and filter selects have aria-labels', async () => {
    wrap(<ResultsDashboard />);
    await screen.findByRole('heading', { level: 1 });
    const sortSelect = screen.getByLabelText(i18n.t('results.sortBy'));
    const filterSelect = screen.getByLabelText(i18n.t('results.filterRisk'));
    expect(sortSelect.tagName).toBe('SELECT');
    expect(filterSelect.tagName).toBe('SELECT');
  });

  it('product cards have role="button" and tabIndex for keyboard access', async () => {
    wrap(<ResultsDashboard />);
    await screen.findByRole('heading', { level: 1 });
    // Product card divs use role="button" + data-testid; native <button>s don't need tabindex
    const cardEl = screen.getByTestId(`product-card-${CARD.cardId}`);
    expect(cardEl.getAttribute('role')).toBe('button');
    expect(cardEl.getAttribute('tabindex')).toBe('0');
  });

  it('product cards have descriptive aria-labels including name and score', async () => {
    wrap(<ResultsDashboard />);
    await screen.findByRole('heading', { level: 1 });
    const card = screen.getByLabelText(new RegExp(`${CARD.productName}.*${CARD.overallScore}`));
    expect(card).toBeTruthy();
  });

  it('export CSV button has aria-label', async () => {
    wrap(<ResultsDashboard />);
    await screen.findByRole('heading', { level: 1 });
    const exportBtn = screen.getByLabelText(i18n.t('results.exportCSV'));
    expect(exportBtn.tagName).toBe('BUTTON');
  });

  it('save button has aria-label including product name', async () => {
    wrap(<ResultsDashboard />);
    await screen.findByRole('heading', { level: 1 });
    const saveBtn = screen.getByLabelText(new RegExp(`^Save ${CARD.productName}$`));
    expect(saveBtn).toBeTruthy();
    expect(saveBtn.tagName).toBe('BUTTON');
  });

  it('error state shows role="alert"', async () => {
    mockElectronAPI({ getResultsReject: true });
    useAnalysisStore.setState({ analysisId: 'a1', status: 'complete', results: [], error: null, selectedCardId: null });
    wrap(<ResultsDashboard />);
    const alert = await screen.findByRole('alert');
    expect(alert).toBeTruthy();
    expect(alert.textContent).toContain('Network error');
  });

  it('retry button has aria-label in error state', async () => {
    mockElectronAPI({ getResultsReject: true });
    useAnalysisStore.setState({ analysisId: 'a1', status: 'complete', results: [], error: null, selectedCardId: null });
    wrap(<ResultsDashboard />);
    const retryBtn = await screen.findByLabelText(i18n.t('analysis.retry'));
    expect(retryBtn.tagName).toBe('BUTTON');
  });
});

// ===========================================================================
// 6. ProductDetail — tabs, headings, form inputs, back nav
// ===========================================================================
describe('A11y: ProductDetail', () => {
  beforeEach(() => {
    useAnalysisStore.setState({
      analysisId: 'a1',
      status: 'complete',
      results: [CARD],
      error: null,
      selectedCardId: 'c1',
    });
    useWizardStore.setState({ currentStep: 11 });
  });

  it('has a tablist with role="tablist" and aria-label', () => {
    wrap(<ProductDetail />);
    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeTruthy();
    expect(tablist.getAttribute('aria-label')).toBeTruthy();
  });

  it('each tab has role="tab" and aria-selected attribute', () => {
    wrap(<ProductDetail />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(5); // overview, trends, competition, margin, reasoning
    for (const tab of tabs) {
      expect(tab.getAttribute('aria-selected')).toBeTruthy();
    }
    // Exactly one should be selected
    const selected = tabs.filter((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected.length).toBe(1);
  });

  it('tab content is wrapped in role="tabpanel"', () => {
    wrap(<ProductDetail />);
    const panel = screen.getByRole('tabpanel');
    expect(panel).toBeTruthy();
  });

  it('tabs have descriptive aria-labels', () => {
    wrap(<ProductDetail />);
    const tabs = screen.getAllByRole('tab');
    for (const tab of tabs) {
      const ariaLabel = tab.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel!.length).toBeGreaterThan(0);
    }
  });

  it('back button has aria-label', () => {
    wrap(<ProductDetail />);
    const backBtns = screen.getAllByLabelText(i18n.t('detail.back'));
    expect(backBtns.length).toBeGreaterThanOrEqual(1);
    expect(backBtns[0].tagName).toBe('BUTTON');
  });

  it('renders an h1 heading with the product name', () => {
    wrap(<ProductDetail />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.textContent).toContain(CARD.productName);
  });

  it('margin calculator inputs have aria-labels', () => {
    wrap(<ProductDetail />);
    // Click on margin tab
    const marginTab = screen.getAllByRole('tab').find(
      (t) => t.getAttribute('aria-label') === i18n.t('detail.tabMargin'),
    );
    expect(marginTab).toBeTruthy();
    fireEvent.click(marginTab!);

    const costInput = screen.getByLabelText(i18n.t('detail.costInput'));
    const priceInput = screen.getByLabelText(i18n.t('detail.priceInput'));
    const feesInput = screen.getByLabelText(i18n.t('detail.feesInput'));
    expect(costInput.tagName).toBe('INPUT');
    expect(priceInput.tagName).toBe('INPUT');
    expect(feesInput.tagName).toBe('INPUT');
  });

  it('not-found state renders a back button with aria-label', () => {
    useAnalysisStore.setState({ selectedCardId: 'nonexistent' });
    wrap(<ProductDetail />);
    const backBtn = screen.getByLabelText(i18n.t('detail.back'));
    expect(backBtn.tagName).toBe('BUTTON');
  });
});

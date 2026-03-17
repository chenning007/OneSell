/**
 * Issue #86 — ProductDetail tests
 *
 * AC coverage:
 *   1. ✅ Tabs: Overview, Trends, Competition, Margin Calculator
 *   2. ✅ Overview shows reasons, risk flags, category
 *   3. ✅ Trends shows bar chart
 *   4. ✅ Competition shows score and explanation
 *   5. ✅ Margin Calculator: interactive inputs with live calculation
 *   6. ✅ Back button navigates to dashboard (Step 10)
 *   7. ✅ Not-found state when card missing
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { I18nextProvider } from 'react-i18next';

import ProductDetail from '../../src/renderer/modules/results/ProductDetail.js';
import { useAnalysisStore } from '../../src/renderer/store/analysisStore.js';
import { useWizardStore } from '../../src/renderer/store/wizardStore.js';
import i18n from '../../src/renderer/i18n/index.js';
import type { ProductCard } from '../../src/shared/types/index.js';
import type { MarketContext } from '../../src/shared/types/index.js';

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------
const mockMarket: MarketContext = { marketId: 'us', language: 'en', currency: 'USD', platforms: [] };

const CARD: ProductCard = {
  cardId: 'c1',
  rank: 1,
  productName: 'Super Widget',
  market: mockMarket,
  category: 'Electronics',
  overallScore: 88,
  estimatedCogs: { value: 10, currency: 'USD' },
  estimatedSellPrice: { value: 30, currency: 'USD' },
  estimatedMargin: 0.55,
  primaryPlatform: 'amazon-us',
  supplierSearchTerms: ['widget', 'gadget'],
  riskFlags: [
    { code: 'BEGINNER', severity: 'low', description: 'Low barrier to entry' },
    { code: 'HIGH_COMP', severity: 'medium', description: 'Moderate competition in niche' },
  ],
  agentJustification: 'This product has strong demand and healthy margins.',
  rawScores: { demand: 82, competition: 35, margin: 78, trend: 70, beginner: 90 },
  marketInsight: 'Growing demand in US electronics market.',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockElectronAPI() {
  window.electronAPI = {
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
      getResults: vi.fn().mockResolvedValue({ analysisId: 'a1', results: [] }),
    },
  } as unknown as typeof window.electronAPI;
}

function resetStores(): void {
  useAnalysisStore.setState({
    analysisId: 'a1', status: 'complete',
    results: [CARD], error: null, selectedCardId: 'c1',
  });
  useWizardStore.setState({ currentStep: 11 });
}

function renderComponent() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ProductDetail />
    </I18nextProvider>,
  );
}

beforeEach(() => {
  mockElectronAPI();
  resetStores();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// AC 1 — Tabs exist
// ---------------------------------------------------------------------------
describe('AC 1 — Tabs', () => {
  it('renders Overview, Trends, Competition, Margin Calculator tabs', () => {
    renderComponent();
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Trends' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Competition' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Margin Calculator' })).toBeTruthy();
  });

  it('Overview tab is selected by default', () => {
    renderComponent();
    const tab = screen.getByRole('tab', { name: 'Overview' });
    expect(tab.getAttribute('aria-selected')).toBe('true');
  });
});

// ---------------------------------------------------------------------------
// AC 2 — Overview panel
// ---------------------------------------------------------------------------
describe('AC 2 — Overview panel', () => {
  it('shows agent justification', () => {
    renderComponent();
    expect(screen.getByText('This product has strong demand and healthy margins.')).toBeTruthy();
  });

  it('shows risk flags with severity', () => {
    renderComponent();
    expect(screen.getByText(/LOW.*Low barrier to entry/i)).toBeTruthy();
    expect(screen.getByText(/MEDIUM.*Moderate competition in niche/i)).toBeTruthy();
  });

  it('shows category', () => {
    renderComponent();
    // Category appears in both header and overview
    expect(screen.getAllByText('Electronics').length).toBeGreaterThan(0);
  });

  it('shows market insight', () => {
    renderComponent();
    expect(screen.getByText('Growing demand in US electronics market.')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC 3 — Trends panel
// ---------------------------------------------------------------------------
describe('AC 3 — Trends panel', () => {
  it('shows trend bars when Trends tab clicked', () => {
    renderComponent();
    fireEvent.click(screen.getByRole('tab', { name: 'Trends' }));

    expect(screen.getByText(/70\/100/)).toBeTruthy();
    expect(screen.getByText('Demand')).toBeTruthy();
    expect(screen.getByText('Beginner')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC 4 — Competition panel
// ---------------------------------------------------------------------------
describe('AC 4 — Competition panel', () => {
  it('shows competition score and explanation', () => {
    renderComponent();
    fireEvent.click(screen.getByRole('tab', { name: 'Competition' }));

    expect(screen.getByText(/35\/100/)).toBeTruthy();
    expect(screen.getByText(/moderate competition/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC 5 — Margin Calculator
// ---------------------------------------------------------------------------
describe('AC 5 — Margin Calculator', () => {
  it('shows interactive inputs with default values from card', () => {
    renderComponent();
    fireEvent.click(screen.getByRole('tab', { name: 'Margin Calculator' }));

    const costInput = screen.getByLabelText('Cost (COGS)') as HTMLInputElement;
    const priceInput = screen.getByLabelText('Sell price') as HTMLInputElement;
    const feesInput = screen.getByLabelText('Platform fees (%)') as HTMLInputElement;

    expect(Number(costInput.value)).toBe(10);
    expect(Number(priceInput.value)).toBe(30);
    expect(Number(feesInput.value)).toBe(15);
  });

  it('calculates margin live when inputs change', () => {
    renderComponent();
    fireEvent.click(screen.getByRole('tab', { name: 'Margin Calculator' }));

    // Default: price=30, cost=10, fees=15%
    // margin = (30 - 10 - 4.5) / 30 = 51.7%
    const marginEl = screen.getByTestId('calculated-margin');
    expect(marginEl.textContent).toBe('51.7%');

    // Change cost to 20
    const costInput = screen.getByLabelText('Cost (COGS)') as HTMLInputElement;
    fireEvent.change(costInput, { target: { value: '20' } });

    // margin = (30 - 20 - 4.5) / 30 = 18.3%
    expect(screen.getByTestId('calculated-margin').textContent).toBe('18.3%');
  });
});

// ---------------------------------------------------------------------------
// AC 6 — Back button
// ---------------------------------------------------------------------------
describe('AC 6 — Back button', () => {
  it('navigates to Step 10 and clears selectedCardId', () => {
    renderComponent();
    fireEvent.click(screen.getByLabelText('Back to results'));

    expect(useWizardStore.getState().currentStep).toBe(10);
    expect(useAnalysisStore.getState().selectedCardId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC 7 — Not-found state
// ---------------------------------------------------------------------------
describe('AC 7 — Product not found', () => {
  it('shows not-found message when selectedCardId has no match', () => {
    useAnalysisStore.setState({ selectedCardId: 'nonexistent' });
    renderComponent();
    expect(screen.getByText('Product not found.')).toBeTruthy();
  });
});

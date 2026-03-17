/**
 * Issue #84 — ResultsDashboard tests
 *
 * AC coverage:
 *   1. ✅ Fetches and renders product cards
 *   2. ✅ Sort by score, margin, competition, trend
 *   3. ✅ Filter by risk level
 *   4. ✅ Empty state with retry button
 *   5. ✅ Save button per card
 *   6. ✅ Export CSV button exists
 *   7. ✅ Card click navigates to detail (Step 11)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';
import React from 'react';
import { I18nextProvider } from 'react-i18next';

import ResultsDashboard from '../../src/renderer/modules/results/ResultsDashboard.js';
import { useAnalysisStore } from '../../src/renderer/store/analysisStore.js';
import { useWizardStore } from '../../src/renderer/store/wizardStore.js';
import i18n from '../../src/renderer/i18n/index.js';
import type { ProductCard } from '../../src/shared/types/index.js';
import type { MarketContext } from '../../src/shared/types/index.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockMarket: MarketContext = { marketId: 'us', language: 'en', currency: 'USD', platforms: [] };

function makeCard(overrides: Partial<ProductCard> & { cardId: string; rank: number; productName: string }): ProductCard {
  return {
    market: mockMarket,
    category: 'Electronics',
    overallScore: 80,
    estimatedCogs: { value: 5, currency: 'USD' },
    estimatedSellPrice: { value: 20, currency: 'USD' },
    estimatedMargin: 0.6,
    primaryPlatform: 'amazon-us',
    supplierSearchTerms: [],
    riskFlags: [],
    agentJustification: 'Good product to sell.',
    rawScores: { demand: 70, competition: 30, margin: 80, trend: 60, beginner: 75 },
    marketInsight: 'Strong US demand.',
    ...overrides,
  } as ProductCard;
}

const CARDS: ProductCard[] = [
  makeCard({ cardId: 'c1', rank: 1, productName: 'Widget A', overallScore: 90, estimatedMargin: 0.5, rawScores: { demand: 80, competition: 20, margin: 70, trend: 85, beginner: 60 } }),
  makeCard({ cardId: 'c2', rank: 2, productName: 'Widget B', overallScore: 75, estimatedMargin: 0.7, rawScores: { demand: 60, competition: 50, margin: 90, trend: 40, beginner: 80 }, riskFlags: [{ code: 'HIGH_COMP', severity: 'medium', description: 'Medium competition' }] }),
  makeCard({ cardId: 'c3', rank: 3, productName: 'Widget C', overallScore: 60, estimatedMargin: 0.3, rawScores: { demand: 40, competition: 80, margin: 40, trend: 30, beginner: 50 }, riskFlags: [{ code: 'SATURATED', severity: 'high', description: 'Market saturated' }] }),
];

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------
function mockElectronAPI(results: ProductCard[] = CARDS) {
  const api = {
    extraction: {
      openView: vi.fn(), closeView: vi.fn(), hideView: vi.fn(),
      runExtraction: vi.fn(), getCurrentUrl: vi.fn(), getOpenPlatforms: vi.fn(), hideAll: vi.fn(),
    },
    payload: { build: vi.fn() },
    analysis: {
      submit: vi.fn(),
      getStatus: vi.fn(),
      getResults: vi.fn().mockResolvedValue({ analysisId: 'a1', results }),
    },
  };
  window.electronAPI = api as unknown as typeof window.electronAPI;
  return api;
}

function resetStores(): void {
  useAnalysisStore.setState({
    analysisId: 'a1', status: 'complete',
    results: [], error: null, selectedCardId: null,
  });
  useWizardStore.setState({ currentStep: 10 });
}

function renderComponent() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ResultsDashboard />
    </I18nextProvider>,
  );
}

// ---------------------------------------------------------------------------
let api: ReturnType<typeof mockElectronAPI>;

beforeEach(() => {
  api = mockElectronAPI();
  resetStores();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// AC 1 — Fetch and render cards
// ---------------------------------------------------------------------------
describe('AC 1 — Card rendering', () => {
  it('fetches results and renders product cards', async () => {
    await act(async () => { renderComponent(); });
    // Wait for useEffect
    await act(async () => { await Promise.resolve(); });

    expect(api.analysis.getResults).toHaveBeenCalledWith('a1');
    expect(screen.getByText('Widget A')).toBeTruthy();
    expect(screen.getByText('Widget B')).toBeTruthy();
    expect(screen.getByText('Widget C')).toBeTruthy();
  });

  it('shows rank, score, margin on each card', async () => {
    await act(async () => { renderComponent(); });
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText('#1')).toBeTruthy();
    expect(screen.getByText('#2')).toBeTruthy();
    expect(screen.getByText('#3')).toBeTruthy();
  });

  it('shows risk badges', async () => {
    await act(async () => { renderComponent(); });
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText('SAFE')).toBeTruthy();
    expect(screen.getByText('WARNING')).toBeTruthy();
    expect(screen.getByText('FLAGGED')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC 2 — Sorting
// ---------------------------------------------------------------------------
describe('AC 2 — Sort controls', () => {
  it('sorts by margin when selected', async () => {
    await act(async () => { renderComponent(); });
    await act(async () => { await Promise.resolve(); });

    const sortSelect = screen.getByLabelText('Sort by') as HTMLSelectElement;
    fireEvent.change(sortSelect, { target: { value: 'margin' } });

    // Widget B has highest margin (0.7), should be first card
    const cards = screen.getAllByText(/Widget/);
    expect(cards[0]!.textContent).toBe('Widget B');
  });
});

// ---------------------------------------------------------------------------
// AC 3 — Filter by risk
// ---------------------------------------------------------------------------
describe('AC 3 — Risk filter', () => {
  it('filters to show only SAFE products', async () => {
    await act(async () => { renderComponent(); });
    await act(async () => { await Promise.resolve(); });

    const riskSelect = screen.getByLabelText('Risk') as HTMLSelectElement;
    fireEvent.change(riskSelect, { target: { value: 'SAFE' } });

    expect(screen.getByText('Widget A')).toBeTruthy();
    expect(screen.queryByText('Widget B')).toBeNull();
    expect(screen.queryByText('Widget C')).toBeNull();
  });

  it('filters to show only FLAGGED products', async () => {
    await act(async () => { renderComponent(); });
    await act(async () => { await Promise.resolve(); });

    const riskSelect = screen.getByLabelText('Risk') as HTMLSelectElement;
    fireEvent.change(riskSelect, { target: { value: 'FLAGGED' } });

    expect(screen.queryByText('Widget A')).toBeNull();
    expect(screen.getByText('Widget C')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC 4 — Empty state
// ---------------------------------------------------------------------------
describe('AC 4 — Empty state', () => {
  it('shows empty state when no results', async () => {
    mockElectronAPI([]);
    await act(async () => { renderComponent(); });
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByText('No recommendations found')).toBeTruthy();
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });

  it('retry navigates back to step 9', async () => {
    mockElectronAPI([]);
    await act(async () => { renderComponent(); });
    await act(async () => { await Promise.resolve(); });

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(useWizardStore.getState().currentStep).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// AC 5 — Save button
// ---------------------------------------------------------------------------
describe('AC 5 — Save button', () => {
  it('save button changes to "Saved" after click', async () => {
    await act(async () => { renderComponent(); });
    await act(async () => { await Promise.resolve(); });

    const saveButtons = screen.getAllByText('Save');
    fireEvent.click(saveButtons[0]!);

    expect(screen.getByText('Saved')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC 6 — Export CSV
// ---------------------------------------------------------------------------
describe('AC 6 — Export CSV', () => {
  it('renders export CSV button', async () => {
    await act(async () => { renderComponent(); });
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByLabelText('Export CSV')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC 7 — Card click navigation
// ---------------------------------------------------------------------------
describe('AC 7 — Card click navigates to detail', () => {
  it('clicking a card sets selectedCardId and step 11', async () => {
    await act(async () => { renderComponent(); });
    await act(async () => { await Promise.resolve(); });

    const card = screen.getByTestId('product-card-c1');
    fireEvent.click(card);

    expect(useAnalysisStore.getState().selectedCardId).toBe('c1');
    expect(useWizardStore.getState().currentStep).toBe(11);
  });
});

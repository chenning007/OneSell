/**
 * Wave 4 unit tests — E-07, E-11, E-03, E-15, R-05, R-07, R-09, R-03, R-11, A-07, W-09.
 *
 * Tests all new components and modifications from Wave 4.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

import TaskPipelineRow from '../../src/renderer/modules/extraction/TaskPipelineRow.js';
import PlatformTabContent from '../../src/renderer/modules/extraction/PlatformTabContent.js';
import ExtractionDashboard from '../../src/renderer/modules/extraction/ExtractionDashboard.js';
import AutoTransitionBanner from '../../src/renderer/modules/extraction/AutoTransitionBanner.js';
import CategoryGroup from '../../src/renderer/modules/results/CategoryGroup.js';
import CandidateRow from '../../src/renderer/modules/results/CandidateRow.js';
import CandidateDetail from '../../src/renderer/modules/results/CandidateDetail.js';
import ResultsDashboardV2 from '../../src/renderer/modules/results/ResultsDashboardV2.js';
import MarketSelection from '../../src/renderer/modules/wizard/MarketSelection.js';

import { useExtractionStore } from '../../src/renderer/store/extractionStore.js';
import { useWizardStore } from '../../src/renderer/store/wizardStore.js';
import { useAnalysisStore } from '../../src/renderer/store/analysisStore.js';
import type { PipelineTask } from '../../src/renderer/store/extractionStore.js';
import type { ProductCandidate, CandidateCategory } from '../../src/shared/types/index.js';

// ── Test data factories ─────────────────────────────────────────────

function makeTask(overrides: Partial<PipelineTask> = {}): PipelineTask {
  return {
    platformId: overrides.platformId ?? 'amazon-us',
    status: overrides.status ?? 'queued',
    label: overrides.label ?? 'Scanning amazon-us…',
    doneLabel: overrides.doneLabel ?? 'Scanned hot sellers',
    productCount: overrides.productCount ?? 0,
    enabled: overrides.enabled ?? true,
    requiresAuth: overrides.requiresAuth ?? false,
    progressEvents: overrides.progressEvents ?? [],
  };
}

function makeCandidate(overrides: Partial<ProductCandidate> = {}): ProductCandidate {
  return {
    productName: overrides.productName ?? 'Test Product',
    market: overrides.market ?? { marketId: 'us', language: 'en-US', currency: 'USD', platforms: ['amazon-us'] },
    category: overrides.category ?? 'electronics',
    overallScore: overrides.overallScore ?? 82,
    estimatedCogs: overrides.estimatedCogs ?? { value: 5, currency: 'USD' },
    estimatedSellPrice: overrides.estimatedSellPrice ?? { value: 20, currency: 'USD' },
    estimatedMargin: overrides.estimatedMargin ?? 0.75,
    primaryPlatform: overrides.primaryPlatform ?? 'amazon-us',
    supplierSearchTerms: overrides.supplierSearchTerms ?? ['test'],
    riskFlags: overrides.riskFlags ?? [],
    agentJustification: overrides.agentJustification ?? 'Test justification',
    rawScores: overrides.rawScores ?? { demand: 80, competition: 60, margin: 90, trend: 75, beginner: 70 },
    cardId: overrides.cardId ?? 'card-1',
    rank: overrides.rank ?? 1,
    marketInsight: overrides.marketInsight ?? 'Growing market',
    oneLineReason: overrides.oneLineReason ?? 'High demand, low competition',
    whyBullets: overrides.whyBullets ?? ['Strong demand signal', 'Low competition', 'Good margins'],
    sourcePlatforms: overrides.sourcePlatforms ?? [{ platformId: 'amazon-us', dataPoints: ['BSR #342'] }],
  };
}

function makeCategory(overrides: Partial<CandidateCategory> = {}): CandidateCategory {
  return {
    name: overrides.name ?? 'Trending Home & Kitchen',
    products: overrides.products ?? [makeCandidate(), makeCandidate({ cardId: 'card-2', productName: 'Product B' })],
  };
}

// ── Store reset ─────────────────────────────────────────────────────

beforeEach(() => {
  useExtractionStore.setState({
    tasks: [],
    activeTab: null,
    canAnalyze: false,
    allDone: false,
    cancelled: false,
  });
  useWizardStore.setState({
    currentStep: 1,
    market: null,
    preferences: {},
    hasProfile: false,
  });
  useAnalysisStore.setState({
    analysisId: null,
    status: 'idle',
    categories: [],
    results: [],
    error: null,
    selectedCardId: null,
  });

  // Mock window.electronAPI for components that call IPC
  window.electronAPI = {
    extraction: {
      openView: vi.fn().mockResolvedValue(undefined),
      closeView: vi.fn().mockResolvedValue(undefined),
      hideView: vi.fn().mockResolvedValue(undefined),
      runExtraction: vi.fn().mockResolvedValue(null),
      getCurrentUrl: vi.fn().mockResolvedValue(''),
      getOpenPlatforms: vi.fn().mockResolvedValue([]),
      hideAll: vi.fn().mockResolvedValue(undefined),
      startPipeline: vi.fn().mockResolvedValue({ ok: true, marketId: 'us' }),
      togglePlatform: vi.fn().mockResolvedValue({ ok: true, platformId: 'amazon-us', enabled: false }),
    },
    payload: { build: vi.fn().mockResolvedValue({}) },
    analysis: {
      submit: vi.fn().mockResolvedValue({ analysisId: 'a1', status: 'complete' }),
      getStatus: vi.fn().mockResolvedValue({ analysisId: 'a1', status: 'complete' }),
      getResults: vi.fn().mockResolvedValue({ analysisId: 'a1', results: [] }),
    },
    store: {
      getProfile: vi.fn().mockResolvedValue(null),
      setProfile: vi.fn().mockResolvedValue({ ok: true }),
      clearProfile: vi.fn().mockResolvedValue({ ok: true }),
      getPreferences: vi.fn().mockResolvedValue({}),
      setPreferences: vi.fn().mockResolvedValue({ ok: true }),
      getHistory: vi.fn().mockResolvedValue([]),
      addHistory: vi.fn().mockResolvedValue({ ok: true }),
    },
    saveApiKey: vi.fn().mockResolvedValue({ ok: true }),
    hasApiKey: vi.fn().mockResolvedValue(true),
    clearApiKey: vi.fn().mockResolvedValue({ ok: true }),
    agent: {
      runAnalysis: vi.fn().mockResolvedValue({ ok: true, marketId: 'us', status: 'complete' }),
    },
    preferences: {
      getDefaults: vi.fn().mockResolvedValue({
        budget: { min: 50, max: 500, currency: 'USD' },
        riskTolerance: 'medium',
        sellerExperience: 'none',
        productType: 'physical',
        fulfillmentTime: 'medium',
        platforms: ['amazon-us'],
      }),
    },
  } as unknown as typeof window.electronAPI;

  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ═══════════════════════════════════════════════════════════════════
// E-07 (#243) — TaskPipelineRow
// ═══════════════════════════════════════════════════════════════════

describe('TaskPipelineRow (E-07)', () => {
  // AC-1: Row renders platform name + text
  it('renders platform name and label text', () => {
    const task = makeTask({ platformId: 'amazon-us', label: 'Will scan hot sellers' });
    render(<TaskPipelineRow task={task} />);

    expect(screen.getByTestId('pipeline-row-amazon-us')).toBeTruthy();
    expect(screen.getByText('amazon-us')).toBeTruthy();
    expect(screen.getByText('Will scan hot sellers')).toBeTruthy();
  });

  // AC-2: Toggle switch on right
  it('renders toggle switch', () => {
    const task = makeTask();
    render(<TaskPipelineRow task={task} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  // AC-3: Toggle dispatches IPC
  it('toggle dispatches window.electronAPI.extraction.togglePlatform', () => {
    const task = makeTask({ platformId: 'ebay-us' });
    render(<TaskPipelineRow task={task} />);

    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);

    expect(window.electronAPI.extraction.togglePlatform).toHaveBeenCalledWith({
      platformId: 'ebay-us',
      enabled: false,
    });
  });

  // AC-4: Disabled shows grey "Disabled by you"
  it('disabled row shows grey "Disabled by you"', () => {
    const task = makeTask({ enabled: false, status: 'disabled' });
    render(<TaskPipelineRow task={task} />);

    expect(screen.getByText('Disabled by you')).toBeTruthy();
  });

  it('renders status icon', () => {
    const task = makeTask({ status: 'done' });
    render(<TaskPipelineRow task={task} />);
    expect(screen.getByTestId('status-icon-amazon-us').textContent).toContain('✓');
  });

  it('shows done label with product count when done', () => {
    const task = makeTask({ status: 'done', doneLabel: 'Scanned trends', productCount: 42 });
    render(<TaskPipelineRow task={task} />);
    expect(screen.getByText('Scanned trends · 42 products')).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// E-11 (#247) — PlatformTabContent
// ═══════════════════════════════════════════════════════════════════

describe('PlatformTabContent (E-11)', () => {
  // AC-1: needs-login shows banner
  it('shows login banner for needs-login status', () => {
    const task = makeTask({ status: 'needs-login', platformId: 'taobao' });
    render(<PlatformTabContent task={task} />);
    expect(screen.getByTestId('tab-content-needs-login')).toBeTruthy();
    expect(screen.getByText('Please log in to taobao')).toBeTruthy();
  });

  // AC-2: queued shows waiting
  it('shows waiting message for queued status', () => {
    const task = makeTask({ status: 'queued' });
    render(<PlatformTabContent task={task} />);
    expect(screen.getByTestId('tab-content-queued')).toBeTruthy();
    expect(screen.getByText('Waiting in queue...')).toBeTruthy();
  });

  // AC-3: active shows extracting
  it('shows extracting message for active status', () => {
    const task = makeTask({ status: 'active' });
    render(<PlatformTabContent task={task} />);
    expect(screen.getByTestId('tab-content-active')).toBeTruthy();
    expect(screen.getByText('Extracting data...')).toBeTruthy();
  });

  // AC-4: done shows summary
  it('shows summary card with product count for done status', () => {
    const task = makeTask({ status: 'done', productCount: 15 });
    render(<PlatformTabContent task={task} />);
    expect(screen.getByTestId('tab-content-done')).toBeTruthy();
    expect(screen.getByText('15 products found')).toBeTruthy();
  });

  // AC-5: skipped shows message
  it('shows skipped message', () => {
    const task = makeTask({ status: 'skipped' });
    render(<PlatformTabContent task={task} />);
    expect(screen.getByTestId('tab-content-skipped')).toBeTruthy();
    expect(screen.getByText('Skipped')).toBeTruthy();
  });

  it('shows error message for error status', () => {
    const task = makeTask({ status: 'error', platformId: 'ebay-us' });
    render(<PlatformTabContent task={task} />);
    expect(screen.getByTestId('tab-content-error')).toBeTruthy();
    expect(screen.getByText('Extraction Failed')).toBeTruthy();
  });

  it('shows disabled message for disabled status', () => {
    const task = makeTask({ status: 'disabled' });
    render(<PlatformTabContent task={task} />);
    expect(screen.getByTestId('tab-content-disabled')).toBeTruthy();
    expect(screen.getByText('Disabled by you')).toBeTruthy();
  });

  it('shows progress events in active log', () => {
    const task = makeTask({
      status: 'active',
      progressEvents: [
        { timestamp: '2026-03-18T10:00:05.000Z', message: 'Fetching listings', field: 'listings' },
      ],
    });
    render(<PlatformTabContent task={task} />);
    expect(screen.getByText('Fetching listings')).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// E-03 (#239) — ExtractionDashboard
// ═══════════════════════════════════════════════════════════════════

describe('ExtractionDashboard (E-03)', () => {
  // AC-1: Header shows market badge
  it('shows market badge in header', () => {
    useWizardStore.setState({ market: { marketId: 'us', language: 'en-US', currency: 'USD', platforms: ['amazon-us'] } });
    render(<ExtractionDashboard />);
    expect(screen.getByTestId('market-badge')).toBeTruthy();
    expect(screen.getByTestId('market-badge').textContent).toContain('US');
  });

  // AC-2: TaskPipeline visible
  it('renders TaskPipeline', () => {
    render(<ExtractionDashboard />);
    expect(screen.getByTestId('task-pipeline')).toBeTruthy();
  });

  // AC-3: PlatformTabPanel below
  it('renders PlatformTabPanel', () => {
    render(<ExtractionDashboard />);
    expect(screen.getByTestId('platform-tab-panel')).toBeTruthy();
  });

  // AC-4: Cancel and Analyze Now in footer
  it('renders Cancel and Analyze Now buttons', () => {
    render(<ExtractionDashboard />);
    expect(screen.getByTestId('cancel-button')).toBeTruthy();
    expect(screen.getByTestId('analyze-now-button')).toBeTruthy();
  });

  // AC-5: Analyze Now disabled until canAnalyze
  it('Analyze Now is disabled when canAnalyze is false', () => {
    useExtractionStore.setState({ canAnalyze: false });
    render(<ExtractionDashboard />);
    const btn = screen.getByTestId('analyze-now-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('Analyze Now is enabled when canAnalyze is true', () => {
    useExtractionStore.setState({ canAnalyze: true });
    render(<ExtractionDashboard />);
    const btn = screen.getByTestId('analyze-now-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  // AC-6: gear icon present
  it('renders gear icon', () => {
    render(<ExtractionDashboard />);
    expect(screen.getByTestId('gear-icon')).toBeTruthy();
  });

  it('Cancel button navigates back to step 1', () => {
    useWizardStore.setState({ currentStep: 2 });
    render(<ExtractionDashboard />);
    fireEvent.click(screen.getByTestId('cancel-button'));
    expect(useWizardStore.getState().currentStep).toBe(1);
  });

  it('Analyze Now navigates to step 3', () => {
    useExtractionStore.setState({ canAnalyze: true });
    useWizardStore.setState({ currentStep: 2 });
    render(<ExtractionDashboard />);
    fireEvent.click(screen.getByTestId('analyze-now-button'));
    expect(useWizardStore.getState().currentStep).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════
// R-11 (#263) — AutoTransitionBanner
// ═══════════════════════════════════════════════════════════════════

describe('AutoTransitionBanner (R-11)', () => {
  // AC-1: Countdown banner on allDone
  it('shows countdown text', () => {
    const onSkip = vi.fn();
    render(<AutoTransitionBanner onSkip={onSkip} />);
    expect(screen.getByTestId('auto-transition-banner')).toBeTruthy();
    expect(screen.getByTestId('countdown-text').textContent).toContain('3');
  });

  // AC-2: Counts 3→2→1
  it('counts down from 3 to 1', () => {
    const onSkip = vi.fn();
    render(<AutoTransitionBanner onSkip={onSkip} />);

    expect(screen.getByTestId('countdown-text').textContent).toContain('3');

    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByTestId('countdown-text').textContent).toContain('2');

    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByTestId('countdown-text').textContent).toContain('1');
  });

  // AC-3: Auto-navigates to step 3
  it('auto-navigates to step 3 after countdown', () => {
    useWizardStore.setState({ currentStep: 2 });
    const onSkip = vi.fn();
    render(<AutoTransitionBanner onSkip={onSkip} />);

    act(() => { vi.advanceTimersByTime(3000); });
    expect(useWizardStore.getState().currentStep).toBe(3);
  });

  // AC-4: Early click skips
  it('skip button calls onSkip immediately', () => {
    const onSkip = vi.fn();
    render(<AutoTransitionBanner onSkip={onSkip} />);
    fireEvent.click(screen.getByTestId('skip-countdown-button'));
    expect(onSkip).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// R-05 (#257) — CategoryGroup
// ═══════════════════════════════════════════════════════════════════

describe('CategoryGroup (R-05)', () => {
  // AC-1: Header shows name + count
  it('shows category name and product count', () => {
    const category = makeCategory();
    render(<CategoryGroup category={category} />);
    expect(screen.getByText('Trending Home & Kitchen')).toBeTruthy();
    expect(screen.getByText('2 products')).toBeTruthy();
  });

  // AC-2: Click toggles
  it('click header collapses and expands', () => {
    const category = makeCategory();
    render(<CategoryGroup category={category} />);

    // Initially expanded — products visible
    expect(screen.getByTestId(`category-products-${category.name}`)).toBeTruthy();

    // Click to collapse
    fireEvent.click(screen.getByTestId(`category-header-${category.name}`));
    expect(screen.queryByTestId(`category-products-${category.name}`)).toBeNull();

    // Click to expand again
    fireEvent.click(screen.getByTestId(`category-header-${category.name}`));
    expect(screen.getByTestId(`category-products-${category.name}`)).toBeTruthy();
  });

  // AC-3: Expanded by default
  it('is expanded by default', () => {
    const category = makeCategory();
    render(<CategoryGroup category={category} />);
    expect(screen.getByTestId(`category-products-${category.name}`)).toBeTruthy();
  });

  // AC-4: CandidateRow per candidate
  it('renders CandidateRow for each product', () => {
    const category = makeCategory();
    render(<CategoryGroup category={category} />);
    expect(screen.getByTestId('candidate-row-card-1')).toBeTruthy();
    expect(screen.getByTestId('candidate-row-card-2')).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// R-07 (#259) — CandidateRow
// ═══════════════════════════════════════════════════════════════════

describe('CandidateRow (R-07)', () => {
  // AC-1: Shows rank, name, score, reason
  it('shows rank, product name, score badge, and one-line reason', () => {
    const candidate = makeCandidate({ productName: 'Widget Pro', overallScore: 87, oneLineReason: 'Great potential' });
    render(<CandidateRow candidate={candidate} rank={3} />);

    expect(screen.getByText('#3')).toBeTruthy();
    expect(screen.getByText('Widget Pro')).toBeTruthy();
    expect(screen.getByTestId('score-badge-card-1').textContent).toBe('87');
    expect(screen.getByText('Great potential')).toBeTruthy();
  });

  // AC-2: Click expands detail
  it('click row expands CandidateDetail', () => {
    const candidate = makeCandidate();
    render(<CandidateRow candidate={candidate} rank={1} />);

    // Initially no detail
    expect(screen.queryByTestId('candidate-detail-card-1')).toBeNull();

    // Click the row (not the detail button)
    fireEvent.click(screen.getByTestId('candidate-row-card-1').querySelector('div')!);
    expect(screen.getByTestId('candidate-detail-card-1')).toBeTruthy();
  });

  // AC-3: Detail navigates to step 5
  it('"▸ Detail" button navigates to step 5', () => {
    useWizardStore.setState({ currentStep: 4 });
    const candidate = makeCandidate({ cardId: 'card-nav' });
    render(<CandidateRow candidate={candidate} rank={1} />);

    fireEvent.click(screen.getByTestId('detail-button-card-nav'));
    expect(useWizardStore.getState().currentStep).toBe(5);
    expect(useAnalysisStore.getState().selectedCardId).toBe('card-nav');
  });
});

// ═══════════════════════════════════════════════════════════════════
// R-09 (#261) — CandidateDetail
// ═══════════════════════════════════════════════════════════════════

describe('CandidateDetail (R-09)', () => {
  // AC-1: Why bullets
  it('shows whyBullets', () => {
    const candidate = makeCandidate({ whyBullets: ['Bullet A', 'Bullet B', 'Bullet C'] });
    render(<CandidateDetail candidate={candidate} />);
    expect(screen.getByTestId('why-bullets')).toBeTruthy();
    expect(screen.getByText('Bullet A')).toBeTruthy();
    expect(screen.getByText('Bullet B')).toBeTruthy();
    expect(screen.getByText('Bullet C')).toBeTruthy();
  });

  // AC-2: Score bars
  it('shows score breakdown bars', () => {
    const candidate = makeCandidate();
    render(<CandidateDetail candidate={candidate} />);
    expect(screen.getByTestId('score-breakdown')).toBeTruthy();
    expect(screen.getByText('Demand')).toBeTruthy();
    expect(screen.getByText('Competition')).toBeTruthy();
    expect(screen.getByText('Margin')).toBeTruthy();
    expect(screen.getByText('Trend')).toBeTruthy();
  });

  // AC-3: Source platforms
  it('shows source platforms with data points', () => {
    const candidate = makeCandidate({
      sourcePlatforms: [{ platformId: 'amazon-us', dataPoints: ['BSR #342 in Kitchen'] }],
    });
    render(<CandidateDetail candidate={candidate} />);
    expect(screen.getByTestId('source-platforms')).toBeTruthy();
    expect(screen.getByText('amazon-us')).toBeTruthy();
    expect(screen.getByText('BSR #342 in Kitchen')).toBeTruthy();
  });

  // AC-4: Risk flags
  it('shows risk flags', () => {
    const candidate = makeCandidate({
      riskFlags: [{ code: 'HIGH_COMP', severity: 'medium', description: 'High competition in subcategory' }],
    });
    render(<CandidateDetail candidate={candidate} />);
    expect(screen.getByTestId('risk-flags')).toBeTruthy();
    expect(screen.getByText('High competition in subcategory')).toBeTruthy();
  });

  // AC-5: Next steps
  it('shows suggested next steps', () => {
    const candidate = makeCandidate();
    render(<CandidateDetail candidate={candidate} />);
    expect(screen.getByTestId('next-steps')).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// R-03 (#255) — ResultsDashboardV2
// ═══════════════════════════════════════════════════════════════════

describe('ResultsDashboardV2 (R-03)', () => {
  // AC-1: Renders CategoryGroup per category
  it('renders category groups', () => {
    const categories = [makeCategory({ name: 'Cat A' }), makeCategory({ name: 'Cat B' })];
    useAnalysisStore.setState({ categories, status: 'complete' });
    render(<ResultsDashboardV2 />);
    expect(screen.getByTestId('category-group-Cat A')).toBeTruthy();
    expect(screen.getByTestId('category-group-Cat B')).toBeTruthy();
  });

  // AC-2: Actions bar with buttons
  it('renders actions bar with Re-analyze, Export, and Save buttons', () => {
    render(<ResultsDashboardV2 />);
    expect(screen.getByTestId('re-analyze-button')).toBeTruthy();
    expect(screen.getByTestId('export-csv-button')).toBeTruthy();
    expect(screen.getByTestId('save-to-list-button')).toBeTruthy();
  });

  // AC-3: Re-analyze triggers IPC
  it('Re-analyze button triggers IPC', () => {
    useWizardStore.setState({ market: { marketId: 'us', language: 'en-US', currency: 'USD', platforms: ['amazon-us'] } });
    render(<ResultsDashboardV2 />);
    fireEvent.click(screen.getByTestId('re-analyze-button'));
    expect(window.electronAPI.agent.runAnalysis).toHaveBeenCalledWith('us');
  });

  // AC-5: gear icon present
  it('renders gear icon', () => {
    render(<ResultsDashboardV2 />);
    expect(screen.getByTestId('gear-icon')).toBeTruthy();
  });

  it('shows empty state when no categories', () => {
    render(<ResultsDashboardV2 />);
    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText('No results yet')).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// W-09 (#235) — MarketSelection v2
// ═══════════════════════════════════════════════════════════════════

describe('MarketSelection v2 (W-09)', () => {
  // AC-1: Selecting market sets wizardStore.market
  it('selecting market sets wizardStore.market', () => {
    render(<MarketSelection />);
    fireEvent.click(screen.getByText('🇺🇸'));
    const state = useWizardStore.getState();
    expect(state.market).toBeTruthy();
    expect(state.market!.marketId).toBe('us');
  });

  // AC-2: Sets step to 2
  it('selecting market sets step to 2', () => {
    render(<MarketSelection />);
    fireEvent.click(screen.getByText('🇺🇸'));
    expect(useWizardStore.getState().currentStep).toBe(2);
  });

  // AC-3: Platforms from MARKET_CONFIGS
  it('market context includes platforms from MARKET_CONFIGS', () => {
    render(<MarketSelection />);
    fireEvent.click(screen.getByText('🇺🇸'));
    const market = useWizardStore.getState().market;
    expect(market!.platforms).toContain('amazon-us');
    expect(market!.platforms).toContain('google-trends');
  });
});

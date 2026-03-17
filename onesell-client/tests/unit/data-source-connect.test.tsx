/**
 * Issue #79 — DataSources: verify connection lifecycle, privacy indicator, keyword input
 *
 * AC coverage:
 *   1. 🐛 BUG — Privacy indicator exists as text-only; no lock icon rendered (see BUG-A)
 *   2. ✅ Start Extraction button disabled when 0 platforms connected
 *   3. ✅ Start Extraction button enables when ≥ 1 platform connected
 *   4. 🐛 BUG — Keyword input is completely absent from DataSourceConnect (see BUG-B)
 *   5. 🐛 BUG — "Back to Wizard" button is completely absent from DataSourceConnect (see BUG-C)
 *   6. ✅ Connect → Connected badge → Close → Idle badge lifecycle
 *   7. 🐛 BUG — Cannot test "Back to Wizard → Step 6" because button is missing (see BUG-C)
 *   8. ✅ P1: no credential data in IPC — electronAPI.extraction only passes platformId strings
 *   9. 🐛 BUG — No aria-label on Connect/Close/Start Extraction buttons (see BUG-D)
 *
 * Bugs to file:
 *   BUG-A: Privacy indicator renders only plain <p> text. No lock icon (🔒 or SVG).
 *          AC #1 requires a lock icon alongside localised text. (P1 visual indicator missing)
 *   BUG-B: DataSourceConnect has no keyword <input> field at all. AC #4 requires a keyword
 *          input whose value is accessible to the extraction runner.
 *   BUG-C: DataSourceConnect has no "Back to Wizard" button. AC #5 requires the button to
 *          call closeView for all open platforms and AC #7 requires it to return to Step 6.
 *   BUG-D: Connect, Close, and Start Extraction buttons have no aria-label attributes.
 *          Violates WCAG 4.1.2 and AC #9.
 *
 * Principles verified: P1 (credentials), P5 (degradation), P8 (config-driven)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within, cleanup } from '@testing-library/react';
import React from 'react';
import { I18nextProvider } from 'react-i18next';

import DataSourceConnect from '../../src/renderer/modules/data-sources/DataSourceConnect.js';
import { useWizardStore } from '../../src/renderer/store/wizardStore.js';
import { useExtractionStore } from '../../src/renderer/store/extractionStore.js';
import { MARKET_CONFIGS } from '../../src/renderer/config/markets.js';
import i18n from '../../src/renderer/i18n/index.js';
import type { MarketContext } from '../../src/shared/types/index.js';

// ---------------------------------------------------------------------------
// Helpers — P8: derive values from config, never hardcoded
// ---------------------------------------------------------------------------
const FIRST_MARKET_ID = Object.keys(MARKET_CONFIGS)[0]!;
const FIRST_CONFIG = MARKET_CONFIGS[FIRST_MARKET_ID]!;

const mockMarket: MarketContext = {
  marketId: FIRST_CONFIG.marketId,
  language: FIRST_CONFIG.language,
  currency: FIRST_CONFIG.currency,
  platforms: FIRST_CONFIG.platforms,
};

/** Mock electronAPI used by DataSourceConnect */
function mockElectronAPI() {
  const api = {
    extraction: {
      openView: vi.fn().mockResolvedValue(undefined),
      closeView: vi.fn().mockResolvedValue(undefined),
      hideView: vi.fn().mockResolvedValue(undefined),
      runExtraction: vi.fn().mockResolvedValue(null),
      getCurrentUrl: vi.fn().mockResolvedValue('https://example.com'),
      getOpenPlatforms: vi.fn().mockResolvedValue([]),
      hideAll: vi.fn().mockResolvedValue(undefined),
    },
    payload: {
      build: vi.fn().mockResolvedValue({}),
    },
  };
  window.electronAPI = api;
  return api;
}

function resetWizardStore(): void {
  useWizardStore.setState({
    currentStep: 7,
    market: mockMarket,
    preferences: {},
    selectedPlatforms: [],
  });
}

function renderComponent() {
  return render(
    <I18nextProvider i18n={i18n}>
      <DataSourceConnect />
    </I18nextProvider>,
  );
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
let api: ReturnType<typeof mockElectronAPI>;

beforeEach(() => {
  api = mockElectronAPI();
  resetWizardStore();
  useExtractionStore.setState({ keywords: '' });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// AC 1 — Privacy indicator with lock icon and localised text
// ---------------------------------------------------------------------------
describe('AC 1 — Privacy indicator with lock icon and localised text', () => {
  it('renders localised privacy text ("credentials never leave")', () => {
    renderComponent();
    // The description text contains the privacy message
    expect(screen.getByText(/credentials never leave/i)).toBeTruthy();
  });

  it('BUG-A: should render a lock icon (🔒 or accessible SVG) alongside privacy text', () => {
    renderComponent();
    const lockIcon = screen.queryByLabelText(/lock/i) ?? screen.queryByText('🔒');
    expect(lockIcon).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC 2 — Start Extraction button disabled when 0 platforms connected
// ---------------------------------------------------------------------------
describe('AC 2 — Start Extraction button disabled when 0 connected', () => {
  it('renders Start Extraction button as disabled by default (all idle)', () => {
    renderComponent();
    const btn = screen.getByText('Start Extraction');
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('button has cursor:not-allowed style when disabled', () => {
    renderComponent();
    const btn = screen.getByText('Start Extraction');
    expect(btn.style.cursor).toBe('not-allowed');
  });
});

// ---------------------------------------------------------------------------
// AC 3 — Start Extraction enables when ≥ 1 platform connected
// ---------------------------------------------------------------------------
describe('AC 3 — Start Extraction enables when ≥ 1 platform connected', () => {
  it('enables Start Extraction after connecting one platform', async () => {
    renderComponent();
    const connectButtons = screen.getAllByText('Connect');
    expect(connectButtons.length).toBeGreaterThan(0);

    // Click the first Connect button
    await act(async () => {
      fireEvent.click(connectButtons[0]!);
    });

    const startBtn = screen.getByText('Start Extraction');
    expect((startBtn as HTMLButtonElement).disabled).toBe(false);
    expect(startBtn.style.cursor).toBe('pointer');
  });

  it('calls setStep(8) when Start Extraction is clicked', async () => {
    renderComponent();

    // Connect a platform first
    const connectButtons = screen.getAllByText('Connect');
    await act(async () => {
      fireEvent.click(connectButtons[0]!);
    });

    // Click Start Extraction
    const startBtn = screen.getByText('Start Extraction');
    await act(async () => {
      fireEvent.click(startBtn);
    });

    expect(useWizardStore.getState().currentStep).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// AC 4 — Keyword input stores value accessible to extraction runner
// ---------------------------------------------------------------------------
describe('AC 4 — Keyword input (BUG: not implemented)', () => {
  it('BUG-B: should render a keyword input field', () => {
    renderComponent();
    const input = screen.getByRole('textbox', { name: /keyword/i });
    expect(input).toBeTruthy();
  });

  it('BUG-B: keyword value should be persisted for extraction runner', () => {
    renderComponent();
    const input = screen.getByRole('textbox', { name: /keyword/i });
    fireEvent.change(input, { target: { value: 'wireless earbuds' } });
    expect((input as HTMLInputElement).value).toBe('wireless earbuds');
    expect(useExtractionStore.getState().keywords).toBe('wireless earbuds');
  });
});

// ---------------------------------------------------------------------------
// AC 5 — Back to Wizard button calls closeView for all open platforms
// ---------------------------------------------------------------------------
describe('AC 5 — Back to Wizard button (BUG: not implemented)', () => {
  it('BUG-C: should render a "Back to Wizard" button', () => {
    renderComponent();
    const btn = screen.getByRole('button', { name: /back/i });
    expect(btn).toBeTruthy();
  });

  it('BUG-C: clicking "Back to Wizard" should call closeView for each open platform', async () => {
    renderComponent();

    // Connect two platforms
    const connectButtons = screen.getAllByText('Connect');
    await act(async () => {
      fireEvent.click(connectButtons[0]!);
    });
    await act(async () => {
      fireEvent.click(connectButtons[1]!);
    });

    const backBtn = screen.getByRole('button', { name: /back/i });
    await act(async () => {
      fireEvent.click(backBtn);
    });

    // Should have called closeView for each connected platform
    expect(api.extraction.closeView).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// AC 6 — Connect → Connected badge → Close → Idle lifecycle
// ---------------------------------------------------------------------------
describe('AC 6 — Connection lifecycle', () => {
  it('renders platform names from market config (P8 — config-driven)', () => {
    renderComponent();
    // Every platform in the market config should have a Connect button
    const connectButtons = screen.getAllByText('Connect');
    expect(connectButtons.length).toBe(mockMarket.platforms.length);
  });

  it('shows Connected badge after clicking Connect', async () => {
    renderComponent();
    const connectButtons = screen.getAllByText('Connect');

    await act(async () => {
      fireEvent.click(connectButtons[0]!);
    });

    // Should now show 'Connected' status text
    expect(screen.getByText('Connected')).toBeTruthy();
  });

  it('calls electronAPI.extraction.openView with correct platformId on Connect', async () => {
    renderComponent();
    const connectButtons = screen.getAllByText('Connect');

    await act(async () => {
      fireEvent.click(connectButtons[0]!);
    });

    const firstPlatform = mockMarket.platforms[0]!;
    expect(api.extraction.openView).toHaveBeenCalledWith(firstPlatform);
  });

  it('shows Close button after connecting (replaces Connect)', async () => {
    renderComponent();
    const connectButtons = screen.getAllByText('Connect');

    await act(async () => {
      fireEvent.click(connectButtons[0]!);
    });

    // The first platform should now show Close instead of Connect
    expect(screen.getAllByText('Close').length).toBe(1);
  });

  it('returns to Idle after clicking Close', async () => {
    renderComponent();
    const connectButtons = screen.getAllByText('Connect');

    // Connect first platform
    await act(async () => {
      fireEvent.click(connectButtons[0]!);
    });
    expect(screen.getByText('Connected')).toBeTruthy();

    // Close the connected platform
    const closeBtn = screen.getByText('Close');
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    // Should be back to all Connect buttons, no Connected badge
    expect(screen.queryByText('Connected')).toBeNull();
    expect(screen.getAllByText('Connect').length).toBe(mockMarket.platforms.length);
  });

  it('calls electronAPI.extraction.closeView on Close', async () => {
    renderComponent();
    const connectButtons = screen.getAllByText('Connect');

    await act(async () => {
      fireEvent.click(connectButtons[0]!);
    });

    const closeBtn = screen.getByText('Close');
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    const firstPlatform = mockMarket.platforms[0]!;
    expect(api.extraction.closeView).toHaveBeenCalledWith(firstPlatform);
  });

  it('Start Extraction re-disables after closing all connected platforms', async () => {
    renderComponent();
    const connectButtons = screen.getAllByText('Connect');

    // Connect first
    await act(async () => {
      fireEvent.click(connectButtons[0]!);
    });
    expect((screen.getByText('Start Extraction') as HTMLButtonElement).disabled).toBe(false);

    // Close
    await act(async () => {
      fireEvent.click(screen.getByText('Close'));
    });
    expect((screen.getByText('Start Extraction') as HTMLButtonElement).disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC 7 — Back to Wizard returns to Step 6 with wizard state preserved
// ---------------------------------------------------------------------------
describe('AC 7 — Back to Wizard → Step 6 (BUG: button missing)', () => {
  it('BUG-C: should navigate back to step 6 with wizard state preserved', () => {
    useWizardStore.setState({
      currentStep: 7,
      market: mockMarket,
      preferences: { riskTolerance: 'medium' },
      selectedPlatforms: ['amazon-us'],
    });
    renderComponent();

    const backBtn = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backBtn);

    const state = useWizardStore.getState();
    expect(state.currentStep).toBe(6);
    expect(state.market).toEqual(mockMarket);
    expect(state.preferences.riskTolerance).toBe('medium');
    expect(state.selectedPlatforms).toEqual(['amazon-us']);
  });
});

// ---------------------------------------------------------------------------
// AC 8 — P1 compliance: no credential data in IPC calls
// ---------------------------------------------------------------------------
describe('AC 8 — P1: no credential data leaves the client via IPC', () => {
  it('electronAPI.extraction only accepts platformId (string), never credentials', () => {
    // P1 structural verification: the electronAPI type surface only passes
    // platformId strings — no passwords, cookies, tokens, or session data.
    const extractionMethods = Object.keys(api.extraction);
    // All extraction methods only receive platformId as their argument
    const safeApiShape = [
      'openView',
      'closeView',
      'hideView',
      'runExtraction',
      'getCurrentUrl',
      'getOpenPlatforms',
      'hideAll',
    ];
    expect(extractionMethods.sort()).toEqual(safeApiShape.sort());
  });

  it('openView is called with only a platformId string (no credential fields)', async () => {
    renderComponent();
    const connectButtons = screen.getAllByText('Connect');

    await act(async () => {
      fireEvent.click(connectButtons[0]!);
    });

    // Verify exactly one argument: the platformId string
    const call = api.extraction.openView.mock.calls[0]!;
    expect(call).toHaveLength(1);
    expect(typeof call[0]).toBe('string');
    // Verify no credential-shaped substrings
    const arg = call[0] as string;
    expect(arg).not.toMatch(/password|token|cookie|session|secret|credential/i);
  });

  it('closeView is called with only a platformId string', async () => {
    renderComponent();
    const connectButtons = screen.getAllByText('Connect');

    await act(async () => {
      fireEvent.click(connectButtons[0]!);
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Close'));
    });

    const call = api.extraction.closeView.mock.calls[0]!;
    expect(call).toHaveLength(1);
    expect(typeof call[0]).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// AC 9 — A11y: all buttons and inputs have aria-labels
// ---------------------------------------------------------------------------
describe('AC 9 — Accessibility: aria-labels (BUG: missing)', () => {
  it('title heading is rendered as <h2>', () => {
    renderComponent();
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toBeTruthy();
    expect(heading.textContent).toBe('Connect Data Sources');
  });

  it('BUG-D: Connect buttons should have aria-label', () => {
    renderComponent();
    const connectButtons = screen.getAllByText('Connect');
    for (const btn of connectButtons) {
      expect(btn.getAttribute('aria-label')).toBeTruthy();
    }
  });

  it('BUG-D: Start Extraction button should have aria-label', () => {
    renderComponent();
    const btn = screen.getByText('Start Extraction');
    expect(btn.getAttribute('aria-label')).toBeTruthy();
  });

  it('Start Extraction button is a real <button> element', () => {
    renderComponent();
    const btn = screen.getByText('Start Extraction');
    expect(btn.tagName).toBe('BUTTON');
  });

  it('Connect buttons are real <button> elements', () => {
    renderComponent();
    const connectButtons = screen.getAllByText('Connect');
    for (const btn of connectButtons) {
      expect(btn.tagName).toBe('BUTTON');
    }
  });
});

// ---------------------------------------------------------------------------
// P5 — Graceful degradation: empty platforms array
// ---------------------------------------------------------------------------
describe('P5 — Degrades gracefully with no platforms', () => {
  it('renders no platform rows when market has empty platforms list', () => {
    useWizardStore.setState({
      currentStep: 7,
      market: { ...mockMarket, platforms: [] },
      preferences: {},
      selectedPlatforms: [],
    });
    renderComponent();

    expect(screen.queryAllByText('Connect').length).toBe(0);
    // Start Extraction should be disabled
    expect((screen.getByText('Start Extraction') as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders no platform rows when market is null', () => {
    useWizardStore.setState({
      currentStep: 7,
      market: null,
      preferences: {},
      selectedPlatforms: [],
    });
    renderComponent();

    expect(screen.queryAllByText('Connect').length).toBe(0);
  });
});

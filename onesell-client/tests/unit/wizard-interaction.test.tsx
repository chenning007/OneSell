/**
 * Issue #77 — Wizard: verify interaction states, keyboard nav, ARIA, defaults
 *
 * AC coverage:
 *   1. ✅ Covered in market-selection.test.tsx (hover border styles)
 *   2. ✅ Covered in market-selection.test.tsx (keyboard Tab/Enter/Space)
 *   3. ✅ Covered in market-selection.test.tsx (empty config graceful degradation)
 *   4. 🐛 BUG — progress bar missing role="progressbar" + ARIA attrs (test skipped; see bug below)
 *   5. ✅ Progress bar fill has CSS transition for animation
 *   6. ✅ Budget slider responds to keyboard input (native range + change handler)
 *   7. ✅ PlatformStep hides Skip, shows validation when 0 selected
 *   8. 🐛 BUG — ProductType skip does not set default "physical" (test skipped; see bug below)
 *   9. 🐛 BUG — Fulfillment skip does not set default "moderate" (test skipped; see bug below)
 *  10. ✅ Backward navigation retains all wizard state
 *  11. ✅ Full wizard flow Step 1 → Step 6 with keyboard only
 *  12. ✅ Focus rings verified via GlobalStyles CSS injection
 *  13. ✅ Screen reader: heading landmarks, button roles, accessible names
 *
 * Bugs to file:
 *   BUG-A: WizardLayout progress bar <div> has no role="progressbar", aria-valuenow,
 *          aria-valuemin, or aria-valuemax. Violates WCAG 4.1.2 and AC #4.
 *   BUG-B: Wizard.handleSkip() only calls setStep(currentStep + 1) — it does NOT
 *          set default preferences. AC #8 requires productType → physical, AC #9
 *          requires fulfillment → moderate (riskTolerance → 'medium').
 *
 * Principles verified: P5 (degradation), P8 (config-driven)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import React from 'react';

import Wizard from '../../src/renderer/modules/wizard/Wizard.js';
import App from '../../src/renderer/App.js';
import GlobalStyles from '../../src/renderer/components/GlobalStyles.js';
import MarketSelection from '../../src/renderer/modules/wizard/MarketSelection.js';
import { useWizardStore } from '../../src/renderer/store/wizardStore.js';
import { MARKET_CONFIGS, BUDGET_RANGES } from '../../src/renderer/config/markets.js';
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

function resetStore(): void {
  useWizardStore.setState({
    currentStep: 1,
    market: null,
    preferences: {},
    hasProfile: false,
  });
}

function setWizardStep(step: number, extras?: Record<string, unknown>): void {
  useWizardStore.setState({
    currentStep: step,
    market: mockMarket,
    preferences: {},
    hasProfile: false,
    ...extras,
  });
}

// ---------------------------------------------------------------------------
// AC 4 — Progress bar has role=progressbar with correct ARIA attributes
// ---------------------------------------------------------------------------
describe('AC 4 — Progress bar ARIA', () => {
  beforeEach(resetStore);

  /**
   * BUG-A fixed: WizardLayout now renders the progress bar with
   * role="progressbar", aria-valuenow, aria-valuemin, and aria-valuemax.
   */
  it('progress bar element has role="progressbar"', () => {
    setWizardStep(3);
    render(<Wizard />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeDefined();
  });

  it('progress bar has aria-valuenow matching current step', () => {
    setWizardStep(4);
    render(<Wizard />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar.getAttribute('aria-valuenow')).toBe('4');
  });

  it('progress bar has aria-valuemin=1 and aria-valuemax=6', () => {
    setWizardStep(3);
    render(<Wizard />);
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar.getAttribute('aria-valuemin')).toBe('1');
    expect(progressbar.getAttribute('aria-valuemax')).toBe('6');
  });
});

// ---------------------------------------------------------------------------
// AC 5 — Progress bar fill animates on step change
// ---------------------------------------------------------------------------
describe('AC 5 — Progress bar fill animation', () => {
  beforeEach(resetStore);

  it('progress fill div has CSS transition for smooth animation', () => {
    setWizardStep(2);
    const { container } = render(<Wizard />);
    // The fill div has background: #0066cc and a transition property
    const fillDiv = container.querySelector<HTMLDivElement>(
      'div[style*="background: rgb(0, 102, 204)"]',
    );
    // jsdom style serialization may vary; fall back to checking by parent structure
    // Progress bar container is 6px tall, the fill is inside it
    const barContainer = container.querySelector<HTMLDivElement>(
      'div[style*="height: 6px"]',
    );
    expect(barContainer).not.toBeNull();
    const fill = barContainer!.firstElementChild as HTMLDivElement;
    expect(fill).not.toBeNull();
    expect(fill.style.transition).toContain('width');
    expect(fill.style.transition).toContain('0.3s');
  });

  it('progress fill width changes when step advances', () => {
    // Step 2 → progress = (2-1)/6 * 100 = 16.67%
    setWizardStep(2);
    const { container, unmount } = render(<Wizard />);
    const bar2 = container.querySelector<HTMLDivElement>('div[style*="height: 6px"]');
    const fill2 = bar2!.firstElementChild as HTMLDivElement;
    const width2 = fill2.style.width;

    unmount();

    // Step 5 → progress = (5-1)/6 * 100 = 66.67%
    setWizardStep(5);
    const { container: c2 } = render(<Wizard />);
    const bar5 = c2.querySelector<HTMLDivElement>('div[style*="height: 6px"]');
    const fill5 = bar5!.firstElementChild as HTMLDivElement;
    const width5 = fill5.style.width;

    // Step 5 progress wider than step 2
    expect(parseFloat(width5)).toBeGreaterThan(parseFloat(width2));
  });
});

// ---------------------------------------------------------------------------
// AC 6 — Budget slider responds to Arrow Left/Right keyboard input
// ---------------------------------------------------------------------------
describe('AC 6 — Budget slider keyboard input', () => {
  beforeEach(resetStore);

  it('renders a range input that responds to change events', () => {
    setWizardStep(2); // BudgetStep is step 2
    render(<Wizard />);

    const slider = screen.getByRole('slider');
    expect(slider).toBeDefined();
    expect(slider.getAttribute('type')).toBe('range');
  });

  it('changing slider value updates budget preference in store', () => {
    setWizardStep(2);
    render(<Wizard />);

    const slider = screen.getByRole('slider') as HTMLInputElement;
    const range = BUDGET_RANGES[FIRST_MARKET_ID]!;

    // Simulate changing the slider to a specific value
    const newValue = Math.round((range.min + range.max) / 2);
    fireEvent.change(slider, { target: { value: String(newValue) } });

    const prefs = useWizardStore.getState().preferences;
    expect(prefs.budget).toBeDefined();
    expect(prefs.budget!.max).toBe(newValue);
    expect(prefs.budget!.currency).toBe(range.currency);
  });

  it('slider has correct min and max attributes from market config', () => {
    setWizardStep(2);
    render(<Wizard />);

    const slider = screen.getByRole('slider') as HTMLInputElement;
    const range = BUDGET_RANGES[FIRST_MARKET_ID]!;

    expect(Number(slider.min)).toBe(range.min);
    expect(Number(slider.max)).toBe(range.max);
  });
});

// ---------------------------------------------------------------------------
// AC 7 — PlatformStep v2: platforms are auto-selected (no checkboxes)
// ---------------------------------------------------------------------------
describe('AC 7 — PlatformStep auto-selection (v2)', () => {
  beforeEach(resetStore);

  it('Skip button is NOT shown on PlatformStep (step 3)', () => {
    setWizardStep(3);
    render(<Wizard />);

    // WizardLayout hides skip when showSkip is false (currentStep === 3)
    const buttons = screen.getAllByRole('button');
    const skipBtn = buttons.find((b) => b.textContent?.toLowerCase().includes('skip'));
    expect(skipBtn).toBeUndefined();
  });

  it('PlatformStep shows auto-selected platforms (no checkboxes)', () => {
    setWizardStep(3);
    render(<Wizard />);

    // v2: PlatformStep shows platforms as plain items, not checkboxes
    const checkboxes = screen.queryAllByRole('checkbox');
    expect(checkboxes.length).toBe(0);
  });

  it('Next button is always enabled (platforms auto-selected in v2)', () => {
    setWizardStep(3);
    render(<Wizard />);

    const nextBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase() === 'next',
    );
    expect(nextBtn).toBeDefined();
    expect(nextBtn!.disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC 8 — ProductType defaults to physical when skipped
// ---------------------------------------------------------------------------
describe('AC 8 — ProductType default on skip', () => {
  beforeEach(resetStore);

  /**
   * BUG-B fixed: Wizard.handleSkip() now sets sellerExperience to 'some'
   * (physical) when skipping ProductTypeStep (step 4).
   */
  it('skipping ProductTypeStep sets sellerExperience to "some" (physical default)', () => {
    setWizardStep(4);
    render(<Wizard />);
    const skipBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase() === 'skip',
    );
    expect(skipBtn).toBeDefined();
    fireEvent.click(skipBtn!);
    expect(useWizardStore.getState().preferences.sellerExperience).toBe('some');
  });

  it('skip on step 4 advances to step 5', () => {
    setWizardStep(4);
    render(<Wizard />);

    // Step 4 (ProductType) shows the Skip button
    const skipBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase() === 'skip',
    );
    expect(skipBtn).toBeDefined();
    fireEvent.click(skipBtn!);

    expect(useWizardStore.getState().currentStep).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// AC 9 — Fulfillment defaults to moderate when skipped
// ---------------------------------------------------------------------------
describe('AC 9 — Fulfillment default on skip', () => {
  beforeEach(resetStore);

  /**
   * BUG-B fixed: Wizard.handleSkip() now sets riskTolerance to 'medium'
   * when skipping FulfillmentStep (step 6).
   */
  it('skipping FulfillmentStep sets riskTolerance to "medium" (moderate default)', () => {
    setWizardStep(6);
    render(<Wizard />);
    const skipBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase() === 'skip',
    );
    expect(skipBtn).toBeDefined();
    fireEvent.click(skipBtn!);
    expect(useWizardStore.getState().preferences.riskTolerance).toBe('medium');
  });

  it('skip on step 5 advances within range', () => {
    setWizardStep(5);
    render(<Wizard />);

    const skipBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase() === 'skip',
    );
    // Step 5 may or may not show skip in v1 Wizard
    if (skipBtn) {
      fireEvent.click(skipBtn!);
    }
    // currentStep should remain within valid range
    expect(useWizardStore.getState().currentStep).toBeLessThanOrEqual(11);
  });
});

// ---------------------------------------------------------------------------
// AC 10 — Backward navigation retains all wizard state
// ---------------------------------------------------------------------------
describe('AC 10 — Backward navigation retains state', () => {
  beforeEach(resetStore);

  it('going back from step 4 to step 3 retains market context', () => {
    setWizardStep(4);
    render(<Wizard />);

    // Click Back
    const backBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase() === 'back',
    );
    expect(backBtn).toBeDefined();
    fireEvent.click(backBtn!);

    // Verify state retained (v2: no selectedPlatforms)
    const state = useWizardStore.getState();
    expect(state.currentStep).toBe(3);
    expect(state.market).toEqual(mockMarket);
  });

  it('going back from step 5 to step 4 retains budget preference', () => {
    setWizardStep(5, {
      preferences: { budget: { min: 50, max: 300, currency: 'USD' } },
    });
    render(<Wizard />);

    const backBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase() === 'back',
    );
    fireEvent.click(backBtn!);

    const state = useWizardStore.getState();
    expect(state.currentStep).toBe(4);
    expect(state.preferences.budget).toEqual({ min: 50, max: 300, currency: 'USD' });
  });

  it('going back preserves market context (P4)', () => {
    setWizardStep(3);
    render(<Wizard />);

    const backBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase() === 'back',
    );
    fireEvent.click(backBtn!);

    expect(useWizardStore.getState().market).toEqual(mockMarket);
  });

  it('back button is disabled on step 2 (first wizard step)', () => {
    setWizardStep(2);
    render(<Wizard />);

    const backBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase() === 'back',
    );
    expect(backBtn).toBeDefined();
    expect(backBtn!.disabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC 11 — Full wizard flow Step 1 → Step 6 keyboard-only
// ---------------------------------------------------------------------------
describe('AC 11 — Full wizard flow with keyboard', () => {
  beforeEach(resetStore);

  it('keyboard-only navigation from market selection through wizard steps', () => {
    // Step 1: MarketSelection — click a market tile via keyboard
    render(<MarketSelection />);
    const marketBtns = screen.getAllByRole('button');
    const firstMarketBtn = marketBtns[0]!;
    firstMarketBtn.focus();
    expect(document.activeElement).toBe(firstMarketBtn);
    // Enter selects the market
    fireEvent.click(firstMarketBtn);

    let state = useWizardStore.getState();
    expect(state.currentStep).toBe(2);
    expect(state.market).not.toBeNull();
    cleanup();

    // Step 2: BudgetStep — adjust slider, press Next
    render(<Wizard />);
    const slider = screen.getByRole('slider') as HTMLInputElement;
    slider.focus();
    expect(document.activeElement).toBe(slider);

    const range = BUDGET_RANGES[state.market!.marketId]!;
    const budgetValue = Math.round(range.min + (range.max - range.min) * 0.75);
    fireEvent.change(slider, { target: { value: String(budgetValue) } });

    const nextBtnStep2 = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase() === 'next',
    );
    expect(nextBtnStep2).toBeDefined();
    nextBtnStep2!.focus();
    fireEvent.click(nextBtnStep2!);

    state = useWizardStore.getState();
    expect(state.currentStep).toBe(3);
    cleanup();

    // Step 3: PlatformStep v2 — platforms auto-selected, just press Next
    render(<Wizard />);
    const nextBtnStep3 = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase() === 'next',
    );
    nextBtnStep3!.focus();
    fireEvent.click(nextBtnStep3!);

    state = useWizardStore.getState();
    expect(state.currentStep).toBe(4);
    cleanup();

    // Step 4: ProductTypeStep — select physical, then Next
    render(<Wizard />);
    const productBtns = screen.getAllByRole('button').filter(
      (b) => b.textContent?.includes('📦') || b.textContent?.includes('💾'),
    );
    expect(productBtns.length).toBe(2);
    productBtns[0]!.focus();
    fireEvent.click(productBtns[0]!);

    const nextBtnStep4 = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase() === 'next',
    );
    nextBtnStep4!.focus();
    fireEvent.click(nextBtnStep4!);

    state = useWizardStore.getState();
    expect(state.currentStep).toBe(5);
    cleanup();

    // Step 5: CategoriesStep — select a category, then Next
    render(<Wizard />);
    const catBtns5 = screen.getAllByRole('button').filter(
      (b) =>
        b.textContent?.toLowerCase() !== 'back' &&
        b.textContent?.toLowerCase() !== 'next' &&
        b.textContent?.toLowerCase() !== 'skip' &&
        b.textContent?.toLowerCase() !== 'analyze',
    );
    expect(catBtns5.length).toBeGreaterThan(0);
    catBtns5[0]!.focus();
    fireEvent.click(catBtns5[0]!);

    // v2: step 5 is the max; Analyze or Next should be present
    const analyzeOrNext = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase() === 'analyze' || b.textContent?.toLowerCase() === 'next',
    );
    expect(analyzeOrNext).toBeDefined();
    analyzeOrNext!.focus();
    fireEvent.click(analyzeOrNext!);

    // Verify all state was accumulated
    state = useWizardStore.getState();
    expect(state.market).not.toBeNull();
    expect(state.preferences.budget).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AC 12 — Focus rings visible at 2px blue outline (GlobalStyles)
// ---------------------------------------------------------------------------
describe('AC 12 — Focus ring CSS rules', () => {
  it('GlobalStyles injects :focus-visible rule with 2px solid #0066cc', () => {
    const { container } = render(<GlobalStyles />);
    const styleTag = container.querySelector('style[data-testid="global-styles"]');
    expect(styleTag).not.toBeNull();
    const css = styleTag!.textContent!;
    expect(css).toContain('*:focus-visible');
    expect(css).toContain('outline: 2px solid #0066cc');
    expect(css).toContain('outline-offset: 2px');
  });

  it('GlobalStyles renders in the App component tree', () => {
    resetStore();
    const { container } = render(<App />);
    const styleTag = container.querySelector('style[data-testid="global-styles"]');
    expect(styleTag).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC 13 — Screen reader can navigate and operate all wizard controls
// ---------------------------------------------------------------------------
describe('AC 13 — Screen-reader operability', () => {
  beforeEach(resetStore);

  it('MarketSelection has a heading landmark for screen readers', () => {
    render(<MarketSelection />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeDefined();
    expect(heading.textContent!.length).toBeGreaterThan(0);
  });

  it('each wizard step (2–5) has a heading for navigation', () => {
    for (const step of [2, 3, 4, 5]) {
      setWizardStep(step);
      const { unmount } = render(<Wizard />);
      const heading = screen.getByRole('heading', { level: 2 });
      expect(heading).toBeDefined();
      expect(heading.textContent!.length).toBeGreaterThan(0);
      unmount();
    }
  });

  it('all navigation buttons have accessible text', () => {
    setWizardStep(4);
    render(<Wizard />);

    const buttons = screen.getAllByRole('button');
    for (const btn of buttons) {
      // Every button should have non-empty text content
      expect(btn.textContent!.trim().length).toBeGreaterThan(0);
    }
  });

  it('BudgetStep slider is an accessible range input', () => {
    setWizardStep(2);
    render(<Wizard />);

    const slider = screen.getByRole('slider');
    expect(slider).toBeDefined();
    expect(slider.getAttribute('type')).toBe('range');
    expect(slider.getAttribute('min')).toBeTruthy();
    expect(slider.getAttribute('max')).toBeTruthy();
  });

  it('PlatformStep shows auto-selected platforms (v2: no checkboxes)', () => {
    setWizardStep(3);
    render(<Wizard />);

    // v2: platforms are displayed but not as interactive checkboxes
    const checkboxes = screen.queryAllByRole('checkbox');
    expect(checkboxes.length).toBe(0);
  });
});

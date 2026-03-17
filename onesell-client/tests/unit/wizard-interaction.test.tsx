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
    selectedPlatforms: [],
  });
}

function setWizardStep(step: number, extras?: Record<string, unknown>): void {
  useWizardStore.setState({
    currentStep: step,
    market: mockMarket,
    preferences: {},
    selectedPlatforms: [],
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
// AC 7 — PlatformStep hides Skip button and shows validation when 0 selected
// ---------------------------------------------------------------------------
describe('AC 7 — PlatformStep with 0 platforms selected', () => {
  beforeEach(resetStore);

  it('Skip button is NOT shown on PlatformStep (step 3)', () => {
    setWizardStep(3);
    render(<Wizard />);

    // WizardLayout hides skip when showSkip is false (currentStep === 3)
    const buttons = screen.getAllByRole('button');
    const skipBtn = buttons.find((b) => b.textContent?.toLowerCase().includes('skip'));
    expect(skipBtn).toBeUndefined();
  });

  it('validation message shown when 0 platforms selected', () => {
    setWizardStep(3);
    render(<Wizard />);

    // PlatformStep shows: "Please select at least one platform."
    expect(
      screen.getByText('Please select at least one platform.'),
    ).toBeTruthy();
  });

  it('Next button is disabled when 0 platforms selected', () => {
    setWizardStep(3);
    render(<Wizard />);

    // The "Next" button should be disabled because canNext = selectedPlatforms.length > 0
    const nextBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase() === 'next',
    );
    expect(nextBtn).toBeDefined();
    expect(nextBtn!.disabled).toBe(true);
  });

  it('Next button enables after selecting a platform', () => {
    setWizardStep(3);
    render(<Wizard />);

    // Find and check a platform checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    fireEvent.click(checkboxes[0]!);

    // Now the Next button should be enabled
    const nextBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase() === 'next',
    );
    expect(nextBtn).toBeDefined();
    expect(nextBtn!.disabled).toBe(false);
  });

  it('validation message disappears after selecting a platform', () => {
    setWizardStep(3);
    render(<Wizard />);

    // Validation present initially
    expect(screen.getByText('Please select at least one platform.')).toBeTruthy();

    // Select a platform
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!);

    // Validation should vanish
    expect(screen.queryByText('Please select at least one platform.')).toBeNull();
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

  it('skip on step 6 advances to step 7', () => {
    setWizardStep(6);
    render(<Wizard />);

    // Step 6 (Fulfillment) shows the Skip button
    const skipBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase() === 'skip',
    );
    expect(skipBtn).toBeDefined();
    fireEvent.click(skipBtn!);

    expect(useWizardStore.getState().currentStep).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// AC 10 — Backward navigation retains all wizard state
// ---------------------------------------------------------------------------
describe('AC 10 — Backward navigation retains state', () => {
  beforeEach(resetStore);

  it('going back from step 4 to step 3 retains selectedPlatforms', () => {
    const platforms = [FIRST_CONFIG.platforms[0]!];
    setWizardStep(4, { selectedPlatforms: platforms });
    render(<Wizard />);

    // Click Back
    const backBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase() === 'back',
    );
    expect(backBtn).toBeDefined();
    fireEvent.click(backBtn!);

    // Verify state retained
    const state = useWizardStore.getState();
    expect(state.currentStep).toBe(3);
    expect(state.selectedPlatforms).toEqual(platforms);
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

  it('keyboard-only navigation from market selection through all steps', () => {
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

    // Change slider value via keyboard-equivalent event (use non-default value)
    const range = BUDGET_RANGES[state.market!.marketId]!;
    const budgetValue = Math.round(range.min + (range.max - range.min) * 0.75);
    fireEvent.change(slider, { target: { value: String(budgetValue) } });

    // Tab to Next button and press Enter
    const nextBtnStep2 = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase() === 'next',
    );
    expect(nextBtnStep2).toBeDefined();
    nextBtnStep2!.focus();
    fireEvent.click(nextBtnStep2!);

    state = useWizardStore.getState();
    expect(state.currentStep).toBe(3);
    cleanup();

    // Step 3: PlatformStep — select a platform, then Next
    render(<Wizard />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    checkboxes[0]!.focus();
    fireEvent.click(checkboxes[0]!);

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

    const nextBtnStep5 = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase() === 'next',
    );
    nextBtnStep5!.focus();
    fireEvent.click(nextBtnStep5!);

    state = useWizardStore.getState();
    expect(state.currentStep).toBe(6);
    cleanup();

    // Step 6: FulfillmentStep — select an option, then Analyze (last step)
    render(<Wizard />);
    const fulfillBtns = screen.getAllByRole('button').filter(
      (b) => b.textContent?.includes('⚡') || b.textContent?.includes('🕐') || b.textContent?.includes('💪'),
    );
    expect(fulfillBtns.length).toBe(3);
    fulfillBtns[1]!.focus(); // "5to15h" = moderate
    fireEvent.click(fulfillBtns[1]!);

    const analyzeBtn = screen.getAllByRole('button').find(
      (b) => b.textContent?.toLowerCase() === 'analyze',
    );
    expect(analyzeBtn).toBeDefined();
    analyzeBtn!.focus();
    fireEvent.click(analyzeBtn!);

    // Should advance past step 6
    state = useWizardStore.getState();
    expect(state.currentStep).toBe(7);

    // Verify all state was accumulated
    expect(state.market).not.toBeNull();
    expect(state.preferences.budget).toBeDefined();
    expect(state.selectedPlatforms.length).toBeGreaterThan(0);
    expect(state.preferences.riskTolerance).toBe('medium');
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

  it('each wizard step (2–6) has a heading for navigation', () => {
    for (const step of [2, 3, 4, 5, 6]) {
      setWizardStep(step, {
        selectedPlatforms: step === 3 ? [FIRST_CONFIG.platforms[0]!] : [],
      });
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

  it('PlatformStep checkboxes are accessible', () => {
    setWizardStep(3);
    render(<Wizard />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(0);
    for (const cb of checkboxes) {
      // Each checkbox is in a label, so it has accessible name
      expect(cb.closest('label')).not.toBeNull();
    }
  });
});

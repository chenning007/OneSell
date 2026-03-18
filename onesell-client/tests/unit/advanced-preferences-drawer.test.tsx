/**
 * W-16 (#270) — AdvancedPreferencesDrawer component unit tests.
 *
 * AC:
 *   1. Budget slider renders with default $500
 *   2. Product type toggle Physical/Digital
 *   3. Fulfillment radio Fast/Medium/Slow
 *   4. Apply saves to store + IPC
 *   5. Reset restores defaults
 *   6. Close on click outside
 *
 * Principles tested: P8 (no hardcoded values — defaults derived from component)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import AdvancedPreferencesDrawer from '../../src/renderer/modules/wizard/AdvancedPreferencesDrawer.js';
import { useWizardStore } from '../../src/renderer/store/wizardStore.js';

// ── Mock electronAPI ────────────────────────────────────────────────

beforeEach(() => {
  window.electronAPI = {
    extraction: {
      openView: vi.fn(),
      closeView: vi.fn(),
      hideView: vi.fn(),
      runExtraction: vi.fn(),
      getCurrentUrl: vi.fn(),
      getOpenPlatforms: vi.fn(),
      hideAll: vi.fn(),
      startPipeline: vi.fn(),
      togglePlatform: vi.fn(),
    },
    payload: { build: vi.fn() },
    analysis: { submit: vi.fn(), getStatus: vi.fn(), getResults: vi.fn() },
    store: {
      getProfile: vi.fn().mockResolvedValue(null),
      setProfile: vi.fn().mockResolvedValue({ ok: true }),
      clearProfile: vi.fn().mockResolvedValue({ ok: true }),
      getPreferences: vi.fn().mockResolvedValue({}),
      setPreferences: vi.fn().mockResolvedValue({ ok: true }),
      getHistory: vi.fn().mockResolvedValue([]),
      addHistory: vi.fn().mockResolvedValue({ ok: true }),
    },
    saveApiKey: vi.fn(),
    hasApiKey: vi.fn(),
    clearApiKey: vi.fn(),
    agent: { runAnalysis: vi.fn() },
    preferences: { getDefaults: vi.fn() },
  } as unknown as typeof window.electronAPI;

  useWizardStore.setState({
    currentStep: 2,
    market: { marketId: 'us', language: 'en-US', currency: 'USD' },
    preferences: {},
    hasProfile: false,
  });
});

// ── Helpers ──────────────────────────────────────────────────────────

function renderDrawer(open = true) {
  const onClose = vi.fn();
  const result = render(
    <AdvancedPreferencesDrawer open={open} onClose={onClose} />,
  );
  return { ...result, onClose };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('AdvancedPreferencesDrawer', () => {
  // TC-1: Budget slider renders with default $500
  it('renders budget slider with default value $500', () => {
    renderDrawer();

    const slider = screen.getByTestId('budget-slider') as HTMLInputElement;
    expect(slider).toBeDefined();
    expect(slider.value).toBe('500');

    const budgetValue = screen.getByTestId('budget-value');
    expect(budgetValue.textContent).toContain('500');
  });

  // TC-2: Product type toggle Physical/Digital
  it('toggles between Physical and Digital product types', () => {
    renderDrawer();

    const physicalBtn = screen.getByTestId('product-type-physical');
    const digitalBtn = screen.getByTestId('product-type-digital');

    expect(physicalBtn).toBeDefined();
    expect(digitalBtn).toBeDefined();

    // Default is Physical (check style indicates selected)
    expect(physicalBtn.textContent).toBe('Physical');
    expect(digitalBtn.textContent).toBe('Digital');

    // Click Digital
    fireEvent.click(digitalBtn);

    // Digital should now be selected (jsdom converts hex to rgb)
    expect(digitalBtn.style.border).toContain('rgb(52, 152, 219)');
  });

  // TC-3: Fulfillment radio Fast/Medium/Slow
  it('renders fulfillment options and allows radio selection', () => {
    renderDrawer();

    const fast = screen.getByTestId('fulfillment-low');
    const medium = screen.getByTestId('fulfillment-medium');
    const slow = screen.getByTestId('fulfillment-high');

    expect(fast.textContent).toContain('Fast');
    expect(medium.textContent).toContain('Medium');
    expect(slow.textContent).toContain('Slow');

    // Default is Medium (jsdom converts hex to rgb)
    expect(medium.style.border).toContain('rgb(52, 152, 219)');

    // Select Fast
    fireEvent.click(fast);
    expect(fast.style.border).toContain('rgb(52, 152, 219)');
  });

  // TC-4: Apply saves to store + IPC
  it('Apply button saves preferences to store and calls IPC', () => {
    renderDrawer();

    // Change budget to 1000
    const slider = screen.getByTestId('budget-slider') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '1000' } });

    // Click Digital
    fireEvent.click(screen.getByTestId('product-type-digital'));

    // Click Apply
    fireEvent.click(screen.getByTestId('apply-button'));

    // Verify store was updated
    const prefs = useWizardStore.getState().preferences;
    expect(prefs.budget).toBe(1000);
    expect(prefs.productType).toBe('digital');
    expect(prefs.fulfillmentTime).toBe('medium'); // default

    // Verify IPC was called
    expect(window.electronAPI.store.setPreferences).toHaveBeenCalledWith(
      expect.objectContaining({
        budget: expect.objectContaining({ max: 1000 }),
        productType: 'digital',
        fulfillmentTime: 'medium',
      }),
    );
  });

  // TC-5: Reset restores defaults
  it('Reset button restores defaults', () => {
    renderDrawer();

    // Change budget
    const slider = screen.getByTestId('budget-slider') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '3000' } });

    // Click Digital
    fireEvent.click(screen.getByTestId('product-type-digital'));

    // Click Reset
    fireEvent.click(screen.getByTestId('reset-button'));

    // Budget should be back to 500
    expect((screen.getByTestId('budget-slider') as HTMLInputElement).value).toBe('500');

    // Product type should be Physical (default) — jsdom converts hex to rgb
    expect(screen.getByTestId('product-type-physical').style.border).toContain('rgb(52, 152, 219)');
  });

  // TC-6: Close on click outside (backdrop click)
  it('closes drawer when clicking the backdrop', () => {
    const { onClose } = renderDrawer();

    const backdrop = screen.getByTestId('preferences-backdrop');
    // Click the backdrop itself (not the drawer)
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalled();
  });

  it('does NOT close when clicking inside the drawer', () => {
    const { onClose } = renderDrawer();

    const drawer = screen.getByTestId('preferences-drawer');
    fireEvent.click(drawer);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('returns null when open=false', () => {
    const { container } = render(
      <AdvancedPreferencesDrawer open={false} onClose={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });
});

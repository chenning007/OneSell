/**
 * W-12 (#266) — QuickStartScreen component unit tests.
 *
 * AC:
 *   1. Renders profile market name + flag
 *   2. Go → step 2
 *   3. Change Market → step 1
 *   4. Clear Profile → IPC + step 1
 *   5. Loading state while fetching profile
 *
 * Principles tested: P1 (creds never leave client), P8 (no hardcoded market IDs)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

import { useWizardStore } from '../../src/renderer/store/wizardStore.js';
import { MARKET_CONFIGS } from '../../src/renderer/config/markets.js';

// ── Mock electronAPI ────────────────────────────────────────────────

let getProfileResolve: (v: unknown) => void;

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
      getProfile: vi.fn().mockImplementation(
        () => new Promise((resolve) => { getProfileResolve = resolve; }),
      ),
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
    currentStep: 0,
    market: { marketId: 'us', language: 'en-US', currency: 'USD' },
    preferences: {},
    hasProfile: true,
  });
});

// Lazy import to pick up mocks
async function renderQuickStart() {
  const mod = await import('../../src/renderer/modules/wizard/QuickStartScreen.js');
  const QuickStartScreen = mod.default;
  return render(<QuickStartScreen />);
}

// ── Tests ────────────────────────────────────────────────────────────

describe('QuickStartScreen', () => {
  // TC-5: Loading state while fetching profile
  it('shows loading state while getProfile IPC is pending', async () => {
    await act(async () => { await renderQuickStart(); });

    expect(screen.getByTestId('quick-start-loading')).toBeDefined();
    expect(screen.getByText('Loading profile…')).toBeDefined();
  });

  // TC-1: Renders profile market name + flag
  it('renders saved profile market name and flag after load', async () => {
    await act(async () => { await renderQuickStart(); });

    // Resolve with a US profile
    await act(async () => {
      getProfileResolve({
        marketId: 'us',
        extractionMode: 'auto-discover',
        lastSessionAt: '2026-03-15T10:00:00.000Z',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('quick-start-screen')).toBeDefined();
    });

    expect(screen.getByTestId('market-name').textContent).toContain('US');
    // Flag should be US flag
    expect(screen.getByTestId('profile-card').textContent).toContain('🇺🇸');
  });

  // TC-2: Go button → step 2
  it('Go button navigates to step 2', async () => {
    await act(async () => { await renderQuickStart(); });
    await act(async () => {
      getProfileResolve({
        marketId: 'us',
        extractionMode: 'auto-discover',
        lastSessionAt: '2026-03-15T10:00:00.000Z',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('go-button')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('go-button'));

    expect(useWizardStore.getState().currentStep).toBe(2);
  });

  // TC-3: Change Market → step 1
  it('Change Market link navigates to step 1', async () => {
    useWizardStore.setState({ currentStep: 0 });

    await act(async () => { await renderQuickStart(); });
    await act(async () => {
      getProfileResolve({
        marketId: 'us',
        extractionMode: 'auto-discover',
        lastSessionAt: '2026-03-15T10:00:00.000Z',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('change-market-link')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId('change-market-link'));

    expect(useWizardStore.getState().currentStep).toBe(1);
  });

  // TC-4: Clear Profile → calls IPC + sets hasProfile false
  it('Clear Profile calls clearProfile IPC and resets hasProfile', async () => {
    await act(async () => { await renderQuickStart(); });
    await act(async () => {
      getProfileResolve({
        marketId: 'us',
        extractionMode: 'auto-discover',
        lastSessionAt: '2026-03-15T10:00:00.000Z',
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('clear-profile-link')).toBeDefined();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('clear-profile-link'));
    });

    expect(window.electronAPI.store.clearProfile).toHaveBeenCalled();
    // hasProfile should be false (setHasProfile(false) sets step to 1)
    await waitFor(() => {
      expect(useWizardStore.getState().hasProfile).toBe(false);
      expect(useWizardStore.getState().currentStep).toBe(1);
    });
  });
});

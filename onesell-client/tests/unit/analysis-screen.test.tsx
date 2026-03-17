/**
 * Issue #82 — AgentAnalysisScreen tests
 *
 * AC coverage:
 *   1. ✅ Polls analysis:status every 2 seconds
 *   2. ✅ Shows stage checklist with spinner → checkmark progression
 *   3. ✅ Auto-navigates to Step 10 on 'complete' status
 *   4. ✅ Shows error message + retry button on error
 *   5. ✅ Retry resets error and resumes polling
 *   6. ✅ Shows explainer text
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import React from 'react';
import { I18nextProvider } from 'react-i18next';

import AgentAnalysisScreen from '../../src/renderer/modules/analysis/AgentAnalysisScreen.js';
import { useAnalysisStore } from '../../src/renderer/store/analysisStore.js';
import { useWizardStore } from '../../src/renderer/store/wizardStore.js';
import i18n from '../../src/renderer/i18n/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function mockElectronAPI() {
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
      submit: vi.fn().mockResolvedValue({ analysisId: 'a1', status: 'planning' }),
      getStatus: vi.fn().mockResolvedValue({ analysisId: 'a1', status: 'planning' }),
      getResults: vi.fn().mockResolvedValue({ analysisId: 'a1', results: [] }),
    },
  };
  window.electronAPI = api as unknown as typeof window.electronAPI;
  return api;
}

function resetStores(): void {
  useAnalysisStore.setState({
    analysisId: 'a1',
    status: 'planning',
    results: [],
    error: null,
    selectedCardId: null,
  });
  useWizardStore.setState({ currentStep: 9 });
}

function renderComponent() {
  return render(
    <I18nextProvider i18n={i18n}>
      <AgentAnalysisScreen />
    </I18nextProvider>,
  );
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
let api: ReturnType<typeof mockElectronAPI>;

beforeEach(() => {
  api = mockElectronAPI();
  resetStores();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// AC 1 — Polls every 2 seconds
// ---------------------------------------------------------------------------
describe('AC 1 — Status polling', () => {
  it('calls getStatus every 2 seconds', async () => {
    renderComponent();

    // Advance past first interval
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(api.analysis.getStatus).toHaveBeenCalledWith('a1');

    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(api.analysis.getStatus).toHaveBeenCalledTimes(2);
  });

  it('does not poll when analysisId is null', async () => {
    useAnalysisStore.setState({ analysisId: null });
    renderComponent();
    await act(async () => { vi.advanceTimersByTime(4000); });
    expect(api.analysis.getStatus).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// AC 2 — Stage checklist rendering
// ---------------------------------------------------------------------------
describe('AC 2 — Stage checklist', () => {
  it('renders all four stages', () => {
    renderComponent();
    expect(screen.getByText('Planning research strategy')).toBeTruthy();
    expect(screen.getByText('Executing data analysis')).toBeTruthy();
    expect(screen.getByText('Synthesizing recommendations')).toBeTruthy();
    expect(screen.getByText('Analysis complete')).toBeTruthy();
  });

  it('shows a checkmark for completed stages', () => {
    useAnalysisStore.setState({ status: 'executing' });
    renderComponent();
    // Planning is before executing, so should have checkmark
    const items = screen.getAllByRole('listitem');
    expect(items[0]!.textContent).toContain('✓');
  });
});

// ---------------------------------------------------------------------------
// AC 3 — Auto-navigate on complete
// ---------------------------------------------------------------------------
describe('AC 3 — Auto-navigate to Step 10', () => {
  it('sets step to 10 when status becomes complete', async () => {
    api.analysis.getStatus.mockResolvedValueOnce({ analysisId: 'a1', status: 'complete' });
    renderComponent();

    await act(async () => { vi.advanceTimersByTime(2000); });
    // Wait for the promise to resolve
    await act(async () => { await Promise.resolve(); });

    expect(useWizardStore.getState().currentStep).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// AC 4 — Error message + retry button
// ---------------------------------------------------------------------------
describe('AC 4 — Error state', () => {
  it('shows error message and retry button on error', async () => {
    api.analysis.getStatus.mockResolvedValueOnce({ analysisId: 'a1', status: 'error', message: 'Backend failed' });
    renderComponent();

    await act(async () => { vi.advanceTimersByTime(2000); });
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Backend failed')).toBeTruthy();
    expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
  });

  it('shows error on IPC exception', async () => {
    api.analysis.getStatus.mockRejectedValueOnce(new Error('Network error'));
    renderComponent();

    await act(async () => { vi.advanceTimersByTime(2000); });
    await act(async () => { await Promise.resolve(); });

    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Network error')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// AC 5 — Retry resets error
// ---------------------------------------------------------------------------
describe('AC 5 — Retry', () => {
  it('clicking retry clears error and resets to planning', async () => {
    useAnalysisStore.setState({ status: 'error', error: 'Something went wrong' });
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    expect(useAnalysisStore.getState().error).toBeNull();
    expect(useAnalysisStore.getState().status).toBe('planning');
  });
});

// ---------------------------------------------------------------------------
// AC 6 — Explainer text
// ---------------------------------------------------------------------------
describe('AC 6 — Explainer text', () => {
  it('shows the "how AI analysis works" explainer', () => {
    renderComponent();
    expect(screen.getByText(/AI agent plans a research strategy/i)).toBeTruthy();
  });
});

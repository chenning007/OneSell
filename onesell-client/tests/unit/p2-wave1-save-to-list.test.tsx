/**
 * Tests for R-13 (#295): Save to My List in ResultsDashboardV2
 * PRD §8.7
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mock i18n ───────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: 'en' },
  }),
}));

import ResultsDashboardV2 from '../../src/renderer/modules/results/ResultsDashboardV2.js';
import { useAnalysisStore } from '../../src/renderer/store/analysisStore.js';
import { useWizardStore } from '../../src/renderer/store/wizardStore.js';

// ── Mock CategoryGroup ──────────────────────────────────────────────

vi.mock('../../src/renderer/modules/results/CategoryGroup.js', () => ({
  default: ({ category }: { category: { name: string } }) => (
    <div data-testid={`category-${category.name}`}>{category.name}</div>
  ),
}));

// ── Mock window.electronAPI ─────────────────────────────────────────

const mockAddHistory = vi.fn().mockResolvedValue({ ok: true });
const mockRunAnalysis = vi.fn().mockResolvedValue({ ok: true, marketId: 'us', status: 'complete' });

beforeEach(() => {
  (globalThis as Record<string, unknown>).window = globalThis;
  (globalThis.window as Record<string, unknown>).electronAPI = {
    store: {
      addHistory: mockAddHistory,
    },
    agent: {
      runAnalysis: mockRunAnalysis,
    },
  };

  useWizardStore.setState({
    currentStep: 4,
    market: { marketId: 'us', language: 'en', currency: 'USD' },
    preferences: {},
    hasProfile: true,
  });

  useAnalysisStore.setState({
    analysisId: 'test-session-123',
    status: 'complete',
    categories: [
      {
        name: 'Trending Home & Kitchen',
        type: 'trending',
        products: [
          {
            productName: 'Test Product',
            overallScore: 85,
            oneLineReason: 'Trending product with high margins',
            category: 'Home',
            primaryPlatform: 'amazon-us',
          },
        ],
      },
    ],
    results: [],
    error: null,
    selectedCardId: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('R-13: Save to My List', () => {
  it('AC-1: save button calls IPC store:add-history', async () => {
    render(<ResultsDashboardV2 />);

    const saveButton = screen.getByTestId('save-to-list-button');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockAddHistory).toHaveBeenCalledOnce();
      expect(mockAddHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session-123',
          marketId: 'us',
          productCount: 1,
          categoryCount: 1,
        }),
      );
    });
  });

  it('AC-2: toast shows "Saved!" after save', async () => {
    render(<ResultsDashboardV2 />);

    fireEvent.click(screen.getByTestId('save-to-list-button'));

    await waitFor(() => {
      expect(screen.getByTestId('save-toast')).toBeInTheDocument();
      expect(screen.getByTestId('save-toast').textContent).toBe('Saved!');
    });

    // Toast will disappear after 2s (tested conceptually; real timer expiry)
  });

  it('AC-3: button changes to "✓ Saved" after save', async () => {
    render(<ResultsDashboardV2 />);

    const saveButton = screen.getByTestId('save-to-list-button');
    expect(saveButton.textContent).toBe('Save to My List ★');

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(saveButton.textContent).toBe('✓ Saved');
    });
  });

  it('AC-4: button is disabled after save until new analysis', async () => {
    render(<ResultsDashboardV2 />);

    const saveButton = screen.getByTestId('save-to-list-button');
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(saveButton).toBeDisabled();
    });

    // Clicking again doesn't call IPC a second time
    fireEvent.click(saveButton);
    expect(mockAddHistory).toHaveBeenCalledTimes(1);
  });

  it('save button shown with star when categories exist', () => {
    render(<ResultsDashboardV2 />);

    const saveButton = screen.getByTestId('save-to-list-button');
    expect(saveButton).toBeInTheDocument();
    expect(saveButton.textContent).toContain('★');
  });
});

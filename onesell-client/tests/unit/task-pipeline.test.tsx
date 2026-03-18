/**
 * E-05 (#241) — TaskPipeline unit tests.
 *
 * AC:
 *   1. One row per pipeline task
 *   2. Status icon matches state
 *   3. Text shows label for queued, doneLabel for done
 *   4. Overall progress shows N of M platforms done
 *   5. Animated spinner for active platform
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import TaskPipeline from '../../src/renderer/modules/extraction/TaskPipeline.js';
import { useExtractionStore } from '../../src/renderer/store/extractionStore.js';
import type { PipelineTask } from '../../src/renderer/store/extractionStore.js';

// ── Helpers ─────────────────────────────────────────────────────────

function makeTasks(overrides: Partial<PipelineTask>[]): PipelineTask[] {
  return overrides.map((o, i) => ({
    platformId: o.platformId ?? `platform-${i}`,
    status: o.status ?? 'queued',
    label: o.label ?? `Platform ${i}`,
    doneLabel: o.doneLabel ?? `Platform ${i} Done`,
    productCount: o.productCount ?? 0,
    enabled: o.enabled ?? true,
    requiresAuth: o.requiresAuth ?? false,
    progressEvents: o.progressEvents ?? [],
  }));
}

// ── Tests ───────────────────────────────────────────────────────────

describe('TaskPipeline (E-05)', () => {
  beforeEach(() => {
    useExtractionStore.setState({
      tasks: [],
      activeTab: null,
      canAnalyze: false,
      allDone: false,
      cancelled: false,
    });
  });

  // AC-1: One row per pipeline task
  it('renders one row per pipeline task', () => {
    const tasks = makeTasks([
      { platformId: 'amazon-us', label: 'Amazon US' },
      { platformId: 'ebay-us', label: 'eBay US' },
      { platformId: 'etsy', label: 'Etsy' },
    ]);
    useExtractionStore.setState({ tasks });

    render(<TaskPipeline />);

    expect(screen.getByTestId('pipeline-row-amazon-us')).toBeTruthy();
    expect(screen.getByTestId('pipeline-row-ebay-us')).toBeTruthy();
    expect(screen.getByTestId('pipeline-row-etsy')).toBeTruthy();
  });

  // AC-2: Status icon matches state
  it('shows ✓ for done, ○ for queued, ✗ for error', () => {
    const tasks = makeTasks([
      { platformId: 'done-one', status: 'done', doneLabel: 'Done Platform' },
      { platformId: 'queued-one', status: 'queued', label: 'Pending' },
      { platformId: 'error-one', status: 'error', label: 'Failed' },
    ]);
    useExtractionStore.setState({ tasks });

    render(<TaskPipeline />);

    expect(screen.getByTestId('status-icon-done-one').textContent).toBe('✓');
    expect(screen.getByTestId('status-icon-queued-one').textContent).toBe('○');
    expect(screen.getByTestId('status-icon-error-one').textContent).toBe('✗');
  });

  it('shows ⟳ for active, 🔒 for needs-login, ── for disabled', () => {
    const tasks = makeTasks([
      { platformId: 'active-one', status: 'active' },
      { platformId: 'login-one', status: 'needs-login' },
      { platformId: 'disabled-one', status: 'disabled', enabled: false },
    ]);
    useExtractionStore.setState({ tasks });

    render(<TaskPipeline />);

    expect(screen.getByTestId('status-icon-active-one').textContent).toBe('⟳');
    expect(screen.getByTestId('status-icon-login-one').textContent).toBe('🔒');
    expect(screen.getByTestId('status-icon-disabled-one').textContent).toBe('──');
  });

  // AC-3: Text shows label for queued, doneLabel for done
  it('shows label text for queued, doneLabel + productCount for done', () => {
    const tasks = makeTasks([
      { platformId: 'q', status: 'queued', label: 'Queued Platform' },
      { platformId: 'd', status: 'done', doneLabel: 'Finished', productCount: 42 },
    ]);
    useExtractionStore.setState({ tasks });

    render(<TaskPipeline />);

    expect(screen.getByText('Queued Platform')).toBeTruthy();
    expect(screen.getByText('Finished · 42 products')).toBeTruthy();
  });

  it('shows singular "product" for count 1', () => {
    const tasks = makeTasks([
      { platformId: 's', status: 'done', doneLabel: 'Single', productCount: 1 },
    ]);
    useExtractionStore.setState({ tasks });

    render(<TaskPipeline />);
    expect(screen.getByText('Single · 1 product')).toBeTruthy();
  });

  // AC-4: Overall progress shows N of M platforms done
  it('shows progress summary "N of M platforms done"', () => {
    const tasks = makeTasks([
      { platformId: 'a', status: 'done', enabled: true },
      { platformId: 'b', status: 'queued', enabled: true },
      { platformId: 'c', status: 'queued', enabled: true },
    ]);
    useExtractionStore.setState({ tasks });

    render(<TaskPipeline />);
    expect(screen.getByText(/1 of 3 platforms done/)).toBeTruthy();
  });

  it('shows estimated time remaining', () => {
    const tasks = makeTasks([
      { platformId: 'a', status: 'done', enabled: true },
      { platformId: 'b', status: 'queued', enabled: true },
    ]);
    useExtractionStore.setState({ tasks });

    render(<TaskPipeline />);
    expect(screen.getByText(/~2 min remaining/)).toBeTruthy();
  });

  // AC-5: Animated spinner for active platform
  it('applies animation style to active platform icon', () => {
    const tasks = makeTasks([
      { platformId: 'active', status: 'active' },
    ]);
    useExtractionStore.setState({ tasks });

    render(<TaskPipeline />);
    const icon = screen.getByTestId('status-icon-active');
    expect(icon.style.animation).toContain('pipeline-spin');
  });

  // Empty state
  it('renders "No extraction tasks configured" when empty', () => {
    render(<TaskPipeline />);
    expect(screen.getByText('No extraction tasks configured')).toBeTruthy();
  });
});

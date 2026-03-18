/**
 * E-09 (#245) — PlatformTabPanel unit tests.
 *
 * AC:
 *   1. Tab bar with one tab per platform
 *   2. Clicking tab selects it and shows content
 *   3. Active extraction platform tab auto-selected
 *   4. Manual selection overrides auto-select
 *   5. Tab icon matches platform status
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import PlatformTabPanel from '../../src/renderer/modules/extraction/PlatformTabPanel.js';
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

describe('PlatformTabPanel (E-09)', () => {
  beforeEach(() => {
    useExtractionStore.setState({
      tasks: [],
      activeTab: null,
      canAnalyze: false,
      allDone: false,
      cancelled: false,
    });
  });

  // AC-1: Tab bar with one tab per platform
  it('renders one tab per platform', () => {
    const tasks = makeTasks([
      { platformId: 'amazon-us' },
      { platformId: 'ebay-us' },
      { platformId: 'etsy' },
    ]);
    useExtractionStore.setState({ tasks });

    render(<PlatformTabPanel />);

    expect(screen.getByTestId('tab-amazon-us')).toBeTruthy();
    expect(screen.getByTestId('tab-ebay-us')).toBeTruthy();
    expect(screen.getByTestId('tab-etsy')).toBeTruthy();
  });

  // AC-2: Clicking tab selects it and shows content
  it('clicking a tab shows platform content', () => {
    const tasks = makeTasks([
      { platformId: 'amazon-us' },
      { platformId: 'ebay-us' },
    ]);
    useExtractionStore.setState({ tasks });

    render(<PlatformTabPanel />);

    fireEvent.click(screen.getByTestId('tab-ebay-us'));
    // After E-11, tab content renders status-based content (PlatformTabContent)
    expect(screen.getByTestId('tab-content').textContent).toBeTruthy();
  });

  // AC-3: Active extraction platform tab auto-selected
  it('auto-selects the active extraction platform', () => {
    const tasks = makeTasks([
      { platformId: 'amazon-us', status: 'done' },
      { platformId: 'ebay-us', status: 'active' },
      { platformId: 'etsy', status: 'queued' },
    ]);
    useExtractionStore.setState({ tasks });

    render(<PlatformTabPanel />);

    // Content should show active status content for ebay-us
    expect(screen.getByTestId('tab-content-active')).toBeTruthy();
  });

  // AC-4: Manual selection overrides auto-select
  it('manual selection overrides auto-follow', () => {
    const tasks = makeTasks([
      { platformId: 'amazon-us', status: 'done' },
      { platformId: 'ebay-us', status: 'active' },
      { platformId: 'etsy', status: 'queued' },
    ]);
    useExtractionStore.setState({ tasks });

    const { rerender } = render(<PlatformTabPanel />);

    // Manually select amazon-us (which is 'done' status)
    fireEvent.click(screen.getByTestId('tab-amazon-us'));
    expect(screen.getByTestId('tab-content-done')).toBeTruthy();

    // Even after re-render (simulating extraction progress), manual selection sticks
    rerender(<PlatformTabPanel />);
    expect(screen.getByTestId('tab-content-done')).toBeTruthy();
  });

  // AC-5: Tab icon matches platform status
  it('tab icons match platform status', () => {
    const tasks = makeTasks([
      { platformId: 'done-p', status: 'done' },
      { platformId: 'active-p', status: 'active' },
      { platformId: 'queued-p', status: 'queued' },
    ]);
    useExtractionStore.setState({ tasks });

    render(<PlatformTabPanel />);

    const doneTab = screen.getByTestId('tab-done-p');
    const activeTab = screen.getByTestId('tab-active-p');
    const queuedTab = screen.getByTestId('tab-queued-p');

    expect(doneTab.textContent).toContain('✓');
    expect(activeTab.textContent).toContain('⟳');
    expect(queuedTab.textContent).toContain('○');
  });

  // Default selection: first tab
  it('defaults to first tab when no active extraction', () => {
    const tasks = makeTasks([
      { platformId: 'amazon-us', status: 'queued' },
      { platformId: 'ebay-us', status: 'queued' },
    ]);
    useExtractionStore.setState({ tasks });

    render(<PlatformTabPanel />);
    // First tab (amazon-us, queued) renders queued content
    expect(screen.getByTestId('tab-content-queued')).toBeTruthy();
  });

  // Empty state
  it('shows "No platform selected" when there are no tasks', () => {
    render(<PlatformTabPanel />);
    expect(screen.getByText('No platform selected')).toBeTruthy();
  });
});

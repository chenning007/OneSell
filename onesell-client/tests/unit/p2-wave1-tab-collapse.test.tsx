/**
 * Tests for E-31 (#289): Tab panel collapse/expand
 * PRD §5.10
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PlatformTabPanel from '../../src/renderer/modules/extraction/PlatformTabPanel.js';
import { useExtractionStore } from '../../src/renderer/store/extractionStore.js';
import type { PipelineTask } from '../../src/renderer/store/extractionStore.js';

// ── Mock PlatformTabContent ─────────────────────────────────────────

vi.mock('../../src/renderer/modules/extraction/PlatformTabContent.js', () => ({
  default: ({ task }: { task: PipelineTask }) => (
    <div data-testid={`tab-content-${task.platformId}`}>Content for {task.platformId}</div>
  ),
}));

function makeTasks(): PipelineTask[] {
  return [
    {
      platformId: 'amazon-us',
      status: 'done',
      label: 'Scanning Amazon…',
      doneLabel: 'Scanned Amazon',
      productCount: 42,
      enabled: true,
      requiresAuth: true,
      progressEvents: [],
      estimatedSeconds: 120,
      startedAt: null,
      completedAt: null,
    },
    {
      platformId: 'google-trends',
      status: 'active',
      label: 'Scanning trends…',
      doneLabel: '',
      productCount: 0,
      enabled: true,
      requiresAuth: false,
      progressEvents: [],
      estimatedSeconds: 60,
      startedAt: null,
      completedAt: null,
    },
  ];
}

describe('E-31: Tab panel collapse/expand', () => {
  beforeEach(() => {
    useExtractionStore.setState({
      tasks: makeTasks(),
      activeTab: null,
      canAnalyze: true,
      allDone: false,
      cancelled: false,
    });
  });

  it('AC-1: renders a chevron collapse/expand button', () => {
    render(<PlatformTabPanel />);

    const toggle = screen.getByTestId('collapse-toggle');
    expect(toggle).toBeInTheDocument();
    expect(toggle.textContent).toBe('▼'); // default: expanded, so chevron shows ▼
  });

  it('AC-2: clicking chevron collapses the content area', () => {
    render(<PlatformTabPanel />);

    // Content visible by default
    expect(screen.getByTestId('tab-content')).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(screen.getByTestId('collapse-toggle'));

    // Content should be hidden
    expect(screen.queryByTestId('tab-content')).not.toBeInTheDocument();

    // Chevron should now show ▲ (collapsed state)
    expect(screen.getByTestId('collapse-toggle').textContent).toBe('▲');
  });

  it('AC-2: clicking chevron again re-expands', () => {
    render(<PlatformTabPanel />);

    // Collapse
    fireEvent.click(screen.getByTestId('collapse-toggle'));
    expect(screen.queryByTestId('tab-content')).not.toBeInTheDocument();

    // Expand
    fireEvent.click(screen.getByTestId('collapse-toggle'));
    expect(screen.getByTestId('tab-content')).toBeInTheDocument();
    expect(screen.getByTestId('collapse-toggle').textContent).toBe('▼');
  });

  it('AC-3: collapse state is preserved across tab switches', () => {
    render(<PlatformTabPanel />);

    // Collapse
    fireEvent.click(screen.getByTestId('collapse-toggle'));
    expect(screen.queryByTestId('tab-content')).not.toBeInTheDocument();

    // Switch tabs
    fireEvent.click(screen.getByTestId('tab-amazon-us'));

    // Content still collapsed
    expect(screen.queryByTestId('tab-content')).not.toBeInTheDocument();
  });

  it('AC-4: default state is expanded', () => {
    render(<PlatformTabPanel />);

    expect(screen.getByTestId('tab-content')).toBeInTheDocument();
    expect(screen.getByTestId('collapse-toggle').textContent).toBe('▼');
  });

  it('collapse button has correct aria-label', () => {
    render(<PlatformTabPanel />);

    const toggle = screen.getByTestId('collapse-toggle');
    expect(toggle).toHaveAttribute('aria-label', 'Collapse tab panel');

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-label', 'Expand tab panel');
  });
});

/**
 * Tests for E-29 (#287): Time estimate display in TaskPipelineRow
 * PRD §5.8
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import TaskPipelineRow from '../../src/renderer/modules/extraction/TaskPipelineRow.js';
import { useExtractionStore } from '../../src/renderer/store/extractionStore.js';
import type { PipelineTask } from '../../src/renderer/store/extractionStore.js';

// ── Mock window.electronAPI ─────────────────────────────────────────

beforeEach(() => {
  (globalThis as Record<string, unknown>).window = globalThis;
  (globalThis as Record<string, unknown>).electronAPI = {
    extraction: { togglePlatform: vi.fn().mockResolvedValue({ ok: true }) },
  };
  (globalThis.window as Record<string, unknown>).electronAPI = (globalThis as Record<string, unknown>).electronAPI;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeTask(overrides: Partial<PipelineTask> = {}): PipelineTask {
  return {
    platformId: 'test-platform',
    status: 'queued',
    label: 'Scanning test-platform…',
    doneLabel: 'Scanned test-platform',
    productCount: 0,
    enabled: true,
    requiresAuth: false,
    progressEvents: [],
    estimatedSeconds: 120,
    startedAt: null,
    completedAt: null,
    ...overrides,
  };
}

describe('E-29: Time estimate display', () => {
  beforeEach(() => {
    useExtractionStore.setState({
      tasks: [makeTask()],
      activeTab: null,
      canAnalyze: false,
      allDone: false,
      cancelled: false,
    });
  });

  it('AC-1: shows estimate for queued tasks', () => {
    const task = makeTask({ status: 'queued', estimatedSeconds: 120 });
    render(<TaskPipelineRow task={task} />);

    const timeEl = screen.getByTestId('time-display-test-platform');
    expect(timeEl).toBeInTheDocument();
    expect(timeEl.textContent).toBe('~2m');
  });

  it('AC-1: shows estimate with seconds for short estimates', () => {
    const task = makeTask({ status: 'queued', estimatedSeconds: 45 });
    render(<TaskPipelineRow task={task} />);

    const timeEl = screen.getByTestId('time-display-test-platform');
    expect(timeEl.textContent).toBe('~45s');
  });

  it('AC-1: shows estimate with minutes+seconds', () => {
    const task = makeTask({ status: 'queued', estimatedSeconds: 90 });
    render(<TaskPipelineRow task={task} />);

    const timeEl = screen.getByTestId('time-display-test-platform');
    expect(timeEl.textContent).toBe('~1m 30s');
  });

  it('AC-2: shows running counter for active tasks', () => {
    vi.useFakeTimers();
    const startedAt = new Date(Date.now() - 30_000).toISOString(); // 30s ago
    const task = makeTask({ status: 'active', startedAt });

    render(<TaskPipelineRow task={task} />);

    const timeEl = screen.getByTestId('time-display-test-platform');
    expect(timeEl).toBeInTheDocument();
    // Should show ~30s elapsed
    expect(timeEl.textContent).toBe('30s');

    // Advance 10 seconds
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(timeEl.textContent).toBe('40s');

    vi.useRealTimers();
  });

  it('AC-3: shows actual time for done tasks', () => {
    const startedAt = '2026-03-18T10:00:00.000Z';
    const completedAt = '2026-03-18T10:01:45.000Z'; // 105s later
    const task = makeTask({ status: 'done', startedAt, completedAt });

    render(<TaskPipelineRow task={task} />);

    const timeEl = screen.getByTestId('time-display-test-platform');
    expect(timeEl.textContent).toBe('1m 45s');
  });

  it('hides time display for disabled tasks', () => {
    const task = makeTask({ status: 'disabled', enabled: false });
    render(<TaskPipelineRow task={task} />);

    expect(screen.queryByTestId('time-display-test-platform')).not.toBeInTheDocument();
  });

  it('hides time display for needs-login tasks', () => {
    const task = makeTask({ status: 'needs-login' });
    render(<TaskPipelineRow task={task} />);

    expect(screen.queryByTestId('time-display-test-platform')).not.toBeInTheDocument();
  });
});

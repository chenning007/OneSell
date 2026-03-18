/**
 * E-16 (#252) — useAutonomousExtraction hook unit tests.
 *
 * AC:
 *   1. Calls startPipeline on mount
 *   2. Listens to pipeline-update, updates store
 *   3. Listens to progress-event
 *   4. Cleanup: removes listeners on unmount
 *
 * Principles tested: P5 (graceful degradation — handles missing IPC)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

import { useWizardStore } from '../../src/renderer/store/wizardStore.js';
import { useExtractionStore } from '../../src/renderer/store/extractionStore.js';
import { useAutonomousExtraction } from '../../src/renderer/modules/extraction/useAutonomousExtraction.js';

// ── Mock IPC ────────────────────────────────────────────────────────

type IpcCallback = (...args: unknown[]) => void;

const ipcListeners = new Map<string, IpcCallback[]>();

const mockIpcRenderer = {
  on(channel: string, callback: IpcCallback) {
    const list = ipcListeners.get(channel) ?? [];
    list.push(callback);
    ipcListeners.set(channel, list);
  },
  removeListener(channel: string, callback: IpcCallback) {
    const list = ipcListeners.get(channel) ?? [];
    ipcListeners.set(channel, list.filter((cb) => cb !== callback));
  },
};

/** Simulate an IPC event from main process. */
function emitIpc(channel: string, data: unknown) {
  const listeners = ipcListeners.get(channel) ?? [];
  for (const cb of listeners) {
    cb({}, data); // first arg is IPC event
  }
}

// ── Setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  ipcListeners.clear();

  // Mock IPC renderer on window
  (window as Record<string, unknown>)['__electronIpcRenderer'] = mockIpcRenderer;

  window.electronAPI = {
    extraction: {
      openView: vi.fn().mockResolvedValue(undefined),
      closeView: vi.fn().mockResolvedValue(undefined),
      hideView: vi.fn().mockResolvedValue(undefined),
      runExtraction: vi.fn().mockResolvedValue(null),
      getCurrentUrl: vi.fn().mockResolvedValue(''),
      getOpenPlatforms: vi.fn().mockResolvedValue([]),
      hideAll: vi.fn().mockResolvedValue(undefined),
      startPipeline: vi.fn().mockResolvedValue({ ok: true, marketId: 'us' }),
      togglePlatform: vi.fn().mockResolvedValue({ ok: true }),
    },
    payload: { build: vi.fn().mockResolvedValue({}) },
    analysis: {
      submit: vi.fn().mockResolvedValue({}),
      getStatus: vi.fn().mockResolvedValue({}),
      getResults: vi.fn().mockResolvedValue({}),
    },
    store: {
      getProfile: vi.fn().mockResolvedValue(null),
      setProfile: vi.fn().mockResolvedValue({ ok: true }),
      clearProfile: vi.fn().mockResolvedValue({ ok: true }),
      getPreferences: vi.fn().mockResolvedValue({}),
      setPreferences: vi.fn().mockResolvedValue({ ok: true }),
      getHistory: vi.fn().mockResolvedValue([]),
      addHistory: vi.fn().mockResolvedValue({ ok: true }),
    },
    saveApiKey: vi.fn().mockResolvedValue({ ok: true }),
    hasApiKey: vi.fn().mockResolvedValue(true),
    clearApiKey: vi.fn().mockResolvedValue({ ok: true }),
    agent: { runAnalysis: vi.fn().mockResolvedValue({ ok: true }) },
    preferences: { getDefaults: vi.fn().mockResolvedValue({}) },
  } as unknown as typeof window.electronAPI;

  // Reset stores
  useWizardStore.setState({ currentStep: 2, market: null, preferences: {}, hasProfile: false });
  useExtractionStore.setState({
    tasks: [],
    activeTab: null,
    canAnalyze: false,
    allDone: false,
    cancelled: false,
  });
});

afterEach(() => {
  delete (window as Record<string, unknown>)['__electronIpcRenderer'];
});

// ── Tests ────────────────────────────────────────────────────────────

describe('useAutonomousExtraction (E-16, #252)', () => {

  // AC-1: Calls startPipeline on mount
  it('calls startPipeline with marketId on mount', () => {
    useWizardStore.setState({
      market: { marketId: 'us', language: 'en-US', currency: 'USD', platforms: ['amazon-us'] },
    });

    renderHook(() => useAutonomousExtraction());

    expect(window.electronAPI.extraction.startPipeline).toHaveBeenCalledWith('us');
  });

  it('does not call startPipeline when no market is set', () => {
    renderHook(() => useAutonomousExtraction());

    expect(window.electronAPI.extraction.startPipeline).not.toHaveBeenCalled();
  });

  it('initializes pipeline tasks from market config', () => {
    useWizardStore.setState({
      market: { marketId: 'us', language: 'en-US', currency: 'USD', platforms: ['amazon-us', 'google-trends'] },
    });

    renderHook(() => useAutonomousExtraction());

    const tasks = useExtractionStore.getState().tasks;
    expect(tasks.length).toBeGreaterThan(0);
  });

  // AC-2: Listens to pipeline-update, updates store
  it('updates store on pipeline-update IPC event', () => {
    useWizardStore.setState({
      market: { marketId: 'us', language: 'en-US', currency: 'USD', platforms: ['amazon-us'] },
    });

    renderHook(() => useAutonomousExtraction());

    // Verify listener registered
    expect(ipcListeners.has('extraction:pipeline-update')).toBe(true);

    // Initialize a task so updateTask has something to update
    useExtractionStore.getState().initPipeline('us');
    const initialTask = useExtractionStore.getState().tasks.find((t) => t.platformId === 'amazon-us');
    expect(initialTask).toBeTruthy();

    // Emit a pipeline update
    act(() => {
      emitIpc('extraction:pipeline-update', {
        platformId: 'amazon-us',
        status: 'active',
      });
    });

    const updated = useExtractionStore.getState().tasks.find((t) => t.platformId === 'amazon-us');
    expect(updated?.status).toBe('active');
  });

  // AC-3: Listens to progress-event
  it('registers listener for progress-event channel', () => {
    useWizardStore.setState({
      market: { marketId: 'us', language: 'en-US', currency: 'USD', platforms: ['amazon-us'] },
    });

    renderHook(() => useAutonomousExtraction());

    expect(ipcListeners.has('extraction:progress-event')).toBe(true);
  });

  it('appends progress events to task on progress-event IPC', () => {
    // NOTE: Known bug — handleProgressEvent first sets progressEvents to undefined
    // via updateTask(platformId, { progressEvents: undefined }), then tries to spread
    // task.progressEvents which is now undefined. This causes a TypeError.
    // Filed as bug. For now, verify the handler reacts to the event (listener exists
    // and attempts the update). The progress-event listener registration is verified
    // by the 'registers listener for progress-event channel' test above.
    useWizardStore.setState({
      market: { marketId: 'us', language: 'en-US', currency: 'USD', platforms: ['amazon-us'] },
    });

    renderHook(() => useAutonomousExtraction());
    useExtractionStore.getState().initPipeline('us');

    // Progress events are appended to the task in the store
    act(() => {
      emitIpc('extraction:progress-event', {
        platformId: 'amazon-us',
        message: 'Fetching page',
        field: 'page-load',
        timestamp: '2026-03-18T10:00:00Z',
      });
    });
    const task = useExtractionStore.getState().tasks.find((t: { platformId: string }) => t.platformId === 'amazon-us');
    expect(task?.progressEvents).toHaveLength(1);
    expect(task?.progressEvents[0].message).toBe('Fetching page');
  });

  // AC-4: Cleanup on unmount
  it('removes IPC listeners on unmount', () => {
    useWizardStore.setState({
      market: { marketId: 'us', language: 'en-US', currency: 'USD', platforms: ['amazon-us'] },
    });

    const { unmount } = renderHook(() => useAutonomousExtraction());

    // Before unmount: listeners registered
    const pipelineListeners = ipcListeners.get('extraction:pipeline-update') ?? [];
    const progressListeners = ipcListeners.get('extraction:progress-event') ?? [];
    expect(pipelineListeners.length).toBeGreaterThan(0);
    expect(progressListeners.length).toBeGreaterThan(0);

    // Unmount
    unmount();

    // After unmount: listeners removed
    const remaining1 = ipcListeners.get('extraction:pipeline-update') ?? [];
    const remaining2 = ipcListeners.get('extraction:progress-event') ?? [];
    expect(remaining1.length).toBe(0);
    expect(remaining2.length).toBe(0);
  });

  it('does not start twice on re-render', () => {
    useWizardStore.setState({
      market: { marketId: 'us', language: 'en-US', currency: 'USD', platforms: ['amazon-us'] },
    });

    const { rerender } = renderHook(() => useAutonomousExtraction());
    rerender();

    // startPipeline called only once due to started ref
    expect(window.electronAPI.extraction.startPipeline).toHaveBeenCalledTimes(1);
  });
});

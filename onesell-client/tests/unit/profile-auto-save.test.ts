/**
 * W-14 (#268) — Profile auto-save test (useAutonomousExtraction).
 *
 * AC:
 *   1. Calls store:set-profile IPC after extraction starts
 *   2. Sets hasProfile=true on wizardStore
 *   3. NOT called on mount if no market
 *
 * Principles tested: P1 (credentials stripped via IPC), P5 (graceful degradation)
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

beforeEach(() => {
  ipcListeners.clear();
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
  vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────────────────

describe('Profile auto-save (W-14, #268)', () => {
  // TC-1: Calls store:set-profile IPC after extraction starts
  it('calls setProfile IPC when extraction starts with a market', async () => {
    useWizardStore.setState({
      market: { marketId: 'us', language: 'en-US', currency: 'USD' },
      hasProfile: false,
    });

    const { unmount } = renderHook(() => useAutonomousExtraction());

    // Allow async profile save to complete
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(window.electronAPI.store.setProfile).toHaveBeenCalledTimes(1);
    const call = vi.mocked(window.electronAPI.store.setProfile).mock.calls[0]![0];
    expect(call).toMatchObject({
      marketId: 'us',
      extractionMode: 'auto-discover',
    });
    expect(call).toHaveProperty('lastSessionAt');

    unmount();
  });

  // TC-2: Sets hasProfile=true in wizardStore
  it('sets hasProfile=true on wizardStore after profile save', async () => {
    useWizardStore.setState({
      market: { marketId: 'us', language: 'en-US', currency: 'USD' },
      hasProfile: false,
    });

    const { unmount } = renderHook(() => useAutonomousExtraction());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(useWizardStore.getState().hasProfile).toBe(true);

    unmount();
  });

  // TC-3: NOT called on mount if no market
  it('does NOT call setProfile when no market is set', async () => {
    useWizardStore.setState({ market: null, hasProfile: false });

    const { unmount } = renderHook(() => useAutonomousExtraction());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(window.electronAPI.store.setProfile).not.toHaveBeenCalled();
    expect(window.electronAPI.extraction.startPipeline).not.toHaveBeenCalled();

    unmount();
  });
});

/**
 * F-14 (#218) — Unit test: preload exposes expected API surface.
 *
 * AC:
 *   1. window.electronAPI has all v2 methods
 *   2. Type declarations compile without error (verified by TS check)
 *   3. IPC invoke calls resolve
 *
 * Principles:
 *   P1 — No credentials exposed via contextBridge
 *   P9 — contextIsolation + sandbox enforced
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Track what contextBridge exposes ────────────────────────────────

let exposedApi: Record<string, unknown> = {};

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: vi.fn((name: string, api: unknown) => {
      exposedApi[name] = api;
    }),
  },
  ipcRenderer: {
    invoke: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

// ── Tests ───────────────────────────────────────────────────────────

describe('Preload v2 API surface (F-14)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    exposedApi = {};
    // Dynamic import to trigger the preload side-effect after mocks are set up.
    // Vitest caches modules, so we need to reset the module registry.
    vi.resetModules();
    await import('../../src/main/preload.js');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // AC-1: window.electronAPI has all v2 methods

  it('exposes electronAPI via contextBridge', () => {
    expect(exposedApi).toHaveProperty('electronAPI');
  });

  it('electronAPI.extraction has all expected methods', () => {
    const api = exposedApi['electronAPI'] as Record<string, Record<string, unknown>>;
    const extraction = api['extraction'];

    expect(typeof extraction['openView']).toBe('function');
    expect(typeof extraction['closeView']).toBe('function');
    expect(typeof extraction['hideView']).toBe('function');
    expect(typeof extraction['runExtraction']).toBe('function');
    expect(typeof extraction['getCurrentUrl']).toBe('function');
    expect(typeof extraction['getOpenPlatforms']).toBe('function');
    expect(typeof extraction['hideAll']).toBe('function');
    // v2 additions
    expect(typeof extraction['startPipeline']).toBe('function');
    expect(typeof extraction['togglePlatform']).toBe('function');
  });

  it('electronAPI.payload has build method', () => {
    const api = exposedApi['electronAPI'] as Record<string, Record<string, unknown>>;
    expect(typeof api['payload']['build']).toBe('function');
  });

  it('electronAPI.analysis has all expected methods', () => {
    const api = exposedApi['electronAPI'] as Record<string, Record<string, unknown>>;
    const analysis = api['analysis'];

    expect(typeof analysis['submit']).toBe('function');
    expect(typeof analysis['getStatus']).toBe('function');
    expect(typeof analysis['getResults']).toBe('function');
  });

  it('electronAPI.store has all v2 methods', () => {
    const api = exposedApi['electronAPI'] as Record<string, Record<string, unknown>>;
    const store = api['store'];

    expect(typeof store['getProfile']).toBe('function');
    expect(typeof store['setProfile']).toBe('function');
    expect(typeof store['clearProfile']).toBe('function');
    expect(typeof store['getPreferences']).toBe('function');
    expect(typeof store['setPreferences']).toBe('function');
    expect(typeof store['getHistory']).toBe('function');
    expect(typeof store['addHistory']).toBe('function');
  });

  it('electronAPI has apikey methods (saveApiKey, hasApiKey, clearApiKey)', () => {
    const api = exposedApi['electronAPI'] as Record<string, unknown>;

    expect(typeof api['saveApiKey']).toBe('function');
    expect(typeof api['hasApiKey']).toBe('function');
    expect(typeof api['clearApiKey']).toBe('function');
  });

  it('electronAPI.agent has runAnalysis method', () => {
    const api = exposedApi['electronAPI'] as Record<string, Record<string, unknown>>;
    expect(typeof api['agent']['runAnalysis']).toBe('function');
  });

  it('electronAPI.preferences has getDefaults method', () => {
    const api = exposedApi['electronAPI'] as Record<string, Record<string, unknown>>;
    expect(typeof api['preferences']['getDefaults']).toBe('function');
  });

  // AC-1 (P1): No credential fields exposed
  it('does not expose credential-related properties in the API', () => {
    const api = exposedApi['electronAPI'] as Record<string, unknown>;
    const json = JSON.stringify(api);

    // The API surface should not contain raw credential fields
    expect(json).not.toContain('"apiKey"');
    expect(json).not.toContain('"secret"');
    expect(json).not.toContain('"password"');
    expect(json).not.toContain('"token"');
  });

  // AC-3: IPC invoke calls resolve

  it('extraction.openView invokes correct IPC channel', async () => {
    const { ipcRenderer } = await import('electron');
    const api = exposedApi['electronAPI'] as Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;

    await api['extraction']['openView']('amazon-us');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('extraction:open-view', 'amazon-us');
  });

  it('extraction.startPipeline invokes correct IPC channel', async () => {
    const { ipcRenderer } = await import('electron');
    const api = exposedApi['electronAPI'] as Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;

    await api['extraction']['startPipeline']('us');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('extraction:start-pipeline', 'us');
  });

  it('store.getProfile invokes correct IPC channel', async () => {
    const { ipcRenderer } = await import('electron');
    const api = exposedApi['electronAPI'] as Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;

    await api['store']['getProfile']();
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('store:get-profile');
  });

  it('saveApiKey invokes correct IPC channel', async () => {
    const { ipcRenderer } = await import('electron');
    const api = exposedApi['electronAPI'] as Record<string, (...args: unknown[]) => Promise<unknown>>;

    await api['saveApiKey']('sk-test');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('apikey:save', 'sk-test');
  });

  it('agent.runAnalysis invokes correct IPC channel', async () => {
    const { ipcRenderer } = await import('electron');
    const api = exposedApi['electronAPI'] as Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;

    await api['agent']['runAnalysis']('us');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('agent:run-analysis', 'us');
  });

  it('preferences.getDefaults invokes correct IPC channel', async () => {
    const { ipcRenderer } = await import('electron');
    const api = exposedApi['electronAPI'] as Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>;

    await api['preferences']['getDefaults']('us');
    expect(ipcRenderer.invoke).toHaveBeenCalledWith('preferences:get-defaults', 'us');
  });
});

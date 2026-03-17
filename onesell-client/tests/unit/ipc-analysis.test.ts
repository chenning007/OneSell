import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock Electron's ipcMain before importing handlers ───────────────

const handlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers.set(channel, handler);
    }),
    removeHandler: vi.fn((channel: string) => {
      handlers.delete(channel);
    }),
  },
  BrowserWindow: vi.fn(),
}));

import { registerIpcHandlers, removeIpcHandlers } from '../../src/main/ipc/handlers.js';
import type { BackendClient } from '../../src/main/backend-client.js';

// ── Helpers ─────────────────────────────────────────────────────────

function createMockBackendClient() {
  return {
    submitAnalysis: vi.fn().mockResolvedValue({ analysisId: 'test-id', status: 'pending' }),
    getAnalysisStatus: vi.fn().mockResolvedValue({ analysisId: 'test-id', status: 'complete' }),
    getAnalysisResults: vi.fn().mockResolvedValue({ analysisId: 'test-id', results: [{ p: 1 }] }),
  } as unknown as BackendClient;
}

function createMockManager() {
  return {
    openView: vi.fn(),
    closeView: vi.fn(),
    hideView: vi.fn(),
    extractFromView: vi.fn(),
    getCurrentUrl: vi.fn(),
    getOpenPlatforms: vi.fn(),
    hideAll: vi.fn(),
    destroyAll: vi.fn(),
  };
}

function invokeHandler(channel: string, ...args: unknown[]): unknown {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler for channel: ${channel}`);
  // Simulate ipcMain.handle: first arg is the event, rest are user args
  return handler({}, ...args);
}

// ── Setup / Teardown ────────────────────────────────────────────────

beforeEach(() => {
  handlers.clear();
});

afterEach(() => {
  removeIpcHandlers();
  handlers.clear();
  vi.restoreAllMocks();
});

// ── Tests ───────────────────────────────────────────────────────────

describe('IPC analysis handlers — registration', () => {
  it('registers analysis:submit, analysis:status, analysis:results when backendClient is provided', () => {
    const manager = createMockManager();
    const backendClient = createMockBackendClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerIpcHandlers({} as any, manager as any, undefined, backendClient);

    expect(handlers.has('analysis:submit')).toBe(true);
    expect(handlers.has('analysis:status')).toBe(true);
    expect(handlers.has('analysis:results')).toBe(true);
  });

  it('does NOT register analysis handlers when backendClient is omitted', () => {
    const manager = createMockManager();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerIpcHandlers({} as any, manager as any);

    expect(handlers.has('analysis:submit')).toBe(false);
    expect(handlers.has('analysis:status')).toBe(false);
    expect(handlers.has('analysis:results')).toBe(false);
  });

  it('removeIpcHandlers removes analysis channels', () => {
    const manager = createMockManager();
    const backendClient = createMockBackendClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerIpcHandlers({} as any, manager as any, undefined, backendClient);

    expect(handlers.has('analysis:submit')).toBe(true);
    removeIpcHandlers();
    expect(handlers.has('analysis:submit')).toBe(false);
    expect(handlers.has('analysis:status')).toBe(false);
    expect(handlers.has('analysis:results')).toBe(false);
  });
});

describe('IPC analysis:submit', () => {
  it('validates payload and calls backendClient.submitAnalysis', async () => {
    const manager = createMockManager();
    const backendClient = createMockBackendClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerIpcHandlers({} as any, manager as any, undefined, backendClient);

    const payload = {
      extractionData: [{ platformId: 'amazon-us', available: true }],
      preferences: { budget: 500, riskTolerance: 'medium' as const },
      marketId: 'us',
    };

    const result = await invokeHandler('analysis:submit', payload);

    expect(backendClient.submitAnalysis).toHaveBeenCalledWith(payload);
    expect(result).toEqual({ analysisId: 'test-id', status: 'pending' });
  });

  it('rejects invalid payload (missing extractionData)', async () => {
    const manager = createMockManager();
    const backendClient = createMockBackendClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerIpcHandlers({} as any, manager as any, undefined, backendClient);

    await expect(
      invokeHandler('analysis:submit', { preferences: {}, marketId: 'us' }),
    ).rejects.toThrow();

    expect(backendClient.submitAnalysis).not.toHaveBeenCalled();
  });

  it('rejects if extractionData array is empty', async () => {
    const manager = createMockManager();
    const backendClient = createMockBackendClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerIpcHandlers({} as any, manager as any, undefined, backendClient);

    await expect(
      invokeHandler('analysis:submit', {
        extractionData: [],
        preferences: {},
        marketId: 'us',
      }),
    ).rejects.toThrow();
  });

  it('rejects if marketId is missing', async () => {
    const manager = createMockManager();
    const backendClient = createMockBackendClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerIpcHandlers({} as any, manager as any, undefined, backendClient);

    await expect(
      invokeHandler('analysis:submit', {
        extractionData: [{ platformId: 'x', available: true }],
        preferences: {},
      }),
    ).rejects.toThrow();
  });
});

describe('IPC analysis:status', () => {
  it('validates UUID and calls backendClient.getAnalysisStatus', async () => {
    const manager = createMockManager();
    const backendClient = createMockBackendClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerIpcHandlers({} as any, manager as any, undefined, backendClient);

    const uuid = '00000000-0000-0000-0000-000000000001';
    const result = await invokeHandler('analysis:status', uuid);

    expect(backendClient.getAnalysisStatus).toHaveBeenCalledWith(uuid);
    expect(result).toEqual({ analysisId: 'test-id', status: 'complete' });
  });

  it('rejects non-UUID analysisId', async () => {
    const manager = createMockManager();
    const backendClient = createMockBackendClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerIpcHandlers({} as any, manager as any, undefined, backendClient);

    await expect(
      invokeHandler('analysis:status', 'not-a-uuid'),
    ).rejects.toThrow();

    expect(backendClient.getAnalysisStatus).not.toHaveBeenCalled();
  });

  it('rejects non-string input', async () => {
    const manager = createMockManager();
    const backendClient = createMockBackendClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerIpcHandlers({} as any, manager as any, undefined, backendClient);

    await expect(invokeHandler('analysis:status', 12345)).rejects.toThrow();
  });
});

describe('IPC analysis:results', () => {
  it('validates UUID and calls backendClient.getAnalysisResults', async () => {
    const manager = createMockManager();
    const backendClient = createMockBackendClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerIpcHandlers({} as any, manager as any, undefined, backendClient);

    const uuid = '00000000-0000-0000-0000-000000000001';
    const result = await invokeHandler('analysis:results', uuid);

    expect(backendClient.getAnalysisResults).toHaveBeenCalledWith(uuid);
    expect(result).toEqual({ analysisId: 'test-id', results: [{ p: 1 }] });
  });

  it('rejects non-UUID analysisId', async () => {
    const manager = createMockManager();
    const backendClient = createMockBackendClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    registerIpcHandlers({} as any, manager as any, undefined, backendClient);

    await expect(
      invokeHandler('analysis:results', 'invalid'),
    ).rejects.toThrow();

    expect(backendClient.getAnalysisResults).not.toHaveBeenCalled();
  });
});

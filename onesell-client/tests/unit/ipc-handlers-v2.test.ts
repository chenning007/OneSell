/**
 * F-08 (#212) — IPC handlers v2 unit tests.
 *
 * AC:
 *   1. Each channel handler rejects malformed input with Zod error
 *   2. Valid input reaches expected service method
 *   3. No unhandled promise rejections
 *
 * Scope: store:* and apikey:* IPC handlers.
 * Mocks: LocalStore and ApiKeyManager.
 *
 * Principles:
 *   P2 — No analysis/scoring logic in IPC handlers
 *   P9 — Zod validation at IPC boundary
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';

// ── Mock electron before importing handlers ─────────────────────────

vi.mock('electron', () => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  return {
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler);
      }),
      removeHandler: vi.fn((channel: string) => {
        handlers.delete(channel);
      }),
      _handlers: handlers,
    },
    BrowserWindow: vi.fn(),
    safeStorage: {
      encryptString: vi.fn(),
      decryptString: vi.fn(),
      isEncryptionAvailable: vi.fn(() => true),
    },
  };
});

// Mock the registry import used by handlers
vi.mock('../../src/main/extraction/ExtractionScriptRegistry.js', () => ({
  registry: { getScriptIds: () => [] },
}));

// Mock market configs used by handlers
vi.mock('../../src/renderer/config/markets.js', () => ({
  MARKET_CONFIGS: {
    us: { marketId: 'us', language: 'en-US', currency: 'USD', flag: '🇺🇸', i18nLang: 'en', platforms: ['amazon-us'] },
  },
  BUDGET_RANGES: {
    us: { min: 50, mid: 200, max: 500, currency: 'USD', symbol: '$' },
  },
}));

import { registerIpcHandlers, removeIpcHandlers } from '../../src/main/ipc/handlers.js';

// ── Mock services ───────────────────────────────────────────────────

function createMockLocalStore() {
  return {
    getProfile: vi.fn(() => null),
    setProfile: vi.fn(),
    clearProfile: vi.fn(),
    getPreferences: vi.fn(() => ({})),
    setPreferences: vi.fn(),
    getHistory: vi.fn(() => []),
    addHistoryEntry: vi.fn(),
  };
}

function createMockApiKeyManager() {
  return {
    saveKey: vi.fn(),
    hasKey: vi.fn(() => false),
    clearKey: vi.fn(),
  };
}

function createMockExtractionManager() {
  return {
    openView: vi.fn(),
    closeView: vi.fn(),
    hideView: vi.fn(),
    extractFromView: vi.fn(),
    getCurrentUrl: vi.fn(),
    getOpenPlatforms: vi.fn(() => []),
    hideAll: vi.fn(),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

type HandlersMap = Map<string, (...args: unknown[]) => unknown>;

function getHandler(channel: string): (...args: unknown[]) => unknown {
  const handlers = (ipcMain as unknown as { _handlers: HandlersMap })._handlers;
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler registered for channel: ${channel}`);
  return handler;
}

/** Invoke a handler the way Electron would: (_event, ...args) */
async function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = getHandler(channel);
  return handler({}, ...args);
}

// ── Setup / Teardown ────────────────────────────────────────────────

let mockStore: ReturnType<typeof createMockLocalStore>;
let mockApiKey: ReturnType<typeof createMockApiKeyManager>;
let mockManager: ReturnType<typeof createMockExtractionManager>;

beforeEach(() => {
  (ipcMain as unknown as { _handlers: HandlersMap })._handlers.clear();
  (ipcMain.handle as ReturnType<typeof vi.fn>).mockClear();

  mockStore = createMockLocalStore();
  mockApiKey = createMockApiKeyManager();
  mockManager = createMockExtractionManager();

  registerIpcHandlers(
    {} as BrowserWindow,
    mockManager as never,
    undefined,         // payloadBuilder
    undefined,         // backendClient
    mockStore as never,
    mockApiKey as never,
  );
});

afterEach(() => {
  removeIpcHandlers();
});

// ═══════════════════════════════════════════════════════════════════
// AC-1: Reject malformed input with Zod error
// ═══════════════════════════════════════════════════════════════════

describe('IPC handlers — Zod validation rejects bad input (AC-1)', () => {

  // ── store:set-profile ───────────────────────────────────────────

  it('store:set-profile rejects missing fields', async () => {
    const result = await invoke('store:set-profile', { marketId: 'us' });
    expect(result).toHaveProperty('error', true);
    expect(result).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  it('store:set-profile rejects non-object input', async () => {
    const result = await invoke('store:set-profile', 'not-an-object');
    expect(result).toHaveProperty('error', true);
  });

  it('store:set-profile rejects invalid extractionMode', async () => {
    const result = await invoke('store:set-profile', {
      marketId: 'us',
      extractionMode: 'manual',  // only 'auto-discover' allowed
      lastSessionAt: '2026-03-01T00:00:00Z',
    });
    expect(result).toHaveProperty('error', true);
  });

  // ── store:set-preferences ───────────────────────────────────────

  it('store:set-preferences rejects invalid riskTolerance', async () => {
    const result = await invoke('store:set-preferences', {
      riskTolerance: 'extreme',
    });
    expect(result).toHaveProperty('error', true);
  });

  // ── store:add-history ───────────────────────────────────────────

  it('store:add-history rejects negative productCount', async () => {
    const result = await invoke('store:add-history', {
      sessionId: 'sess-1',
      marketId: 'us',
      timestamp: '2026-03-01T00:00:00Z',
      productCount: -1,
      categoryCount: 3,
    });
    expect(result).toHaveProperty('error', true);
  });

  it('store:add-history rejects missing sessionId', async () => {
    const result = await invoke('store:add-history', {
      marketId: 'us',
      timestamp: '2026-03-01T00:00:00Z',
      productCount: 10,
      categoryCount: 3,
    });
    expect(result).toHaveProperty('error', true);
  });

  // ── apikey:save ─────────────────────────────────────────────────

  it('apikey:save rejects empty string', async () => {
    const result = await invoke('apikey:save', '');
    expect(result).toHaveProperty('error', true);
    expect(result).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  it('apikey:save rejects non-string input', async () => {
    const result = await invoke('apikey:save', 12345);
    expect(result).toHaveProperty('error', true);
  });

  // ── extraction:start-pipeline ───────────────────────────────────

  it('extraction:start-pipeline rejects empty marketId', async () => {
    const result = await invoke('extraction:start-pipeline', '');
    expect(result).toHaveProperty('error', true);
  });

  // ── extraction:toggle-platform ──────────────────────────────────

  it('extraction:toggle-platform rejects missing enabled flag', async () => {
    const result = await invoke('extraction:toggle-platform', {
      platformId: 'amazon-us',
    });
    expect(result).toHaveProperty('error', true);
  });

  it('extraction:toggle-platform rejects invalid platformId format', async () => {
    const result = await invoke('extraction:toggle-platform', {
      platformId: 'INVALID!!',
      enabled: true,
    });
    expect(result).toHaveProperty('error', true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// AC-2: Valid input reaches expected service method
// ═══════════════════════════════════════════════════════════════════

describe('IPC handlers — valid input routes to service (AC-2)', () => {

  // ── store channels ──────────────────────────────────────────────

  it('store:get-profile calls localStore.getProfile()', async () => {
    await invoke('store:get-profile');
    expect(mockStore.getProfile).toHaveBeenCalledOnce();
  });

  it('store:set-profile with valid data calls localStore.setProfile()', async () => {
    const validProfile = {
      marketId: 'us',
      extractionMode: 'auto-discover',
      lastSessionAt: '2026-03-01T00:00:00Z',
    };
    const result = await invoke('store:set-profile', validProfile);
    expect(result).toEqual({ ok: true });
    expect(mockStore.setProfile).toHaveBeenCalledWith(validProfile);
  });

  it('store:clear-profile calls localStore.clearProfile()', async () => {
    const result = await invoke('store:clear-profile');
    expect(result).toEqual({ ok: true });
    expect(mockStore.clearProfile).toHaveBeenCalledOnce();
  });

  it('store:get-preferences calls localStore.getPreferences()', async () => {
    await invoke('store:get-preferences');
    expect(mockStore.getPreferences).toHaveBeenCalledOnce();
  });

  it('store:set-preferences with valid data calls localStore.setPreferences()', async () => {
    const validPrefs = { riskTolerance: 'low' };
    const result = await invoke('store:set-preferences', validPrefs);
    expect(result).toEqual({ ok: true });
    expect(mockStore.setPreferences).toHaveBeenCalledOnce();
  });

  it('store:get-history calls localStore.getHistory()', async () => {
    await invoke('store:get-history');
    expect(mockStore.getHistory).toHaveBeenCalledOnce();
  });

  it('store:add-history with valid data calls localStore.addHistoryEntry()', async () => {
    const validEntry = {
      sessionId: 'sess-1',
      marketId: 'us',
      timestamp: '2026-03-01T00:00:00Z',
      productCount: 10,
      categoryCount: 3,
    };
    const result = await invoke('store:add-history', validEntry);
    expect(result).toEqual({ ok: true });
    expect(mockStore.addHistoryEntry).toHaveBeenCalledWith(validEntry);
  });

  // ── apikey channels ─────────────────────────────────────────────

  it('apikey:save with valid key calls apiKeyManager.saveKey()', async () => {
    const result = await invoke('apikey:save', 'sk-valid-key');
    expect(result).toEqual({ ok: true });
    expect(mockApiKey.saveKey).toHaveBeenCalledWith('sk-valid-key');
  });

  it('apikey:get-status calls apiKeyManager.hasKey()', async () => {
    mockApiKey.hasKey.mockReturnValue(true);
    const result = await invoke('apikey:get-status');
    expect(result).toEqual({ hasKey: true });
    expect(mockApiKey.hasKey).toHaveBeenCalledOnce();
  });

  it('apikey:clear calls apiKeyManager.clearKey()', async () => {
    const result = await invoke('apikey:clear');
    expect(result).toEqual({ ok: true });
    expect(mockApiKey.clearKey).toHaveBeenCalledOnce();
  });
});

// ═══════════════════════════════════════════════════════════════════
// AC-3: No unhandled promise rejections
// ═══════════════════════════════════════════════════════════════════

describe('IPC handlers — no unhandled promise rejections (AC-3)', () => {
  it('apikey:save returns structured error when saveKey throws', async () => {
    mockApiKey.saveKey.mockImplementation(() => {
      throw new Error('Encryption unavailable');
    });
    const result = await invoke('apikey:save', 'sk-valid-key');
    expect(result).toHaveProperty('error', true);
    expect(result).toHaveProperty('code', 'SAVE_FAILED');
    expect(result).toHaveProperty('message', 'Encryption unavailable');
  });

  it('store channels return structured error on Zod failures (not throw)', async () => {
    // These should return { error, code, message } — not throw
    const result = await invoke('store:set-profile', null);
    expect(result).toHaveProperty('error', true);
    expect(result).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  it('extraction:toggle-platform returns structured error (not throw)', async () => {
    const result = await invoke('extraction:toggle-platform', null);
    expect(result).toHaveProperty('error', true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// P2: No analysis/scoring logic in handlers
// ═══════════════════════════════════════════════════════════════════

describe('IPC handlers — P2 separation of concerns', () => {
  it('store:set-profile handler does not modify or analyse data', async () => {
    const input = {
      marketId: 'us',
      extractionMode: 'auto-discover' as const,
      lastSessionAt: '2026-03-01T00:00:00Z',
    };
    await invoke('store:set-profile', input);
    // setProfile called with the exact same data — no scoring added
    expect(mockStore.setProfile).toHaveBeenCalledWith(input);
  });
});

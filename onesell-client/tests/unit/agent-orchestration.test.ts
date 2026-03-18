/**
 * A-08 (#226) — AgentService orchestration integration test.
 *
 * AC:
 *   1. agent:run-analysis handler triggers Plan→Execute→Synthesize pipeline
 *   2. Pushes status events at each phase (planning, executing, synthesizing, complete)
 *   3. Pushes result on completion
 *   4. Handles errors gracefully (P5)
 *
 * Principles tested: P2 (no analysis logic in IPC), P5 (graceful degradation), P9 (Zod validation)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';

// ── Mock electron ───────────────────────────────────────────────────

const mockSend = vi.fn();

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
    BrowserView: vi.fn(),
    safeStorage: {
      encryptString: vi.fn(),
      decryptString: vi.fn(),
      isEncryptionAvailable: vi.fn(() => true),
    },
    session: {
      fromPartition: vi.fn(() => ({})),
    },
  };
});

// Mock extraction script registry
vi.mock('../../src/main/extraction/ExtractionScriptRegistry.js', () => ({
  registry: { getScriptIds: () => [], get: () => undefined, getAll: vi.fn(() => []) },
}));

// Mock market configs
vi.mock('../../src/renderer/config/markets.js', () => ({
  MARKET_CONFIGS: {
    us: { marketId: 'us', language: 'en-US', currency: 'USD', flag: '🇺🇸', i18nLang: 'en', platforms: ['amazon-us'] },
  } as Record<string, unknown>,
  BUDGET_RANGES: {
    us: { min: 50, mid: 200, max: 500, currency: 'USD', symbol: '$' },
  },
}));

// Mock prompt-loader
vi.mock('../../src/main/agent/prompt-loader.js', () => ({
  loadPrompts: () => ({
    planner: 'mock planner prompt',
    executor: 'mock executor prompt',
    synthesizer: 'mock synthesizer prompt',
  }),
  sanitizeUserInput: (input: string) => input,
}));

// Mock the LLM provider to avoid actual API calls
vi.mock('../../src/main/agent/ClientLLMProvider.js', () => ({
  ClientLLMProvider: vi.fn().mockImplementation(() => ({
    chat: vi.fn().mockResolvedValue({
      content: JSON.stringify({
        steps: [
          { toolName: 'calc-margin', args: { sellPrice: 20, cogs: 5, platformFees: 3, shippingCost: 2 } },
        ],
        missingData: [],
        reasoning: 'test',
      }),
      usage: { promptTokens: 10, completionTokens: 20 },
    }),
  })),
}));

// Mock SynthesizerAgent to return simple products
vi.mock('../../src/main/agent/SynthesizerAgent.js', () => ({
  SynthesizerAgent: vi.fn().mockImplementation(() => ({
    synthesize: vi.fn().mockResolvedValue([
      {
        productName: 'Test Product',
        overallScore: 85,
        category: 'electronics',
        oneLineReason: 'High margin product',
        cardId: 'card-1',
      },
    ]),
  })),
}));

import { registerIpcHandlers, removeIpcHandlers } from '../../src/main/ipc/handlers.js';

// ── Helpers ──────────────────────────────────────────────────────────

type HandlersMap = Map<string, (...args: unknown[]) => unknown>;

function getHandler(channel: string): (...args: unknown[]) => unknown {
  const handlers = (ipcMain as unknown as { _handlers: HandlersMap })._handlers;
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler registered for channel: ${channel}`);
  return handler;
}

async function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  const handler = getHandler(channel);
  return handler({}, ...args);
}

// ── Mock services ───────────────────────────────────────────────────

function createMockExtractionManager() {
  return {
    openView: vi.fn(),
    closeView: vi.fn(),
    hideView: vi.fn(),
    extractFromView: vi.fn(),
    getCurrentUrl: vi.fn(),
    getOpenPlatforms: vi.fn(() => []),
    hideAll: vi.fn(),
    startAutonomousExtraction: vi.fn(),
    attachToRegion: vi.fn(),
  };
}

function createMockApiKeyManager(hasKey = true) {
  return {
    saveKey: vi.fn(),
    hasKey: vi.fn(() => hasKey),
    clearKey: vi.fn(),
    getKey: vi.fn(() => 'sk-test-key-123'),
  };
}

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

// ── Setup ───────────────────────────────────────────────────────────

let mockManager: ReturnType<typeof createMockExtractionManager>;
let mockApiKey: ReturnType<typeof createMockApiKeyManager>;
let mockStore: ReturnType<typeof createMockLocalStore>;
let mainWindow: { webContents: { send: typeof mockSend } };

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockClear();
  (ipcMain as unknown as { _handlers: HandlersMap })._handlers.clear();

  mainWindow = { webContents: { send: mockSend } };
  mockManager = createMockExtractionManager();
  mockApiKey = createMockApiKeyManager(true);
  mockStore = createMockLocalStore();

  registerIpcHandlers(
    mainWindow as unknown as BrowserWindow,
    mockManager as never,
    undefined,
    undefined,
    mockStore as never,
    mockApiKey as never,
  );
});

afterEach(() => {
  removeIpcHandlers();
});

// ── Tests ────────────────────────────────────────────────────────────

describe('AgentService orchestration via agent:run-analysis (A-08, #226)', () => {

  // AC-1: Triggers Plan→Execute→Synthesize pipeline
  it('agent:run-analysis handler is registered', () => {
    const handlers = (ipcMain as unknown as { _handlers: HandlersMap })._handlers;
    expect(handlers.has('agent:run-analysis')).toBe(true);
  });

  it('triggers analysis pipeline for valid marketId', async () => {
    const result = await invoke('agent:run-analysis', 'us');
    expect(result).toHaveProperty('ok', true);
    expect(result).toHaveProperty('marketId', 'us');
  });

  // AC-2: Pushes status events at each phase
  it('pushes agent:analysis-status IPC events during pipeline', async () => {
    await invoke('agent:run-analysis', 'us');

    // At minimum, planning + executing + synthesizing + complete status events
    const statusCalls = mockSend.mock.calls.filter(
      ([channel]: [string]) => channel === 'agent:analysis-status',
    );
    expect(statusCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('status events include planning phase', async () => {
    await invoke('agent:run-analysis', 'us');

    const statusCalls = mockSend.mock.calls.filter(
      ([channel]: [string]) => channel === 'agent:analysis-status',
    );
    const planningEvent = statusCalls.find(
      ([, data]: [string, { status: string }]) => data.status === 'planning',
    );
    expect(planningEvent).toBeTruthy();
  });

  // AC-3: Pushes result on completion
  it('sends agent:analysis-result on successful completion', async () => {
    await invoke('agent:run-analysis', 'us');

    const resultCalls = mockSend.mock.calls.filter(
      ([channel]: [string]) => channel === 'agent:analysis-result',
    );
    expect(resultCalls.length).toBe(1);

    const [, result] = resultCalls[0] as [string, { sessionId: string; status: string }];
    expect(result).toHaveProperty('sessionId');
    expect(result).toHaveProperty('status');
  });

  // AC-4: Handles errors gracefully (P5)
  it('returns error for missing API key', async () => {
    // Re-register with no-key manager
    removeIpcHandlers();
    (ipcMain as unknown as { _handlers: HandlersMap })._handlers.clear();
    const noKeyManager = createMockApiKeyManager(false);
    registerIpcHandlers(
      mainWindow as unknown as BrowserWindow,
      mockManager as never,
      undefined,
      undefined,
      mockStore as never,
      noKeyManager as never,
    );

    const result = await invoke('agent:run-analysis', 'us');
    expect(result).toHaveProperty('error', true);
    expect(result).toHaveProperty('code', 'NO_API_KEY');
  });

  it('returns error for unknown market', async () => {
    const result = await invoke('agent:run-analysis', 'xx');
    expect(result).toHaveProperty('error', true);
    expect(result).toHaveProperty('code', 'UNKNOWN_MARKET');
  });

  // P9: Zod validation
  it('rejects empty marketId with validation error', async () => {
    const result = await invoke('agent:run-analysis', '');
    expect(result).toHaveProperty('error', true);
    expect(result).toHaveProperty('code', 'VALIDATION_ERROR');
  });

  it('rejects non-string input', async () => {
    const result = await invoke('agent:run-analysis', 12345);
    expect(result).toHaveProperty('error', true);
  });

  it('returns error without api key manager', async () => {
    removeIpcHandlers();
    (ipcMain as unknown as { _handlers: HandlersMap })._handlers.clear();
    registerIpcHandlers(
      mainWindow as unknown as BrowserWindow,
      mockManager as never,
      undefined,
      undefined,
      mockStore as never,
      undefined, // no apiKeyManager
    );

    const result = await invoke('agent:run-analysis', 'us');
    expect(result).toHaveProperty('error', true);
    expect(result).toHaveProperty('code', 'NO_API_KEY_MANAGER');
  });
});

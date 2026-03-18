/**
 * E-20 (#274) — Extraction progress events test (ExtractionManager).
 *
 * AC:
 *   1. onProgress callback wired in extractFromView
 *   2. Events forwarded via IPC emitter in startAutonomousExtraction
 *   3. Existing scripts work without callback (backward compat)
 *
 * Principles tested: P5 (graceful degradation), P6 (script isolation)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock electron ───────────────────────────────────────────────────

const mockSetBounds = vi.fn();
const mockLoadURL = vi.fn().mockResolvedValue(undefined);
const mockGetURL = vi.fn(() => 'https://trends.google.com');
const mockExecuteJavaScript = vi.fn();
const mockDestroy = vi.fn();
const mockOnce = vi.fn();
const mockRemoveListener = vi.fn();
const mockWebContentsOn = vi.fn();

vi.mock('electron', () => {
  return {
    BrowserView: vi.fn().mockImplementation(() => ({
      setBounds: mockSetBounds,
      webContents: {
        loadURL: mockLoadURL,
        getURL: mockGetURL,
        executeJavaScript: mockExecuteJavaScript,
        destroy: mockDestroy,
        once: mockOnce,
        removeListener: mockRemoveListener,
        on: mockWebContentsOn,
      },
    })),
    BrowserWindow: vi.fn(),
    session: {
      fromPartition: vi.fn(() => ({})),
    },
  };
});

vi.mock('../../src/main/extraction/ExtractionScriptRegistry.js', () => ({
  registry: {
    get: vi.fn((id: string) => {
      if (id === 'google-trends') {
        return {
          platformId: 'google-trends',
          homeUrl: 'https://trends.google.com',
          extractFromPage: () => ({
            platformId: 'google-trends',
            scrapedAt: new Date().toISOString(),
            data: { listings: [{ name: 'Widget' }] },
          }),
        };
      }
      return undefined;
    }),
    getAll: vi.fn(() => []),
  },
}));

vi.mock('../../src/renderer/config/markets.js', () => ({
  MARKET_CONFIGS: {
    us: {
      marketId: 'us',
      language: 'en-US',
      currency: 'USD',
      flag: '🇺🇸',
      i18nLang: 'en',
      platforms: ['google-trends'],
    },
  } as Record<string, unknown>,
  BUDGET_RANGES: {},
}));

import { ExtractionManager } from '../../src/main/extraction/ExtractionManager.js';
import type { ExtractionEventEmitter, ExtractionProgressCallback } from '../../src/main/extraction/ExtractionManager.js';
import { BrowserWindow } from 'electron';

// ── Helpers ──────────────────────────────────────────────────────────

function createMockMainWindow() {
  return {
    addBrowserView: vi.fn(),
    removeBrowserView: vi.fn(),
    getContentBounds: vi.fn(() => ({ x: 0, y: 0, width: 1200, height: 800 })),
  } as unknown as BrowserWindow;
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Extraction progress events (E-20, #274)', () => {
  let manager: ExtractionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new ExtractionManager(createMockMainWindow());
  });

  // TC-1: onProgress callback is accepted by extractFromView
  it('extractFromView accepts onProgress callback', async () => {
    const onProgress: ExtractionProgressCallback = vi.fn();

    // Open a view first
    manager.openView('google-trends');

    // Mock successful extraction
    mockExecuteJavaScript.mockResolvedValueOnce(
      JSON.stringify({
        __debug_null: false,
        payload: {
          platformId: 'google-trends',
          scrapedAt: '2026-03-15T10:00:00Z',
          data: { listings: [{ name: 'Widget' }] },
        },
      }),
    );

    const data = await manager.extractFromView('google-trends', onProgress);
    expect(data).not.toBeNull();
    expect(data!.platformId).toBe('google-trends');
  });

  // TC-2: Events forwarded via IPC emitter in startAutonomousExtraction
  it('startAutonomousExtraction wires onProgress and emits progress events', async () => {
    const emitter: ExtractionEventEmitter = {
      pipelineUpdate: vi.fn(),
      progressEvent: vi.fn(),
    };

    // Mock did-finish-load
    mockOnce.mockImplementation((_event: string, cb: () => void) => {
      setTimeout(cb, 5);
    });

    // Mock extraction result
    mockExecuteJavaScript.mockResolvedValueOnce(
      JSON.stringify({
        __debug_null: false,
        payload: {
          platformId: 'google-trends',
          scrapedAt: '2026-03-15T10:00:00Z',
          data: { listings: [{ name: 'Widget' }] },
        },
      }),
    );

    await manager.startAutonomousExtraction('us', emitter);

    // Emitter should have received progress events about the extraction
    expect(emitter.progressEvent).toHaveBeenCalled();
    expect(emitter.pipelineUpdate).toHaveBeenCalledWith('google-trends', expect.objectContaining({ status: 'active' }));
    expect(emitter.pipelineUpdate).toHaveBeenCalledWith('google-trends', expect.objectContaining({ status: 'done' }));
  });

  // TC-3: Existing scripts work without callback (backward compat)
  it('extractFromView works without onProgress callback', async () => {
    manager.openView('google-trends');

    mockExecuteJavaScript.mockResolvedValueOnce(
      JSON.stringify({
        __debug_null: false,
        payload: {
          platformId: 'google-trends',
          scrapedAt: '2026-03-15T10:00:00Z',
          data: { listings: [{ name: 'Widget' }] },
        },
      }),
    );

    // Call without onProgress — should not throw
    const data = await manager.extractFromView('google-trends');
    expect(data).not.toBeNull();
    expect(data!.platformId).toBe('google-trends');
  });

  it('returns null for unknown platform (P5 graceful degradation)', async () => {
    const data = await manager.extractFromView('unknown-platform');
    expect(data).toBeNull();
  });
});

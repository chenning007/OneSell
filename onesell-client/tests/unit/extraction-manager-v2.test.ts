/**
 * E-14 (#250) — ExtractionManager v2 unit tests.
 *
 * AC:
 *   1. attachToRegion positions BrowserView within given bounds
 *   2. startAutonomousExtraction orchestrates extraction sequence
 *   3. startAutonomousExtraction emits pipeline-update IPC events
 *   4. startAutonomousExtraction emits progress-event IPC events
 *   5. Partial failure: one platform error doesn't stop others (P5)
 *
 * Principles tested: P1 (isolated sessions), P5 (graceful degradation), P6 (script isolation)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock electron before importing ExtractionManager ────────────────

const mockSetBounds = vi.fn();
const mockLoadURL = vi.fn().mockResolvedValue(undefined);
const mockGetURL = vi.fn(() => 'https://trends.google.com');
const mockExecuteJavaScript = vi.fn();
const mockDestroy = vi.fn();
const mockOnce = vi.fn();
const mockOn = vi.fn();
const mockRemoveListener = vi.fn();

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
        on: mockOn,
        removeListener: mockRemoveListener,
      },
    })),
    BrowserWindow: vi.fn(),
    session: {
      fromPartition: vi.fn(() => ({})),
    },
  };
});

// Mock registry — return scripts for google-trends (public) and amazon-us (auth)
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
      if (id === 'amazon-us') {
        return {
          platformId: 'amazon-us',
          homeUrl: 'https://amazon.com',
          extractFromPage: () => ({
            platformId: 'amazon-us',
            scrapedAt: new Date().toISOString(),
            data: { listings: [{ name: 'Gadget' }, { name: 'Gizmo' }] },
          }),
        };
      }
      return undefined;
    }),
    getAll: vi.fn(() => []),
  },
}));

// Mock market configs — us market with one public + one auth platform
vi.mock('../../src/renderer/config/markets.js', () => ({
  MARKET_CONFIGS: {
    us: {
      marketId: 'us',
      language: 'en-US',
      currency: 'USD',
      flag: '🇺🇸',
      i18nLang: 'en',
      platforms: ['google-trends', 'amazon-us'],
    },
  } as Record<string, unknown>,
  BUDGET_RANGES: {},
}));

import { ExtractionManager } from '../../src/main/extraction/ExtractionManager.js';
import type { ExtractionEventEmitter, ViewBounds } from '../../src/main/extraction/ExtractionManager.js';
import { BrowserWindow } from 'electron';

// ── Helpers ──────────────────────────────────────────────────────────

function createMockMainWindow() {
  return {
    addBrowserView: vi.fn(),
    removeBrowserView: vi.fn(),
    getContentBounds: vi.fn(() => ({ x: 0, y: 0, width: 1200, height: 800 })),
    webContents: { send: vi.fn() },
  } as unknown as BrowserWindow;
}

function createMockEmitter(): ExtractionEventEmitter & {
  pipelineCalls: Array<{ platformId: string; update: Record<string, unknown> }>;
  progressCalls: Array<{ platformId: string; message: string; field?: string }>;
} {
  const pipelineCalls: Array<{ platformId: string; update: Record<string, unknown> }> = [];
  const progressCalls: Array<{ platformId: string; message: string; field?: string }> = [];
  return {
    pipelineCalls,
    progressCalls,
    pipelineUpdate(platformId: string, update: Record<string, unknown>) {
      pipelineCalls.push({ platformId, update });
    },
    progressEvent(platformId: string, message: string, field?: string) {
      progressCalls.push({ platformId, message, field });
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('ExtractionManager v2 (E-14, #250)', () => {
  let manager: ExtractionManager;
  let mainWindow: ReturnType<typeof createMockMainWindow>;

  beforeEach(() => {
    vi.clearAllMocks();
    mainWindow = createMockMainWindow();
    manager = new ExtractionManager(mainWindow as unknown as BrowserWindow);

    // Make once() immediately call the callback to simulate did-finish-load
    mockOnce.mockImplementation((_event: string, cb: () => void) => {
      cb();
    });

    // Default: executeJavaScript returns successful extraction
    mockExecuteJavaScript.mockResolvedValue(
      JSON.stringify({
        __debug_null: false,
        payload: {
          platformId: 'google-trends',
          scrapedAt: '2026-03-18T00:00:00Z',
          data: { listings: [{ name: 'Widget' }] },
        },
      }),
    );
  });

  // ── AC-1: attachToRegion ──────────────────────────────────────────

  describe('attachToRegion', () => {
    it('positions BrowserView within bounds', () => {
      // First create a view
      manager.openView('google-trends');

      const bounds: ViewBounds = { x: 100, y: 200, w: 600, h: 400 };
      manager.attachToRegion('google-trends', bounds);

      expect(mockSetBounds).toHaveBeenCalledWith({
        x: 100,
        y: 200,
        width: 600,
        height: 400,
      });
    });

    it('rounds fractional bounds to integers', () => {
      manager.openView('google-trends');
      manager.attachToRegion('google-trends', { x: 10.7, y: 20.3, w: 300.5, h: 200.9 });

      expect(mockSetBounds).toHaveBeenCalledWith({
        x: 11,
        y: 20,
        width: 301,
        height: 201,
      });
    });

    it('does not throw if view does not exist yet', () => {
      expect(() => {
        manager.attachToRegion('nonexistent', { x: 0, y: 0, w: 100, h: 100 });
      }).not.toThrow();
    });
  });

  // ── AC-2: startAutonomousExtraction orchestrates sequence ─────────

  describe('startAutonomousExtraction', () => {
    it('returns a results map for all platforms', async () => {
      const emitter = createMockEmitter();
      const results = await manager.startAutonomousExtraction('us', emitter);

      expect(results).toBeInstanceOf(Map);
      // google-trends is public → extracted
      expect(results.has('google-trends')).toBe(true);
      // amazon-us is auth-required → null (not extracted)
      expect(results.has('amazon-us')).toBe(true);
      expect(results.get('amazon-us')).toBeNull();
    });

    it('processes public platforms before auth-required ones', async () => {
      const emitter = createMockEmitter();
      await manager.startAutonomousExtraction('us', emitter);

      // Public platform (google-trends) should get 'active' status
      const googleActive = emitter.pipelineCalls.find(
        (c) => c.platformId === 'google-trends' && c.update['status'] === 'active',
      );
      expect(googleActive).toBeTruthy();

      // Auth-required (amazon-us) should get 'needs-login'
      const amazonNeedsLogin = emitter.pipelineCalls.find(
        (c) => c.platformId === 'amazon-us' && c.update['status'] === 'needs-login',
      );
      expect(amazonNeedsLogin).toBeTruthy();
    });

    // ── AC-3: emits pipeline-update events ────────────────────────

    it('emits pipeline-update with active then done for public platforms', async () => {
      const emitter = createMockEmitter();
      await manager.startAutonomousExtraction('us', emitter);

      const googleUpdates = emitter.pipelineCalls.filter((c) => c.platformId === 'google-trends');
      const statuses = googleUpdates.map((c) => c.update['status']);
      expect(statuses).toContain('active');
      expect(statuses).toContain('done');
    });

    it('emits pipeline-update with productCount on done', async () => {
      const emitter = createMockEmitter();
      await manager.startAutonomousExtraction('us', emitter);

      const doneUpdate = emitter.pipelineCalls.find(
        (c) => c.platformId === 'google-trends' && c.update['status'] === 'done',
      );
      expect(doneUpdate).toBeTruthy();
      expect(doneUpdate!.update).toHaveProperty('productCount');
    });

    // ── AC-4: emits progress-event events ─────────────────────────

    it('emits progress-event with extraction status messages', async () => {
      const emitter = createMockEmitter();
      await manager.startAutonomousExtraction('us', emitter);

      const googleProgress = emitter.progressCalls.filter((c) => c.platformId === 'google-trends');
      expect(googleProgress.length).toBeGreaterThanOrEqual(2); // start + page-load or complete
      expect(googleProgress.some((p) => p.message.includes('Starting extraction'))).toBe(true);
    });

    // ── AC-5: Partial failure — P5 graceful degradation ───────────

    it('continues extraction after one platform fails (P5)', async () => {
      // Spy on openView — make it throw for google-trends (first public platform)
      // This triggers the outer catch in startAutonomousExtraction, not extractFromView's catch
      const origOpenView = manager.openView.bind(manager);
      let firstCall = true;
      vi.spyOn(manager, 'openView').mockImplementation((platformId: string) => {
        if (firstCall) {
          firstCall = false;
          throw new Error('Simulated BrowserView failure');
        }
        origOpenView(platformId);
      });

      const emitter = createMockEmitter();
      // Should not throw — partial failure is graceful (P5)
      const results = await manager.startAutonomousExtraction('us', emitter);

      // google-trends should be in error state
      const errorUpdate = emitter.pipelineCalls.find(
        (c) => c.platformId === 'google-trends' && c.update['status'] === 'error',
      );
      expect(errorUpdate).toBeTruthy();

      // Still got results for all platforms (google-trends → null, amazon-us → null needs-login)
      expect(results.size).toBe(2);
      expect(results.get('google-trends')).toBeNull();
    });

    it('returns empty map for unknown market', async () => {
      const emitter = createMockEmitter();
      const results = await manager.startAutonomousExtraction('xx', emitter);
      expect(results.size).toBe(0);
    });
  });
});

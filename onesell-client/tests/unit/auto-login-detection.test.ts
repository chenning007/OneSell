/**
 * E-22 (#276) — Auto-login detection test (ExtractionManager).
 *
 * AC:
 *   1. Login URL patterns detected
 *   2. needs-login status set
 *   3. Post-login detection (navigating away from login page)
 *   4. Queued status after auth
 *
 * Principles tested: P1 (credentials stay in BrowserView), P5 (graceful degradation)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock electron ───────────────────────────────────────────────────

const mockSetBounds = vi.fn();
const mockLoadURL = vi.fn().mockResolvedValue(undefined);
let currentUrl = 'https://amazon.com/home';
const mockGetURL = vi.fn(() => currentUrl);
const mockExecuteJavaScript = vi.fn();
const mockDestroy = vi.fn();
const mockOnce = vi.fn();
const mockRemoveListener = vi.fn();

type WebContentsCallback = (...args: unknown[]) => void;
const webContentsListeners = new Map<string, WebContentsCallback[]>();

const mockWebContentsOn = vi.fn((event: string, cb: WebContentsCallback) => {
  const list = webContentsListeners.get(event) ?? [];
  list.push(cb);
  webContentsListeners.set(event, list);
});

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
      if (id === 'amazon-us') {
        return {
          platformId: 'amazon-us',
          homeUrl: 'https://amazon.com',
          extractFromPage: () => ({
            platformId: 'amazon-us',
            scrapedAt: new Date().toISOString(),
            data: { listings: [] },
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
      platforms: ['amazon-us'],
    },
  } as Record<string, unknown>,
  BUDGET_RANGES: {},
}));

import { ExtractionManager } from '../../src/main/extraction/ExtractionManager.js';
import type { ExtractionEventEmitter } from '../../src/main/extraction/ExtractionManager.js';
import { BrowserWindow } from 'electron';

// ── Helpers ──────────────────────────────────────────────────────────

function createMockMainWindow() {
  return {
    addBrowserView: vi.fn(),
    removeBrowserView: vi.fn(),
    getContentBounds: vi.fn(() => ({ x: 0, y: 0, width: 1200, height: 800 })),
  } as unknown as BrowserWindow;
}

function emitDidNavigate(url: string): void {
  const listeners = webContentsListeners.get('did-navigate') ?? [];
  for (const cb of listeners) {
    cb({}, url);
  }
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Auto-login detection (E-22, #276)', () => {
  let manager: ExtractionManager;
  let emitter: ExtractionEventEmitter;

  beforeEach(() => {
    vi.clearAllMocks();
    webContentsListeners.clear();
    currentUrl = 'https://amazon.com/home';
    manager = new ExtractionManager(createMockMainWindow());
    emitter = {
      pipelineUpdate: vi.fn(),
      progressEvent: vi.fn(),
    };
  });

  // TC-1: Login URL patterns detected
  it('detects login URL patterns (login, signin, auth, passport)', () => {
    manager.openView('amazon-us');
    manager.watchForLogin('amazon-us', emitter);

    // Navigate to a login page
    emitDidNavigate('https://amazon.com/ap/signin?openid.assoc_handle=us');

    expect(emitter.pipelineUpdate).toHaveBeenCalledWith('amazon-us', { status: 'needs-login' });
  });

  // TC-2: needs-login status set
  it('sets needs-login status when navigating to login URL', () => {
    manager.openView('amazon-us');
    manager.watchForLogin('amazon-us', emitter);

    emitDidNavigate('https://amazon.com/auth/login');

    expect(emitter.pipelineUpdate).toHaveBeenCalledWith('amazon-us', { status: 'needs-login' });
  });

  // TC-3: Post-login detection (navigating away from login)
  it('detects post-login navigation away from login page', () => {
    // Start on a non-login page, navigate to login, then away
    manager.openView('amazon-us');
    manager.watchForLogin('amazon-us', emitter);

    // Navigate to login
    emitDidNavigate('https://amazon.com/ap/signin');
    expect(emitter.pipelineUpdate).toHaveBeenCalledWith('amazon-us', { status: 'needs-login' });

    vi.mocked(emitter.pipelineUpdate).mockClear();

    // Navigate back to product page (post-login)
    emitDidNavigate('https://amazon.com/gp/bestsellers');
    expect(emitter.pipelineUpdate).toHaveBeenCalledWith('amazon-us', { status: 'queued' });
  });

  // TC-4: Queued status after auth
  it('sets queued status after user completes authentication', () => {
    manager.openView('amazon-us');
    manager.watchForLogin('amazon-us', emitter);

    // Go to login
    emitDidNavigate('https://amazon.com/ap/signin');
    vi.mocked(emitter.pipelineUpdate).mockClear();

    // Complete login — redirect to dashboard
    emitDidNavigate('https://amazon.com/dashboard');

    expect(emitter.pipelineUpdate).toHaveBeenCalledWith('amazon-us', { status: 'queued' });
  });

  it('does not emit when navigating between non-login pages', () => {
    manager.openView('amazon-us');
    manager.watchForLogin('amazon-us', emitter);

    emitDidNavigate('https://amazon.com/products');
    emitDidNavigate('https://amazon.com/bestsellers');

    // No status updates since we never entered a login page
    expect(emitter.pipelineUpdate).not.toHaveBeenCalled();
  });

  it('unwatchLogin removes listeners', () => {
    manager.openView('amazon-us');
    manager.watchForLogin('amazon-us', emitter);
    manager.unwatchLogin('amazon-us');

    expect(mockRemoveListener).toHaveBeenCalled();
  });
});

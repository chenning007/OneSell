/**
 * F-10 (#214) — Integration test: app launches without backend.
 *
 * AC:
 *   1. App initialization code runs without backend connection
 *   2. Market Selection screen would render (wizardStore step defaults)
 *   3. No network errors for backend endpoints
 *   4. IPC channels respond
 *
 * Principles:
 *   P5 — Graceful degradation (no backend = still functional)
 *   P9 — Security boundaries enforced even without backend
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Electron modules (must be before source imports) ───────────

const mockIpcMainHandlers = new Map<string, (...args: unknown[]) => unknown>();

vi.mock('electron', () => {
  const mockBrowserWindow = vi.fn().mockImplementation(() => ({
    loadURL: vi.fn().mockResolvedValue(undefined),
    loadFile: vi.fn().mockResolvedValue(undefined),
    webContents: {
      on: vi.fn(),
      openDevTools: vi.fn(),
    },
    on: vi.fn(),
    addBrowserView: vi.fn(),
    removeBrowserView: vi.fn(),
    setBounds: vi.fn(),
    getBounds: vi.fn().mockReturnValue({ x: 0, y: 0, width: 1280, height: 800 }),
  }));
  (mockBrowserWindow as unknown as Record<string, unknown>).getAllWindows = vi.fn().mockReturnValue([]);

  return {
    app: {
      whenReady: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      setPath: vi.fn(),
      commandLine: { appendSwitch: vi.fn() },
      quit: vi.fn(),
    },
    BrowserWindow: mockBrowserWindow,
    BrowserView: vi.fn().mockImplementation(() => ({
      webContents: {
        loadURL: vi.fn().mockResolvedValue(undefined),
        executeJavaScript: vi.fn().mockResolvedValue(null),
        on: vi.fn(),
        getURL: vi.fn().mockReturnValue(''),
      },
      setBounds: vi.fn(),
    })),
    ipcMain: {
      handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
        mockIpcMainHandlers.set(channel, handler);
      }),
      removeHandler: vi.fn(),
    },
    session: {
      fromPartition: vi.fn().mockReturnValue({}),
    },
    safeStorage: {
      isEncryptionAvailable: vi.fn().mockReturnValue(true),
      encryptString: vi.fn().mockReturnValue(Buffer.from('encrypted')),
      decryptString: vi.fn().mockReturnValue('sk-test-key'),
    },
    contextBridge: {
      exposeInMainWorld: vi.fn(),
    },
    ipcRenderer: {
      invoke: vi.fn().mockResolvedValue(undefined),
    },
  };
});

// Mock electron-store
vi.mock('electron-store', () => {
  const store = new Map<string, unknown>();
  return {
    default: vi.fn().mockImplementation(() => ({
      get: vi.fn((key: string) => store.get(key) ?? null),
      set: vi.fn((key: string, value: unknown) => store.set(key, value)),
    })),
  };
});

// ── Source imports (after mocks) ────────────────────────────────────

import { useWizardStore } from '../../src/renderer/store/wizardStore.js';
import { ExtractionManager } from '../../src/main/extraction/ExtractionManager.js';
import { registerIpcHandlers } from '../../src/main/ipc/handlers.js';
import { LocalStore } from '../../src/main/store/LocalStore.js';
import { ApiKeyManager } from '../../src/main/store/ApiKeyManager.js';
import { BrowserWindow, ipcMain } from 'electron';

// ── Tests ───────────────────────────────────────────────────────────

describe('Client standalone launch — no backend (F-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIpcMainHandlers.clear();
    useWizardStore.getState().reset();
  });

  // AC-1: App initialization code runs without backend connection
  it('initializes without a backend connection (backendClient=undefined)', () => {
    const win = new BrowserWindow({}) as unknown as InstanceType<typeof BrowserWindow>;
    const manager = new ExtractionManager(win);
    const localStore = new LocalStore();
    const apiKeyManager = new ApiKeyManager();

    // registerIpcHandlers should not throw when backendClient is undefined
    expect(() => {
      registerIpcHandlers(win, manager, undefined, undefined, localStore, apiKeyManager);
    }).not.toThrow();
  });

  // AC-2: Market Selection screen would render (wizardStore step defaults)
  it('wizardStore defaults to step 1 (Market Selection)', () => {
    // Fresh store defaults
    const state = useWizardStore.getState();
    expect(state.currentStep).toBe(1);
    expect(state.market).toBeNull();
    expect(state.hasProfile).toBe(false);
  });

  it('wizardStore defaults to step 0 when profile exists', () => {
    useWizardStore.getState().setHasProfile(true);
    const state = useWizardStore.getState();
    expect(state.currentStep).toBe(0);
    expect(state.hasProfile).toBe(true);
  });

  // AC-3: No network errors for backend endpoints
  it('analysis:submit is not registered when backendClient is undefined', () => {
    const win = new BrowserWindow({}) as unknown as InstanceType<typeof BrowserWindow>;
    const manager = new ExtractionManager(win);

    registerIpcHandlers(win, manager, undefined, undefined);

    // Backend-dependent channels should NOT be registered
    const registeredChannels = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as string,
    );

    expect(registeredChannels).not.toContain('analysis:submit');
    expect(registeredChannels).not.toContain('analysis:status');
    expect(registeredChannels).not.toContain('analysis:results');
  });

  // AC-4: IPC channels respond
  it('extraction IPC channels are registered without backend', () => {
    const win = new BrowserWindow({}) as unknown as InstanceType<typeof BrowserWindow>;
    const manager = new ExtractionManager(win);

    registerIpcHandlers(win, manager, undefined, undefined);

    const registeredChannels = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as string,
    );

    // Core extraction channels must always be registered
    expect(registeredChannels).toContain('extraction:open-view');
    expect(registeredChannels).toContain('extraction:close-view');
    expect(registeredChannels).toContain('extraction:hide-view');
    expect(registeredChannels).toContain('extraction:run');
    expect(registeredChannels).toContain('extraction:get-url');
    expect(registeredChannels).toContain('extraction:get-open-platforms');
    expect(registeredChannels).toContain('extraction:hide-all');
  });

  it('v2 pipeline and agent IPC channels are registered without backend', () => {
    const win = new BrowserWindow({}) as unknown as InstanceType<typeof BrowserWindow>;
    const manager = new ExtractionManager(win);

    registerIpcHandlers(win, manager, undefined, undefined);

    const registeredChannels = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as string,
    );

    expect(registeredChannels).toContain('extraction:start-pipeline');
    expect(registeredChannels).toContain('extraction:toggle-platform');
    expect(registeredChannels).toContain('agent:run-analysis');
    expect(registeredChannels).toContain('preferences:get-defaults');
  });

  it('store IPC channels are registered when localStore is provided', () => {
    const win = new BrowserWindow({}) as unknown as InstanceType<typeof BrowserWindow>;
    const manager = new ExtractionManager(win);
    const localStore = new LocalStore();

    registerIpcHandlers(win, manager, undefined, undefined, localStore);

    const registeredChannels = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as string,
    );

    expect(registeredChannels).toContain('store:get-profile');
    expect(registeredChannels).toContain('store:set-profile');
    expect(registeredChannels).toContain('store:clear-profile');
    expect(registeredChannels).toContain('store:get-preferences');
    expect(registeredChannels).toContain('store:set-preferences');
    expect(registeredChannels).toContain('store:get-history');
    expect(registeredChannels).toContain('store:add-history');
  });

  it('apikey IPC channels are registered when apiKeyManager is provided', () => {
    const win = new BrowserWindow({}) as unknown as InstanceType<typeof BrowserWindow>;
    const manager = new ExtractionManager(win);
    const apiKeyManager = new ApiKeyManager();

    registerIpcHandlers(win, manager, undefined, undefined, undefined, apiKeyManager);

    const registeredChannels = (ipcMain.handle as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: unknown[]) => c[0] as string,
    );

    expect(registeredChannels).toContain('apikey:save');
    expect(registeredChannels).toContain('apikey:get-status');
    expect(registeredChannels).toContain('apikey:clear');
  });
});

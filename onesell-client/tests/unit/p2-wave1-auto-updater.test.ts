/**
 * Tests for F-17 (#293): Auto-updater module
 * PRD §16
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BrowserWindow } from 'electron';

// ── Mock electron-updater module ────────────────────────────────────

const mockAutoUpdater = {
  logger: null as unknown,
  autoDownload: false,
  autoInstallOnAppQuit: false,
  on: vi.fn(),
  checkForUpdates: vi.fn().mockResolvedValue(undefined),
  quitAndInstall: vi.fn(),
};

vi.mock('electron-updater', () => ({
  autoUpdater: mockAutoUpdater,
}));

const mockNotificationInstance = {
  on: vi.fn(),
  show: vi.fn(),
};

vi.mock('electron', () => ({
  Notification: Object.assign(
    function MockNotification() { return mockNotificationInstance; },
    { isSupported: () => true },
  ),
}));

// ── Mock BrowserWindow ──────────────────────────────────────────────

function makeMockWindow(): BrowserWindow {
  return {
    webContents: {
      send: vi.fn(),
    },
  } as unknown as BrowserWindow;
}

describe('F-17: Auto-updater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAutoUpdater.autoDownload = false;
    mockAutoUpdater.autoInstallOnAppQuit = false;
  });

  it('AC-1: checks for updates on init', async () => {
    const { initAutoUpdater } = await import('../../src/main/updater.js');
    const win = makeMockWindow();

    initAutoUpdater(win);
    // Allow async startUpdater to resolve
    await vi.waitFor(() => {
      expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalled();
    });
  });

  it('AC-2: emits IPC events for update-available', async () => {
    const { initAutoUpdater } = await import('../../src/main/updater.js');
    const win = makeMockWindow();

    initAutoUpdater(win);
    await vi.waitFor(() => {
      expect(mockAutoUpdater.on).toHaveBeenCalled();
    });

    // Find the update-available handler
    const updateAvailableCall = mockAutoUpdater.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'update-available',
    );
    expect(updateAvailableCall).toBeDefined();

    // Simulate the event
    const handler = updateAvailableCall![1] as (info: { version: string; releaseDate: string }) => void;
    handler({ version: '2.1.0', releaseDate: '2026-03-18' });

    expect((win.webContents.send as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      'updater:update-available',
      { version: '2.1.0', releaseDate: '2026-03-18' },
    );
  });

  it('AC-3: emits IPC event for update-downloaded with restart prompt', async () => {
    const { initAutoUpdater } = await import('../../src/main/updater.js');
    const win = makeMockWindow();

    initAutoUpdater(win);
    await vi.waitFor(() => {
      expect(mockAutoUpdater.on).toHaveBeenCalled();
    });

    const updateDownloadedCall = mockAutoUpdater.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'update-downloaded',
    );
    expect(updateDownloadedCall).toBeDefined();

    // Simulate update-downloaded
    const handler = updateDownloadedCall![1] as (info: { version: string }) => void;
    handler({ version: '2.1.0' });

    expect((win.webContents.send as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      'updater:update-downloaded',
      { version: '2.1.0' },
    );
  });

  it('AC-4: registers error handler for graceful failure', async () => {
    const { initAutoUpdater } = await import('../../src/main/updater.js');
    const win = makeMockWindow();

    initAutoUpdater(win);
    await vi.waitFor(() => {
      expect(mockAutoUpdater.on).toHaveBeenCalled();
    });

    const errorCall = mockAutoUpdater.on.mock.calls.find(
      (call: unknown[]) => call[0] === 'error',
    );
    expect(errorCall).toBeDefined();

    // Should not throw
    const errorHandler = errorCall![1] as (err: Error) => void;
    expect(() => errorHandler(new Error('No publish config'))).not.toThrow();
  });

  it('sets autoDownload and autoInstallOnAppQuit', async () => {
    const { initAutoUpdater } = await import('../../src/main/updater.js');
    const win = makeMockWindow();

    initAutoUpdater(win);
    await vi.waitFor(() => {
      expect(mockAutoUpdater.autoDownload).toBe(true);
      expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true);
    });
  });
});

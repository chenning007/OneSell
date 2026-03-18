/**
 * Auto-updater integration (F-17, #293).
 *
 * PRD §16, ADR-005 D5:
 * - Checks for updates on app start via electron-updater
 * - Emits `update-available` and `update-downloaded` events via IPC to renderer
 * - On `update-downloaded`: shows a notification "Restart to update"
 * - Graceful degradation: if updater fails (dev mode, missing publish config,
 *   or electron-updater not installed), logs and continues without crashing
 *
 * Closes #293
 */

import type { BrowserWindow } from 'electron';
import { Notification } from 'electron';

/**
 * Initialize the auto-updater. Safe to call in any environment —
 * failures are logged and swallowed.
 */
export function initAutoUpdater(mainWindow: BrowserWindow): void {
  void startUpdater(mainWindow);
}

async function startUpdater(mainWindow: BrowserWindow): Promise<void> {
  try {
    // Dynamic import — electron-updater may not be installed in dev
    const { autoUpdater } = await import('electron-updater');

    autoUpdater.logger = {
      info: (msg: unknown) => console.log('[updater]', msg),
      warn: (msg: unknown) => console.warn('[updater]', msg),
      error: (msg: unknown) => console.error('[updater]', msg),
      debug: (msg: unknown) => console.log('[updater:debug]', msg),
    };

    // Don't auto-download — let user choose when to install
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('update-available', (info) => {
      console.log('[updater] Update available:', info.version);
      mainWindow.webContents.send('updater:update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
      });
    });

    autoUpdater.on('update-not-available', () => {
      console.log('[updater] No update available');
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[updater] Update downloaded:', info.version);
      mainWindow.webContents.send('updater:update-downloaded', {
        version: info.version,
      });

      // Show native notification: "Restart to update"
      try {
        if (Notification.isSupported()) {
          const notification = new Notification({
            title: 'OneSell Scout Update Ready',
            body: `Version ${info.version} has been downloaded. Restart to update.`,
          });
          notification.on('click', () => {
            autoUpdater.quitAndInstall();
          });
          notification.show();
        }
      } catch {
        // Notification not available — non-fatal
      }
    });

    autoUpdater.on('error', (err) => {
      console.warn('[updater] Auto-update error (non-fatal):', err.message);
    });

    // Check for updates — non-blocking
    await autoUpdater.checkForUpdates();
  } catch (err) {
    // Graceful degradation: log and continue
    const message = err instanceof Error ? err.message : String(err);
    console.log(`[updater] Auto-updater unavailable (expected in dev): ${message}`);
  }
}

import { ipcMain, BrowserWindow } from 'electron';
import { z } from 'zod';
import type { ExtractionManager } from '../extraction/ExtractionManager.js';
import { registry } from '../extraction/ExtractionScriptRegistry.js';

// P9: validate all IPC inputs at the boundary
const platformIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, 'Invalid platformId format');

function validatePlatformId(platformId: unknown): string {
  return platformIdSchema.parse(platformId);
}

export function registerIpcHandlers(
  _mainWindow: BrowserWindow,
  manager: ExtractionManager,
): void {
  ipcMain.handle('extraction:open-view', (_event, platformId: unknown) => {
    const id = validatePlatformId(platformId);
    manager.openView(id);
  });

  ipcMain.handle('extraction:close-view', (_event, platformId: unknown) => {
    const id = validatePlatformId(platformId);
    manager.closeView(id);
  });

  ipcMain.handle('extraction:hide-view', (_event, platformId: unknown) => {
    const id = validatePlatformId(platformId);
    manager.hideView(id);
  });

  ipcMain.handle('extraction:run', (_event, platformId: unknown) => {
    const id = validatePlatformId(platformId);
    return manager.extractFromView(id);
  });

  ipcMain.handle('extraction:get-url', (_event, platformId: unknown) => {
    const id = validatePlatformId(platformId);
    return manager.getCurrentUrl(id);
  });
}

/** Remove all registered extraction IPC handlers (useful for testing). */
export function removeIpcHandlers(): void {
  const channels = [
    'extraction:open-view',
    'extraction:close-view',
    'extraction:hide-view',
    'extraction:run',
    'extraction:get-url',
  ] as const;
  for (const channel of channels) {
    ipcMain.removeHandler(channel);
  }
}

export { registry };

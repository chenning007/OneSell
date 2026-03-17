import { ipcMain, BrowserWindow } from 'electron';
import { z } from 'zod';
import type { ExtractionManager } from '../extraction/ExtractionManager.js';
import type { PayloadBuilder } from '../extraction/PayloadBuilder.js';
import type { BackendClient } from '../backend-client.js';
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

// Zod schema for payload:build args
const payloadBuildArgsSchema = z.object({
  sessionId: z.string().min(1),
  preferences: z.record(z.unknown()),
  rawResults: z.record(z.array(z.record(z.unknown()))),
});

// P9: Zod schemas for analysis IPC
const analysisSubmitSchema = z.object({
  extractionData: z.array(z.object({
    platformId: z.string().min(1).max(64),
    available: z.boolean(),
    data: z.unknown().optional(),
  })).min(1),
  preferences: z.object({
    budget: z.number().positive().optional(),
    preferredPlatforms: z.array(z.string().min(1)).optional(),
    categories: z.array(z.string().min(1)).optional(),
    riskTolerance: z.enum(['low', 'medium', 'high']).optional(),
    fulfillmentPreference: z.string().optional(),
  }),
  marketId: z.string().min(1).max(16),
});

const analysisIdSchema = z.string().uuid();

export function registerIpcHandlers(
  _mainWindow: BrowserWindow,
  manager: ExtractionManager,
  payloadBuilder?: PayloadBuilder,
  backendClient?: BackendClient,
): void {
  ipcMain.handle('extraction:open-view', (_event, platformId: unknown) => {
    console.log('[IPC] extraction:open-view received, platformId:', platformId);
    try {
      const id = validatePlatformId(platformId);
      console.log('[IPC] platformId validated:', id);
      manager.openView(id);
      console.log('[IPC] openView called OK for:', id);
    } catch (err) {
      console.error('[IPC] extraction:open-view ERROR:', err);
      throw err;
    }
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

  ipcMain.handle('extraction:get-open-platforms', () => {
    return manager.getOpenPlatforms();
  });

  ipcMain.handle('extraction:hide-all', () => {
    manager.hideAll();
  });

  if (payloadBuilder) {
    ipcMain.handle('payload:build', (_event, args: unknown) => {
      const { sessionId, preferences, rawResults } = payloadBuildArgsSchema.parse(args);
      // normalizeAll expects Record<string, RawPlatformData[]>; validate loosely — PayloadBuilder handles missing scripts
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalized = payloadBuilder.normalizeAll(rawResults as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return payloadBuilder.build(sessionId, preferences as any, normalized);
    });
  }

  // ── Analysis IPC handlers (requires BackendClient) ──────────────

  if (backendClient) {
    ipcMain.handle('analysis:submit', async (_event, args: unknown) => {
      const data = analysisSubmitSchema.parse(args);
      const result = await backendClient.submitAnalysis(data);
      return result;
    });

    ipcMain.handle('analysis:status', async (_event, analysisId: unknown) => {
      const id = analysisIdSchema.parse(analysisId);
      return backendClient.getAnalysisStatus(id);
    });

    ipcMain.handle('analysis:results', async (_event, analysisId: unknown) => {
      const id = analysisIdSchema.parse(analysisId);
      return backendClient.getAnalysisResults(id);
    });
  }
}

/** Remove all registered extraction IPC handlers (useful for testing). */
export function removeIpcHandlers(): void {
  const channels = [
    'extraction:open-view',
    'extraction:close-view',
    'extraction:hide-view',
    'extraction:run',
    'extraction:get-url',
    'extraction:get-open-platforms',
    'extraction:hide-all',
    'payload:build',
    'analysis:submit',
    'analysis:status',
    'analysis:results',
  ] as const;
  for (const channel of channels) {
    ipcMain.removeHandler(channel);
  }
}

export { registry };


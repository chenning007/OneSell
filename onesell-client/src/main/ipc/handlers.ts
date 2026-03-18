/**
 * IPC Handlers — registers all v1 + v2 IPC channels with Zod validation (F-07, #211).
 *
 * PRD §12, ADR-005:
 * - v1 extraction/payload/analysis channels preserved
 * - v2 adds store:*, apikey:*, extraction:start-pipeline, extraction:toggle-platform,
 *   agent:run-analysis, preferences:get-defaults
 * - Every handler validates input with Zod before processing (P9)
 *
 * Closes #211
 */

import { ipcMain, BrowserWindow } from 'electron';
import { z } from 'zod';
import type { ExtractionManager } from '../extraction/ExtractionManager.js';
import type { PayloadBuilder } from '../extraction/PayloadBuilder.js';
import type { BackendClient } from '../backend-client.js';
import type { LocalStore, SavedProfile, SavedPreferences, HistoryEntry } from '../store/LocalStore.js';
import type { ApiKeyManager } from '../store/ApiKeyManager.js';
import { AgentService } from '../agent/AgentService.js';
import { ClientLLMProvider } from '../agent/ClientLLMProvider.js';
import { registry } from '../extraction/ExtractionScriptRegistry.js';
import { MARKET_CONFIGS, BUDGET_RANGES } from '../../renderer/config/markets.js';

// ── P9: Zod schemas — validate all IPC inputs at the boundary ───────

const platformIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, 'Invalid platformId format');

function validatePlatformId(platformId: unknown): string {
  return platformIdSchema.parse(platformId);
}

const payloadBuildArgsSchema = z.object({
  sessionId: z.string().min(1),
  preferences: z.record(z.unknown()),
  rawResults: z.record(z.array(z.record(z.unknown()))),
});

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

// ── v2 Zod schemas ──────────────────────────────────────────────────

const marketIdSchema = z.string().min(1).max(16);

const savedProfileSchema = z.object({
  marketId: z.string().min(1).max(16),
  extractionMode: z.literal('auto-discover'),
  lastSessionAt: z.string().datetime(),
});

const savedPreferencesSchema = z.object({
  budget: z.object({
    min: z.number().nonnegative(),
    max: z.number().positive(),
    currency: z.string().min(1).max(8),
  }).optional(),
  riskTolerance: z.enum(['low', 'medium', 'high']).optional(),
  sellerExperience: z.enum(['none', 'some', 'experienced']).optional(),
  productType: z.enum(['physical', 'digital']).optional(),
  fulfillmentTime: z.enum(['low', 'medium', 'high']).optional(),
});

const historyEntrySchema = z.object({
  sessionId: z.string().min(1),
  marketId: z.string().min(1).max(16),
  timestamp: z.string().datetime(),
  productCount: z.number().int().nonnegative(),
  categoryCount: z.number().int().nonnegative(),
});

const apiKeySchema = z.string().min(1).max(512);

const togglePlatformSchema = z.object({
  platformId: platformIdSchema,
  enabled: z.boolean(),
});

// ── Structured error helper ─────────────────────────────────────────

interface IpcError {
  error: true;
  code: string;
  message: string;
}

function ipcError(code: string, message: string): IpcError {
  return { error: true, code, message };
}

// ── Register handlers ───────────────────────────────────────────────

export function registerIpcHandlers(
  _mainWindow: BrowserWindow,
  manager: ExtractionManager,
  payloadBuilder?: PayloadBuilder,
  backendClient?: BackendClient,
  localStore?: LocalStore,
  apiKeyManager?: ApiKeyManager,
): void {
  // ── v1 extraction channels ──────────────────────────────────────

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const normalized = payloadBuilder.normalizeAll(rawResults as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return payloadBuilder.build(sessionId, preferences as any, normalized);
    });
  }

  // ── v1 analysis channels (requires BackendClient) ───────────────

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

  // ── v2 store channels (requires LocalStore) ─────────────────────

  if (localStore) {
    ipcMain.handle('store:get-profile', () => {
      return localStore.getProfile();
    });

    ipcMain.handle('store:set-profile', (_event, args: unknown) => {
      const parsed = savedProfileSchema.safeParse(args);
      if (!parsed.success) return ipcError('VALIDATION_ERROR', parsed.error.message);
      localStore.setProfile(parsed.data as SavedProfile);
      return { ok: true };
    });

    ipcMain.handle('store:clear-profile', () => {
      localStore.clearProfile();
      return { ok: true };
    });

    ipcMain.handle('store:get-preferences', () => {
      return localStore.getPreferences();
    });

    ipcMain.handle('store:set-preferences', (_event, args: unknown) => {
      const parsed = savedPreferencesSchema.safeParse(args);
      if (!parsed.success) return ipcError('VALIDATION_ERROR', parsed.error.message);
      localStore.setPreferences(parsed.data as SavedPreferences);
      return { ok: true };
    });

    ipcMain.handle('store:get-history', () => {
      return localStore.getHistory();
    });

    ipcMain.handle('store:add-history', (_event, args: unknown) => {
      const parsed = historyEntrySchema.safeParse(args);
      if (!parsed.success) return ipcError('VALIDATION_ERROR', parsed.error.message);
      localStore.addHistoryEntry(parsed.data as HistoryEntry);
      return { ok: true };
    });
  }

  // ── v2 apikey channels (requires ApiKeyManager) ─────────────────

  if (apiKeyManager) {
    ipcMain.handle('apikey:save', (_event, args: unknown) => {
      const parsed = apiKeySchema.safeParse(args);
      if (!parsed.success) return ipcError('VALIDATION_ERROR', 'API key must be a non-empty string');
      try {
        apiKeyManager.saveKey(parsed.data);
        return { ok: true };
      } catch (err) {
        return ipcError('SAVE_FAILED', err instanceof Error ? err.message : 'Unknown error');
      }
    });

    ipcMain.handle('apikey:get-status', () => {
      return { hasKey: apiKeyManager.hasKey() };
    });

    ipcMain.handle('apikey:clear', () => {
      apiKeyManager.clearKey();
      return { ok: true };
    });
  }

  // ── v2 extraction pipeline channels ───────────────────────────────

  ipcMain.handle('extraction:start-pipeline', async (_event, args: unknown) => {
    const parsed = marketIdSchema.safeParse(args);
    if (!parsed.success) return ipcError('VALIDATION_ERROR', 'Valid marketId is required');
    const marketId = parsed.data;

    // Emit pipeline and progress events to renderer via IPC
    const mainWin = _mainWindow;
    const emitter = {
      pipelineUpdate(platformId: string, update: Record<string, unknown>): void {
        mainWin.webContents.send('extraction:pipeline-update', { platformId, ...update });
      },
      progressEvent(platformId: string, message: string, field?: string): void {
        mainWin.webContents.send('extraction:progress-event', {
          platformId,
          message,
          field,
          timestamp: new Date().toISOString(),
        });
      },
    };

    // Run extraction asynchronously — don't block the IPC response
    void manager.startAutonomousExtraction(marketId, emitter);

    return { ok: true, marketId };
  });

  ipcMain.handle('extraction:toggle-platform', (_event, args: unknown) => {
    const parsed = togglePlatformSchema.safeParse(args);
    if (!parsed.success) return ipcError('VALIDATION_ERROR', parsed.error.message);
    // Stub: toggle will be wired to ExtractionManager in E-03
    return { ok: true, platformId: parsed.data.platformId, enabled: parsed.data.enabled };
  });

  // ── v2 agent channel — wired pipeline (A-07, #225) ───────────────

  ipcMain.handle('agent:run-analysis', async (_event, args: unknown) => {
    const parsed = marketIdSchema.safeParse(args);
    if (!parsed.success) return ipcError('VALIDATION_ERROR', 'Valid marketId is required');

    if (!apiKeyManager) return ipcError('NO_API_KEY_MANAGER', 'API key manager not initialized');
    if (!apiKeyManager.hasKey()) return ipcError('NO_API_KEY', 'No API key configured');

    const marketId = parsed.data;
    const marketConfig = MARKET_CONFIGS[marketId];
    if (!marketConfig) return ipcError('UNKNOWN_MARKET', `No config for market: ${marketId}`);

    const market = {
      marketId: marketConfig.marketId,
      language: marketConfig.language,
      currency: marketConfig.currency,
      platforms: [...marketConfig.platforms],
    };

    // Push status updates to renderer via IPC
    const mainWin = _mainWindow;
    const onStatus: import('../agent/AgentService.js').StatusCallback = (status) => {
      mainWin.webContents.send('agent:analysis-status', status);
    };

    const llm = new ClientLLMProvider(apiKeyManager);
    const service = AgentService.create(llm, onStatus);

    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Default preferences for run
    const budgetRange = BUDGET_RANGES[marketId];
    const preferences = {
      market,
      budget: budgetRange
        ? { min: budgetRange.min, max: budgetRange.max, currency: budgetRange.currency }
        : { min: 100, max: 500, currency: 'USD' },
      riskTolerance: 'medium' as const,
      sellerExperience: 'none' as const,
    };

    // Extraction data — use what's available (empty for now; future: read from extractionStore)
    const extractionData = marketConfig.platforms.map((platformId) => ({
      platformId,
      available: false,
    }));

    try {
      const result = await service.analyze(sessionId, extractionData, preferences, market);
      mainWin.webContents.send('agent:analysis-result', result);
      return { ok: true, marketId, status: result.status };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      mainWin.webContents.send('agent:analysis-status', { status: 'error', step: 'error', message, updatedAt: new Date().toISOString() });
      return ipcError('ANALYSIS_FAILED', message);
    }
  });

  // ── v2 preferences:get-defaults channel ─────────────────────────

  ipcMain.handle('preferences:get-defaults', (_event, args: unknown) => {
    const parsed = marketIdSchema.safeParse(args);
    if (!parsed.success) return ipcError('VALIDATION_ERROR', 'Valid marketId is required');
    const marketId = parsed.data;
    const budgetRange = BUDGET_RANGES[marketId];
    const marketConfig = MARKET_CONFIGS[marketId];
    if (!budgetRange || !marketConfig) {
      return ipcError('UNKNOWN_MARKET', `No configuration found for market: ${marketId}`);
    }
    return {
      budget: { min: budgetRange.min, max: budgetRange.max, currency: budgetRange.currency },
      riskTolerance: 'medium' as const,
      sellerExperience: 'none' as const,
      productType: 'physical' as const,
      fulfillmentTime: 'medium' as const,
      platforms: marketConfig.platforms,
    };
  });
}

/** Remove all registered IPC handlers (useful for testing). */
export function removeIpcHandlers(): void {
  const channels = [
    // v1
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
    // v2
    'store:get-profile',
    'store:set-profile',
    'store:clear-profile',
    'store:get-preferences',
    'store:set-preferences',
    'store:get-history',
    'store:add-history',
    'apikey:save',
    'apikey:get-status',
    'apikey:clear',
    'extraction:start-pipeline',
    'extraction:toggle-platform',
    'agent:run-analysis',
    'preferences:get-defaults',
  ] as const;
  for (const channel of channels) {
    ipcMain.removeHandler(channel);
  }
}

export { registry };


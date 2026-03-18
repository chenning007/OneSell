/**
 * extractionStore v2 — PipelineTask[] model (E-01, #237).
 *
 * PRD §5.3, §5.4, ADR-005 D2:
 * - PipelineTask per platform with rich status, labels, toggle, progress events
 * - initPipeline(marketId) creates tasks from MARKET_CONFIGS
 * - updateTask merges partial state
 * - canAnalyze: true when ≥1 task is done
 * - allDone: true when all enabled tasks are done/skipped/error
 *
 * Closes #237
 */

import { create } from 'zustand';
import { MARKET_CONFIGS } from '../config/markets.js';

// ── Types ───────────────────────────────────────────────────────────

export type PipelineStatus =
  | 'queued'
  | 'active'
  | 'needs-login'
  | 'done'
  | 'error'
  | 'skipped'
  | 'disabled';

export interface ExtractionProgressEvent {
  readonly timestamp: string; // ISO 8601
  readonly message: string;
  readonly field?: string;
}

export interface PipelineTask {
  platformId: string;
  status: PipelineStatus;
  label: string;
  doneLabel: string;
  productCount: number;
  enabled: boolean;
  requiresAuth: boolean;
  progressEvents: ExtractionProgressEvent[];
}

// ── Computed helpers ────────────────────────────────────────────────

const TERMINAL_STATUSES: ReadonlySet<PipelineStatus> = new Set(['done', 'skipped', 'error']);

function computeCanAnalyze(tasks: PipelineTask[]): boolean {
  return tasks.some((t) => t.status === 'done');
}

function computeAllDone(tasks: PipelineTask[]): boolean {
  const enabled = tasks.filter((t) => t.enabled);
  return enabled.length > 0 && enabled.every((t) => TERMINAL_STATUSES.has(t.status));
}

// ── Platforms that require user authentication ──────────────────────

const AUTH_REQUIRED_PLATFORMS: ReadonlySet<string> = new Set([
  'amazon-us', 'amazon-uk', 'amazon-de', 'amazon-jp', 'amazon-au',
  'ebay-us', 'ebay-uk', 'ebay-de', 'ebay-au',
  'etsy', 'otto', 'catch',
  'taobao', 'jd', 'pinduoduo', 'douyin-shop',
  'shopee', 'tokopedia', 'lazada',
  'rakuten', 'mercari-jp',
]);

// ── Store ───────────────────────────────────────────────────────────

interface ExtractionState {
  tasks: PipelineTask[];
  activeTab: string | null;
  canAnalyze: boolean;
  allDone: boolean;
  cancelled: boolean;

  initPipeline: (marketId: string) => void;
  updateTask: (platformId: string, partial: Partial<Omit<PipelineTask, 'platformId'>>) => void;
  setActiveTab: (platformId: string | null) => void;
  cancel: () => void;
  reset: () => void;
}

export const useExtractionStore = create<ExtractionState>((set) => ({
  tasks: [],
  activeTab: null,
  canAnalyze: false,
  allDone: false,
  cancelled: false,

  initPipeline: (marketId) => {
    const config = MARKET_CONFIGS[marketId];
    if (!config) {
      set({ tasks: [], canAnalyze: false, allDone: false, cancelled: false, activeTab: null });
      return;
    }

    const tasks: PipelineTask[] = config.platforms.map((platformId) => {
      const needsAuth = AUTH_REQUIRED_PLATFORMS.has(platformId);
      return {
        platformId,
        status: needsAuth ? 'needs-login' as const : 'queued' as const,
        label: `Scanning ${platformId}…`,
        doneLabel: '',
        productCount: 0,
        enabled: true,
        requiresAuth: needsAuth,
        progressEvents: [],
      };
    });

    set({ tasks, canAnalyze: false, allDone: false, cancelled: false, activeTab: null });
  },

  updateTask: (platformId, partial) => {
    set((state) => {
      const tasks = state.tasks.map((t) =>
        t.platformId === platformId ? { ...t, ...partial } : t,
      );
      return {
        tasks,
        canAnalyze: computeCanAnalyze(tasks),
        allDone: computeAllDone(tasks),
      };
    });
  },

  setActiveTab: (platformId) => set({ activeTab: platformId }),

  cancel: () => set({ cancelled: true }),

  reset: () =>
    set({ tasks: [], activeTab: null, canAnalyze: false, allDone: false, cancelled: false }),
}));

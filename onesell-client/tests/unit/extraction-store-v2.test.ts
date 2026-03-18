/**
 * E-02 (#238) — extractionStore v2 pipeline unit tests.
 *
 * AC:
 *   1. initPipeline('us') creates tasks for all US platforms
 *   2. Setting one task done makes canAnalyze true
 *   3. Disabling a task sets status to disabled
 *   4. All tasks done/skipped/error triggers allDone
 *
 * Principles:
 *   P5 — Graceful degradation: unknown market does not crash
 *   P6 — Isolated plugins: tasks are data-driven from MARKET_CONFIGS
 *   P8 — No hardcoded platform names in test assertions; derived from config
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useExtractionStore } from '../../src/renderer/store/extractionStore.js';
import { MARKET_CONFIGS } from '../../src/renderer/config/markets.js';

// ── Helpers ──────────────────────────────────────────────────────────

function resetStore(): void {
  useExtractionStore.getState().reset();
}

const US_PLATFORMS = MARKET_CONFIGS.us!.platforms;
const CN_PLATFORMS = MARKET_CONFIGS.cn!.platforms;

// ═══════════════════════════════════════════════════════════════════
// AC-1: initPipeline('us') creates tasks for all US platforms
// ═══════════════════════════════════════════════════════════════════

describe('extractionStore v2 — initPipeline (AC-1)', () => {
  beforeEach(resetStore);

  it('creates one task per US platform', () => {
    useExtractionStore.getState().initPipeline('us');
    const tasks = useExtractionStore.getState().tasks;
    expect(tasks).toHaveLength(US_PLATFORMS.length);
  });

  it('each task platformId matches MARKET_CONFIGS.us.platforms', () => {
    useExtractionStore.getState().initPipeline('us');
    const taskIds = useExtractionStore.getState().tasks.map((t) => t.platformId);
    expect(taskIds).toEqual([...US_PLATFORMS]);
  });

  it('all tasks start enabled', () => {
    useExtractionStore.getState().initPipeline('us');
    const tasks = useExtractionStore.getState().tasks;
    expect(tasks.every((t) => t.enabled)).toBe(true);
  });

  it('tasks that require auth start with needs-login status', () => {
    useExtractionStore.getState().initPipeline('us');
    const tasks = useExtractionStore.getState().tasks;
    // amazon-us requires auth per AUTH_REQUIRED_PLATFORMS
    const amazonTask = tasks.find((t) => t.platformId === 'amazon-us');
    expect(amazonTask?.status).toBe('needs-login');
    expect(amazonTask?.requiresAuth).toBe(true);
  });

  it('tasks that do NOT require auth start with queued status', () => {
    useExtractionStore.getState().initPipeline('us');
    const tasks = useExtractionStore.getState().tasks;
    const googleTask = tasks.find((t) => t.platformId === 'google-trends');
    expect(googleTask?.status).toBe('queued');
    expect(googleTask?.requiresAuth).toBe(false);
  });

  it('initPipeline resets canAnalyze and allDone', () => {
    useExtractionStore.getState().initPipeline('us');
    const state = useExtractionStore.getState();
    expect(state.canAnalyze).toBe(false);
    expect(state.allDone).toBe(false);
    expect(state.cancelled).toBe(false);
  });

  it('initPipeline for CN creates CN-market tasks', () => {
    useExtractionStore.getState().initPipeline('cn');
    const taskIds = useExtractionStore.getState().tasks.map((t) => t.platformId);
    expect(taskIds).toEqual([...CN_PLATFORMS]);
  });
});

// ═══════════════════════════════════════════════════════════════════
// AC-2: Setting one task done makes canAnalyze true
// ═══════════════════════════════════════════════════════════════════

describe('extractionStore v2 — canAnalyze (AC-2)', () => {
  beforeEach(() => {
    resetStore();
    useExtractionStore.getState().initPipeline('us');
  });

  it('canAnalyze is false when no tasks are done', () => {
    expect(useExtractionStore.getState().canAnalyze).toBe(false);
  });

  it('canAnalyze becomes true when one task is done', () => {
    const firstTask = useExtractionStore.getState().tasks[0]!;
    useExtractionStore.getState().updateTask(firstTask.platformId, { status: 'done' });
    expect(useExtractionStore.getState().canAnalyze).toBe(true);
  });

  it('canAnalyze stays true even if other tasks error', () => {
    const tasks = useExtractionStore.getState().tasks;
    useExtractionStore.getState().updateTask(tasks[0]!.platformId, { status: 'done' });
    useExtractionStore.getState().updateTask(tasks[1]!.platformId, { status: 'error' });
    expect(useExtractionStore.getState().canAnalyze).toBe(true);
  });

  it('canAnalyze is false if only tasks with error/skipped exist (no done)', () => {
    const tasks = useExtractionStore.getState().tasks;
    for (const t of tasks) {
      useExtractionStore.getState().updateTask(t.platformId, { status: 'error' });
    }
    expect(useExtractionStore.getState().canAnalyze).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// AC-3: Disabling a task sets status to disabled
// ═══════════════════════════════════════════════════════════════════

describe('extractionStore v2 — disable task (AC-3)', () => {
  beforeEach(() => {
    resetStore();
    useExtractionStore.getState().initPipeline('us');
  });

  it('updateTask with enabled=false and status=disabled disables the task', () => {
    const firstTask = useExtractionStore.getState().tasks[0]!;
    useExtractionStore.getState().updateTask(firstTask.platformId, {
      enabled: false,
      status: 'disabled',
    });
    const updated = useExtractionStore.getState().tasks.find(
      (t) => t.platformId === firstTask.platformId,
    );
    expect(updated?.enabled).toBe(false);
    expect(updated?.status).toBe('disabled');
  });

  it('disabled tasks are not counted toward allDone', () => {
    const tasks = useExtractionStore.getState().tasks;
    // Disable all but one, mark the remaining one as done
    for (let i = 1; i < tasks.length; i++) {
      useExtractionStore.getState().updateTask(tasks[i]!.platformId, {
        enabled: false,
        status: 'disabled',
      });
    }
    useExtractionStore.getState().updateTask(tasks[0]!.platformId, { status: 'done' });
    expect(useExtractionStore.getState().allDone).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// AC-4: All tasks done/skipped/error triggers allDone
// ═══════════════════════════════════════════════════════════════════

describe('extractionStore v2 — allDone (AC-4)', () => {
  beforeEach(() => {
    resetStore();
    useExtractionStore.getState().initPipeline('us');
  });

  it('allDone is false when tasks are still queued', () => {
    expect(useExtractionStore.getState().allDone).toBe(false);
  });

  it('allDone is true when all enabled tasks are done', () => {
    const tasks = useExtractionStore.getState().tasks;
    for (const t of tasks) {
      useExtractionStore.getState().updateTask(t.platformId, { status: 'done' });
    }
    expect(useExtractionStore.getState().allDone).toBe(true);
  });

  it('allDone is true when all enabled tasks are skipped', () => {
    const tasks = useExtractionStore.getState().tasks;
    for (const t of tasks) {
      useExtractionStore.getState().updateTask(t.platformId, { status: 'skipped' });
    }
    expect(useExtractionStore.getState().allDone).toBe(true);
  });

  it('allDone is true when all enabled tasks are error', () => {
    const tasks = useExtractionStore.getState().tasks;
    for (const t of tasks) {
      useExtractionStore.getState().updateTask(t.platformId, { status: 'error' });
    }
    expect(useExtractionStore.getState().allDone).toBe(true);
  });

  it('allDone is true with a mix of done/skipped/error', () => {
    const tasks = useExtractionStore.getState().tasks;
    useExtractionStore.getState().updateTask(tasks[0]!.platformId, { status: 'done' });
    useExtractionStore.getState().updateTask(tasks[1]!.platformId, { status: 'skipped' });
    // Set remaining to error
    for (let i = 2; i < tasks.length; i++) {
      useExtractionStore.getState().updateTask(tasks[i]!.platformId, { status: 'error' });
    }
    expect(useExtractionStore.getState().allDone).toBe(true);
  });

  it('allDone is false when one enabled task is still active', () => {
    const tasks = useExtractionStore.getState().tasks;
    for (let i = 0; i < tasks.length - 1; i++) {
      useExtractionStore.getState().updateTask(tasks[i]!.platformId, { status: 'done' });
    }
    useExtractionStore.getState().updateTask(tasks[tasks.length - 1]!.platformId, {
      status: 'active',
    });
    expect(useExtractionStore.getState().allDone).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// P5: Graceful degradation — unknown market
// ═══════════════════════════════════════════════════════════════════

describe('extractionStore v2 — P5 graceful degradation', () => {
  beforeEach(resetStore);

  it('initPipeline with unknown market creates empty tasks (no crash)', () => {
    useExtractionStore.getState().initPipeline('zz');
    const state = useExtractionStore.getState();
    expect(state.tasks).toHaveLength(0);
    expect(state.canAnalyze).toBe(false);
    expect(state.allDone).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Reset and cancel
// ═══════════════════════════════════════════════════════════════════

describe('extractionStore v2 — reset and cancel', () => {
  beforeEach(resetStore);

  it('reset clears all tasks', () => {
    useExtractionStore.getState().initPipeline('us');
    useExtractionStore.getState().reset();
    const state = useExtractionStore.getState();
    expect(state.tasks).toHaveLength(0);
    expect(state.canAnalyze).toBe(false);
    expect(state.allDone).toBe(false);
    expect(state.cancelled).toBe(false);
  });

  it('cancel sets cancelled flag', () => {
    useExtractionStore.getState().initPipeline('us');
    useExtractionStore.getState().cancel();
    expect(useExtractionStore.getState().cancelled).toBe(true);
  });
});

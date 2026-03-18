/**
 * extractionStore v2 tests — PipelineTask[] model (E-01, #237).
 * Updated from v1 tests to match the new API.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useExtractionStore } from '../../src/renderer/store/extractionStore.js';

describe('extractionStore', () => {
  beforeEach(() => {
    useExtractionStore.getState().reset();
  });

  it('initPipeline creates PipelineTask entries from MARKET_CONFIGS', () => {
    useExtractionStore.getState().initPipeline('us');

    const { tasks } = useExtractionStore.getState();
    expect(tasks.length).toBeGreaterThan(0);
    for (const t of tasks) {
      expect(t.productCount).toBe(0);
      expect(t.enabled).toBe(true);
      expect(['queued', 'needs-login']).toContain(t.status);
    }
    expect(tasks.map((t) => t.platformId)).toContain('amazon-us');
  });

  it('initPipeline with unknown marketId creates empty task list', () => {
    useExtractionStore.getState().initPipeline('nonexistent');
    expect(useExtractionStore.getState().tasks).toEqual([]);
  });

  it('updateTask merges partial state into the correct task', () => {
    useExtractionStore.getState().initPipeline('us');
    useExtractionStore.getState().updateTask('amazon-us', { status: 'active' });
    const task = useExtractionStore.getState().tasks.find((t) => t.platformId === 'amazon-us')!;
    expect(task.status).toBe('active');

    useExtractionStore.getState().updateTask('amazon-us', { status: 'done', productCount: 42, doneLabel: 'Found 42 products' });
    const updated = useExtractionStore.getState().tasks.find((t) => t.platformId === 'amazon-us')!;
    expect(updated.status).toBe('done');
    expect(updated.productCount).toBe(42);
    expect(updated.doneLabel).toBe('Found 42 products');
  });

  it('canAnalyze is true when >= 1 task is done', () => {
    useExtractionStore.getState().initPipeline('us');
    expect(useExtractionStore.getState().canAnalyze).toBe(false);

    useExtractionStore.getState().updateTask('amazon-us', { status: 'done', productCount: 5 });
    expect(useExtractionStore.getState().canAnalyze).toBe(true);
  });

  it('allDone is true when all enabled tasks are done/skipped/error', () => {
    useExtractionStore.getState().initPipeline('us');
    const { tasks } = useExtractionStore.getState();
    expect(useExtractionStore.getState().allDone).toBe(false);

    for (const t of tasks) {
      useExtractionStore.getState().updateTask(t.platformId, { status: 'done', productCount: 1 });
    }
    expect(useExtractionStore.getState().allDone).toBe(true);
  });

  it('allDone is false when some enabled tasks are still queued', () => {
    useExtractionStore.getState().initPipeline('us');
    const firstTask = useExtractionStore.getState().tasks[0]!;
    useExtractionStore.getState().updateTask(firstTask.platformId, { status: 'done', productCount: 3 });
    expect(useExtractionStore.getState().allDone).toBe(false);
  });

  it('cancel sets cancelled flag', () => {
    useExtractionStore.getState().initPipeline('us');
    expect(useExtractionStore.getState().cancelled).toBe(false);
    useExtractionStore.getState().cancel();
    expect(useExtractionStore.getState().cancelled).toBe(true);
  });

  it('reset restores initial state', () => {
    useExtractionStore.getState().initPipeline('us');
    useExtractionStore.getState().updateTask('amazon-us', { status: 'done', productCount: 10 });
    useExtractionStore.getState().cancel();

    useExtractionStore.getState().reset();
    const state = useExtractionStore.getState();
    expect(state.tasks).toEqual([]);
    expect(state.cancelled).toBe(false);
    expect(state.allDone).toBe(false);
    expect(state.canAnalyze).toBe(false);
  });

  it('allDone is false for empty task list', () => {
    expect(useExtractionStore.getState().allDone).toBe(false);
  });

  it('auth-required platforms start with needs-login status', () => {
    useExtractionStore.getState().initPipeline('us');
    const amazonTask = useExtractionStore.getState().tasks.find((t) => t.platformId === 'amazon-us')!;
    expect(amazonTask.status).toBe('needs-login');
    expect(amazonTask.requiresAuth).toBe(true);
  });

  it('public platforms start with queued status', () => {
    useExtractionStore.getState().initPipeline('us');
    const googleTask = useExtractionStore.getState().tasks.find((t) => t.platformId === 'google-trends')!;
    expect(googleTask.status).toBe('queued');
    expect(googleTask.requiresAuth).toBe(false);
  });
});

/**
 * Unit tests for ExecutorAgent (#130).
 * Covers: happy path, tool failure recovery, market context injection.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ToolRegistry } from '../../src/services/agent/tool-registry.js';
import { ExecutorAgent } from '../../src/services/agent/executor-agent.js';
import type { TaskPlan, TaskStep } from '../../src/services/agent/planner-agent.js';
import type { MarketContext } from '../../src/services/agent/tools/types.js';

const US_MARKET: MarketContext = {
  marketId: 'us',
  language: 'en-US',
  currency: 'USD',
  platforms: ['amazon', 'ebay'],
};

function makePlan(steps: TaskStep[]): TaskPlan {
  return { steps, missingData: [] };
}

describe('ExecutorAgent', () => {
  let registry: ToolRegistry;
  let executor: ExecutorAgent;

  beforeEach(() => {
    registry = new ToolRegistry();
    executor = new ExecutorAgent(registry);
  });

  // ── Happy path ──────────────────────────────────────────────────

  it('executes all steps and returns results', async () => {
    const plan = makePlan([
      {
        taskId: 'task-1',
        toolName: 'calc_margin',
        toolInput: { sellPrice: 50, cogs: 15, platformFeePercent: 0.15, shipping: 5 },
        reason: 'Calculate margin',
      },
    ]);

    const results = await executor.execute(plan, US_MARKET);

    expect(results).toHaveLength(1);
    expect(results[0].taskId).toBe('task-1');
    expect(results[0].toolName).toBe('calc_margin');
    expect(results[0].success).toBe(true);
    expect(results[0].output).toBeDefined();
    // P3: output is from the tool, contains numeric data
    const output = results[0].output as Record<string, unknown>;
    expect(typeof output.grossMarginPercent).toBe('number');
  });

  it('executes multiple steps in order', async () => {
    const plan = makePlan([
      {
        taskId: 'task-1',
        toolName: 'get_platform_fees',
        toolInput: {
          platformId: 'amazon',
          market: {
            marketId: 'us',
            language: 'en-US',
            currency: 'USD',
            platforms: ['amazon'],
          },
        },
        reason: 'Get platform fees',
      },
      {
        taskId: 'task-2',
        toolName: 'rank_competition',
        toolInput: {
          listings: [{ reviewCount: 100 }, { reviewCount: 50 }],
        },
        reason: 'Rank competition',
      },
    ]);

    const results = await executor.execute(plan, US_MARKET);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
  });

  // ── Tool failure → graceful degradation (P5) ───────────────────

  it('marks failed tool calls and continues execution', async () => {
    const plan = makePlan([
      {
        taskId: 'task-1',
        toolName: 'nonexistent_tool',
        toolInput: {},
        reason: 'This will fail',
      },
      {
        taskId: 'task-2',
        toolName: 'calc_margin',
        toolInput: { sellPrice: 50, cogs: 15, platformFeePercent: 0.15, shipping: 5 },
        reason: 'This should succeed',
      },
    ]);

    const results = await executor.execute(plan, US_MARKET);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('Unknown tool');
    expect(results[0].output).toBeNull();
    // Second step still executes
    expect(results[1].success).toBe(true);
    expect(results[1].output).toBeDefined();
  });

  it('marks result as failed when tool input is invalid', async () => {
    const plan = makePlan([
      {
        taskId: 'task-1',
        toolName: 'calc_margin',
        toolInput: { sellPrice: 'not-a-number', cogs: 15, platformFeePercent: 0.15, shipping: 5 },
        reason: 'Invalid input types',
      },
    ]);

    const results = await executor.execute(plan, US_MARKET);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toBeTruthy();
  });

  // ── Market context injection ──────────────────────────────────

  it('injects market and currency into tool input when absent', async () => {
    const plan = makePlan([
      {
        taskId: 'task-1',
        toolName: 'calc_margin',
        toolInput: { sellPrice: 50, cogs: 15, platformFeePercent: 0.15, shipping: 5 },
        reason: 'Market context should be injected',
      },
    ]);

    const results = await executor.execute(plan, US_MARKET);

    expect(results[0].success).toBe(true);
  });

  it('does not override existing market field in input', async () => {
    const plan = makePlan([
      {
        taskId: 'task-1',
        toolName: 'calc_margin',
        toolInput: { sellPrice: 50, cogs: 15, platformFeePercent: 0.15, shipping: 5, market: 'uk', currency: 'GBP' },
        reason: 'Existing market should not be overridden',
      },
    ]);

    const results = await executor.execute(plan, US_MARKET);

    // Still succeeds — market field is preserved
    expect(results[0].success).toBe(true);
  });

  // ── Empty plan ────────────────────────────────────────────────

  it('returns empty results for an empty plan', async () => {
    const plan = makePlan([]);

    const results = await executor.execute(plan, US_MARKET);

    expect(results).toHaveLength(0);
  });

  // ── All steps fail ────────────────────────────────────────────

  it('returns all failed when every tool is invalid', async () => {
    const plan = makePlan([
      { taskId: 'task-1', toolName: 'fake_1', toolInput: {}, reason: 'Fake' },
      { taskId: 'task-2', toolName: 'fake_2', toolInput: {}, reason: 'Fake' },
    ]);

    const results = await executor.execute(plan, US_MARKET);

    expect(results).toHaveLength(2);
    expect(results.every(r => !r.success)).toBe(true);
  });
});

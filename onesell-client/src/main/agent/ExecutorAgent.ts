/**
 * ExecutorAgent — Executes a TaskPlan by calling tools from ToolRegistry (P3, P5).
 * Relocated from onesell-backend for v2 client-only architecture.
 */

import type { ToolRegistry } from './ToolRegistry.js';
import type { MarketContext } from './tools/types.js';
import type { TaskPlan, TaskStep } from './PlannerAgent.js';

// ── Types ───────────────────────────────────────────────────────────

export interface ExecutionResult {
  readonly taskId: string;
  readonly toolName: string;
  readonly output: unknown;
  readonly success: boolean;
  readonly error?: string;
}

// ── ExecutorAgent ───────────────────────────────────────────────────

export class ExecutorAgent {
  readonly #registry: ToolRegistry;

  constructor(registry: ToolRegistry) {
    this.#registry = registry;
  }

  async execute(plan: TaskPlan, market: MarketContext): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const step of plan.steps) {
      const result = this.#executeStep(step, market);
      results.push(result);
    }

    return results;
  }

  #executeStep(step: TaskStep, market: MarketContext): ExecutionResult {
    try {
      const tool = this.#registry.resolve(step.toolName);
      const input = this.#injectMarketContext(step.toolInput, market);
      const output = tool.execute(input);

      return {
        taskId: step.taskId,
        toolName: step.toolName,
        output,
        success: true,
      };
    } catch (err) {
      // P5: Mark failed and continue — do not throw
      return {
        taskId: step.taskId,
        toolName: step.toolName,
        output: null,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  #injectMarketContext(
    input: Record<string, unknown>,
    market: MarketContext,
  ): Record<string, unknown> {
    const enriched = { ...input };

    if (!('market' in enriched)) {
      enriched.market = market.marketId;
    }

    if (!('currency' in enriched) && market.currency) {
      enriched.currency = market.currency;
    }

    return enriched;
  }
}

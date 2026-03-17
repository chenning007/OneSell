/**
 * ExecutorAgent — Executes a TaskPlan by calling tools from ToolRegistry (P3, P5).
 *
 * Iterates the ordered task steps, resolves each tool, executes with input,
 * and collects results. Failed tool calls are marked as failed and execution
 * continues (P5: graceful degradation).
 *
 * All numeric values come from tool outputs only (P3).
 *
 * Closes #130
 */

import type { ToolRegistry } from './tool-registry.js';
import type { MarketContext } from './tools/types.js';
import type { TaskPlan, TaskStep } from './planner-agent.js';

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

      // Inject market context into tool input if the tool expects it
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
    // If input already has market fields, don't override
    const enriched = { ...input };

    // Inject marketId if tool expects 'market' as a string
    if (!('market' in enriched)) {
      enriched.market = market.marketId;
    }

    // Inject currency if tool expects it
    if (!('currency' in enriched) && market.currency) {
      enriched.currency = market.currency;
    }

    return enriched;
  }
}

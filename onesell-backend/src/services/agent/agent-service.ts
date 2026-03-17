/**
 * AgentService — Orchestrates the full Planner → Executor → Synthesizer pipeline.
 *
 * Manages status progression through Redis, handles partial failures (P5),
 * and stores final results with TTL.
 *
 * Closes #134
 */

import type { LLMProvider } from './llm-provider.js';
import type { MarketContext } from './tools/types.js';
import { ToolRegistry } from './tool-registry.js';
import { PlannerAgent, type UserPreferences, type ExtractionDataSource } from './planner-agent.js';
import { ExecutorAgent, type ExecutionResult } from './executor-agent.js';
import { SynthesizerAgent, type ProductCard } from './synthesizer-agent.js';
import { setStatus, storeResults, type SessionStatus } from '../redis.js';

// ── Types ───────────────────────────────────────────────────────────

export type AnalysisStage = 'planning' | 'executing' | 'synthesizing' | 'complete' | 'error';

export interface AnalysisResult {
  readonly sessionId: string;
  readonly status: AnalysisStage;
  readonly products: readonly ProductCard[];
  readonly executionResults: readonly ExecutionResult[];
  readonly missingData: readonly string[];
  readonly error?: string;
}

// ── Dependencies (injectable for testing) ───────────────────────────

export interface AgentServiceDeps {
  readonly llm: LLMProvider;
  readonly registry: ToolRegistry;
  readonly setStatus: (sessionId: string, status: SessionStatus) => Promise<boolean>;
  readonly storeResults: (sessionId: string, results: unknown) => Promise<boolean>;
}

// ── AgentService ────────────────────────────────────────────────────

export class AgentService {
  readonly #planner: PlannerAgent;
  readonly #executor: ExecutorAgent;
  readonly #synthesizer: SynthesizerAgent;
  readonly #setStatus: AgentServiceDeps['setStatus'];
  readonly #storeResults: AgentServiceDeps['storeResults'];

  constructor(deps: AgentServiceDeps) {
    this.#planner = new PlannerAgent(deps.llm, deps.registry);
    this.#executor = new ExecutorAgent(deps.registry);
    this.#synthesizer = new SynthesizerAgent(deps.llm);
    this.#setStatus = deps.setStatus;
    this.#storeResults = deps.storeResults;
  }

  /** Convenience factory using real Redis. */
  static create(llm: LLMProvider, registry?: ToolRegistry): AgentService {
    return new AgentService({
      llm,
      registry: registry ?? new ToolRegistry(),
      setStatus,
      storeResults,
    });
  }

  async analyze(
    sessionId: string,
    extractionData: readonly ExtractionDataSource[],
    preferences: UserPreferences,
    market: MarketContext,
  ): Promise<AnalysisResult> {
    // ── Planning ──────────────────────────────────────────────────
    await this.#updateStatus(sessionId, 'planning', 'Generating analysis plan…');

    let plan;
    try {
      plan = await this.#planner.plan(preferences, extractionData, market);
    } catch (err) {
      return this.#fail(sessionId, 'Planning failed', err);
    }

    // ── Executing ─────────────────────────────────────────────────
    await this.#updateStatus(sessionId, 'executing', `Running ${plan.steps.length} analysis tasks…`);

    let executionResults: ExecutionResult[];
    try {
      executionResults = await this.#executor.execute(plan, market);
    } catch (err) {
      return this.#fail(sessionId, 'Execution failed', err);
    }

    // ── Synthesizing ──────────────────────────────────────────────
    await this.#updateStatus(sessionId, 'synthesizing', 'Generating product recommendations…');

    let products: ProductCard[];
    try {
      products = await this.#synthesizer.synthesize(executionResults, preferences, market);
    } catch (err) {
      // P5: Return partial results with execution data if synthesis fails
      const partial: AnalysisResult = {
        sessionId,
        status: 'error',
        products: [],
        executionResults,
        missingData: plan.missingData as string[],
        error: `Synthesis failed: ${err instanceof Error ? err.message : String(err)}`,
      };
      await this.#updateStatus(sessionId, 'error', partial.error);
      await this.#storeResults(sessionId, partial);
      return partial;
    }

    // ── Complete ──────────────────────────────────────────────────
    const result: AnalysisResult = {
      sessionId,
      status: 'complete',
      products,
      executionResults,
      missingData: plan.missingData as string[],
    };

    await this.#updateStatus(sessionId, 'complete', 'Analysis complete');
    await this.#storeResults(sessionId, result);

    return result;
  }

  async #updateStatus(sessionId: string, stage: AnalysisStage, message: string): Promise<void> {
    await this.#setStatus(sessionId, {
      status: stage,
      step: stage,
      message,
      updatedAt: new Date().toISOString(),
    });
  }

  async #fail(sessionId: string, context: string, err: unknown): Promise<AnalysisResult> {
    const errorMsg = `${context}: ${err instanceof Error ? err.message : String(err)}`;
    await this.#updateStatus(sessionId, 'error', errorMsg);

    const result: AnalysisResult = {
      sessionId,
      status: 'error',
      products: [],
      executionResults: [],
      missingData: [],
      error: errorMsg,
    };
    await this.#storeResults(sessionId, result);
    return result;
  }
}

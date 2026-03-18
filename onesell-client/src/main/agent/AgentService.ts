/**
 * AgentService — Orchestrates the Planner → Executor → Synthesizer pipeline.
 * Relocated from onesell-backend for v2 client-only architecture.
 *
 * v2 changes:
 * - No Redis dependency — status tracked in-memory via callback
 * - No server-side result storage — results returned directly
 * - API key comes from ApiKeyManager, not env
 */

import type { LLMProvider } from './LLMProvider.js';
import type { MarketContext } from './tools/types.js';
import { ToolRegistry } from './ToolRegistry.js';
import { PlannerAgent, type UserPreferences, type ExtractionDataSource } from './PlannerAgent.js';
import { ExecutorAgent, type ExecutionResult } from './ExecutorAgent.js';
import { SynthesizerAgent, type ProductCard } from './SynthesizerAgent.js';

// ── Types ───────────────────────────────────────────────────────────

export type AnalysisStage = 'planning' | 'executing' | 'synthesizing' | 'complete' | 'error';

export interface AnalysisStatus {
  readonly status: AnalysisStage;
  readonly step: string;
  readonly message: string;
  readonly updatedAt: string;
}

export interface AnalysisResult {
  readonly sessionId: string;
  readonly status: AnalysisStage;
  readonly products: readonly ProductCard[];
  readonly executionResults: readonly ExecutionResult[];
  readonly missingData: readonly string[];
  readonly error?: string;
}

/** Callback for pushing status updates to the renderer via IPC. */
export type StatusCallback = (status: AnalysisStatus) => void;

// ── Dependencies (injectable for testing) ───────────────────────────

export interface AgentServiceDeps {
  readonly llm: LLMProvider;
  readonly registry: ToolRegistry;
  readonly onStatus?: StatusCallback;
}

// ── AgentService ────────────────────────────────────────────────────

export class AgentService {
  readonly #planner: PlannerAgent;
  readonly #executor: ExecutorAgent;
  readonly #synthesizer: SynthesizerAgent;
  readonly #onStatus: StatusCallback | undefined;

  constructor(deps: AgentServiceDeps) {
    this.#planner = new PlannerAgent(deps.llm, deps.registry);
    this.#executor = new ExecutorAgent(deps.registry);
    this.#synthesizer = new SynthesizerAgent(deps.llm);
    this.#onStatus = deps.onStatus;
  }

  static create(llm: LLMProvider, onStatus?: StatusCallback): AgentService {
    return new AgentService({
      llm,
      registry: new ToolRegistry(),
      onStatus,
    });
  }

  async analyze(
    sessionId: string,
    extractionData: readonly ExtractionDataSource[],
    preferences: UserPreferences,
    market: MarketContext,
  ): Promise<AnalysisResult> {
    // ── Planning ──────────────────────────────────────────────────
    this.#emitStatus('planning', 'Generating analysis plan…');

    let plan;
    try {
      plan = await this.#planner.plan(preferences, extractionData, market);
    } catch (err) {
      return this.#fail(sessionId, 'Planning failed', err);
    }

    // ── Executing ─────────────────────────────────────────────────
    this.#emitStatus('executing', `Running ${plan.steps.length} analysis tasks…`);

    let executionResults: ExecutionResult[];
    try {
      executionResults = await this.#executor.execute(plan, market);
    } catch (err) {
      return this.#fail(sessionId, 'Execution failed', err);
    }

    // ── Synthesizing ──────────────────────────────────────────────
    this.#emitStatus('synthesizing', 'Generating product recommendations…');

    let products: ProductCard[];
    try {
      products = await this.#synthesizer.synthesize(executionResults, preferences, market);
    } catch (err) {
      // P5: Return partial results with execution data if synthesis fails
      this.#emitStatus('error', `Synthesis failed: ${err instanceof Error ? err.message : String(err)}`);
      return {
        sessionId,
        status: 'error',
        products: [],
        executionResults,
        missingData: plan.missingData as string[],
        error: `Synthesis failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // ── Complete ──────────────────────────────────────────────────
    this.#emitStatus('complete', 'Analysis complete');

    return {
      sessionId,
      status: 'complete',
      products,
      executionResults,
      missingData: plan.missingData as string[],
    };
  }

  #emitStatus(stage: AnalysisStage, message: string): void {
    this.#onStatus?.({
      status: stage,
      step: stage,
      message,
      updatedAt: new Date().toISOString(),
    });
  }

  #fail(sessionId: string, context: string, err: unknown): AnalysisResult {
    const errorMsg = `${context}: ${err instanceof Error ? err.message : String(err)}`;
    this.#emitStatus('error', errorMsg);

    return {
      sessionId,
      status: 'error',
      products: [],
      executionResults: [],
      missingData: [],
      error: errorMsg,
    };
  }
}

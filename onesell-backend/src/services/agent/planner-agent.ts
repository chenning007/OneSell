/**
 * PlannerAgent — Produces a TaskPlan from user preferences + extraction data (P3, P4, P5, P9).
 *
 * Takes wizard data, available data sources, and MarketContext.
 * Calls LLMProvider with the planner system prompt.
 * Returns a validated TaskPlan: ordered array of tasks for the Executor.
 *
 * Closes #128
 */

import { z } from 'zod';
import type { LLMProvider, ChatMessage } from './llm-provider.js';
import type { MarketContext } from './tools/types.js';
import { loadPrompts, sanitizeUserInput } from './prompt-loader.js';
import type { ToolRegistry } from './tool-registry.js';

// ── Types ───────────────────────────────────────────────────────────

export interface TaskStep {
  readonly taskId: string;
  readonly toolName: string;
  readonly toolInput: Record<string, unknown>;
  readonly reason: string;
}

export interface TaskPlan {
  readonly steps: readonly TaskStep[];
  readonly missingData: readonly string[];
}

export interface UserPreferences {
  readonly budget?: number;
  readonly preferredPlatforms?: readonly string[];
  readonly categories?: readonly string[];
  readonly riskTolerance?: 'low' | 'medium' | 'high';
  readonly fulfillmentPreference?: string;
}

export interface ExtractionDataSource {
  readonly platformId: string;
  readonly available: boolean;
  readonly data?: unknown;
}

// ── Zod validation for LLM output (P9) ─────────────────────────────

const taskStepSchema = z.object({
  taskId: z.string().min(1),
  toolName: z.string().min(1),
  toolInput: z.record(z.unknown()),
  reason: z.string().min(1),
});

const taskPlanSchema = z.object({
  steps: z.array(taskStepSchema).min(1),
  missingData: z.array(z.string()).default([]),
});

// ── PlannerAgent ────────────────────────────────────────────────────

export class PlannerAgent {
  readonly #llm: LLMProvider;
  readonly #registry: ToolRegistry;

  constructor(llm: LLMProvider, registry: ToolRegistry) {
    this.#llm = llm;
    this.#registry = registry;
  }

  async plan(
    preferences: UserPreferences,
    dataSources: readonly ExtractionDataSource[],
    market: MarketContext,
  ): Promise<TaskPlan> {
    const prompts = loadPrompts(market);
    const availableTools = this.#registry.getAll().map(t => t.name);

    // Sanitize user-provided strings (P9)
    const sanitizedPrefs = {
      ...preferences,
      categories: preferences.categories?.map(c => sanitizeUserInput(c)),
      fulfillmentPreference: preferences.fulfillmentPreference
        ? sanitizeUserInput(preferences.fulfillmentPreference)
        : undefined,
    };

    // Build user message with available data context
    const availableSources = dataSources.filter(s => s.available);
    const missingSources = dataSources.filter(s => !s.available).map(s => s.platformId);

    const userMessage = JSON.stringify({
      preferences: sanitizedPrefs,
      availableDataSources: availableSources.map(s => s.platformId),
      missingDataSources: missingSources,
      availableTools,
      market: { marketId: market.marketId, currency: market.currency, platforms: market.platforms },
    });

    const messages: ChatMessage[] = [
      { role: 'system', content: prompts.planner },
      { role: 'user', content: userMessage },
    ];

    const response = await this.#llm.chat(messages, {
      temperature: 0.2,
      maxTokens: 2048,
    });

    return this.#parseResponse(response.content, missingSources);
  }

  #parseResponse(content: string, missingSources: string[]): TaskPlan {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) ?? content.match(/(\{[\s\S]*\})/);
    const raw = jsonMatch?.[1]?.trim() ?? content.trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // If LLM returned a non-JSON task list, build a minimal plan
      return this.#fallbackPlan(missingSources);
    }

    const result = taskPlanSchema.safeParse(parsed);
    if (!result.success) {
      return this.#fallbackPlan(missingSources);
    }

    // Validate that all referenced tools exist
    const validSteps = result.data.steps.filter(step => {
      try {
        this.#registry.resolve(step.toolName);
        return true;
      } catch {
        return false;
      }
    });

    if (validSteps.length === 0) {
      return this.#fallbackPlan(missingSources);
    }

    return {
      steps: validSteps,
      missingData: [...result.data.missingData, ...missingSources],
    };
  }

  #fallbackPlan(missingSources: string[]): TaskPlan {
    // Minimal fallback: run compare_products with whatever data is available
    return {
      steps: [
        {
          taskId: 'fallback-1',
          toolName: 'compare_products',
          toolInput: { products: [] },
          reason: 'Fallback plan — LLM output was not parseable',
        },
      ],
      missingData: missingSources,
    };
  }
}

/**
 * SynthesizerAgent — Produces ranked ProductCard[] from execution results (P3, P4, P9).
 * Relocated from onesell-backend for v2 client-only architecture.
 */

import { z } from 'zod';
import type { LLMProvider, ChatMessage } from './LLMProvider.js';
import type { MarketContext } from './tools/types.js';
import type { UserPreferences } from './PlannerAgent.js';
import type { ExecutionResult } from './ExecutorAgent.js';
import { loadPrompts } from './prompt-loader.js';

// ── Types ───────────────────────────────────────────────────────────

export interface ProductCard {
  readonly rank: number;
  readonly name: string;
  readonly compositeScore: number;
  readonly marginEstimate: number | null;
  readonly riskLevel: 'low' | 'medium' | 'high';
  readonly reasons: readonly string[];
  readonly category: string;
}

// ── Zod validation (P9) ────────────────────────────────────────────

const productCardSchema = z.object({
  rank: z.number().int().min(1),
  name: z.string().min(1),
  compositeScore: z.number().min(0).max(100),
  marginEstimate: z.number().nullable().default(null),
  riskLevel: z.enum(['low', 'medium', 'high']),
  reasons: z.array(z.string()).min(1),
  category: z.string().min(1),
});

const productCardsSchema = z.array(productCardSchema).min(1);

// ── SynthesizerAgent ────────────────────────────────────────────────

export class SynthesizerAgent {
  readonly #llm: LLMProvider;

  constructor(llm: LLMProvider) {
    this.#llm = llm;
  }

  async synthesize(
    executionResults: readonly ExecutionResult[],
    preferences: UserPreferences,
    market: MarketContext,
  ): Promise<ProductCard[]> {
    const prompts = loadPrompts(market);

    const successfulResults = executionResults.filter(r => r.success);
    const failedResults = executionResults.filter(r => !r.success);

    const userMessage = JSON.stringify({
      executionResults: successfulResults.map(r => ({
        taskId: r.taskId,
        toolName: r.toolName,
        output: r.output,
      })),
      failedTasks: failedResults.map(r => ({
        taskId: r.taskId,
        toolName: r.toolName,
        error: r.error,
      })),
      preferences: {
        budget: preferences.budget,
        riskTolerance: preferences.riskTolerance,
        productType: preferences.productType,
        fulfillmentTime: preferences.fulfillmentTime,
      },
      market: {
        marketId: market.marketId,
        currency: market.currency,
        language: market.language,
      },
      outputFormat: 'Return a JSON array of ProductCard objects with fields: rank, name, compositeScore, marginEstimate, riskLevel, reasons[], category',
    });

    const messages: ChatMessage[] = [
      { role: 'system', content: prompts.synthesizer },
      { role: 'user', content: userMessage },
    ];

    const response = await this.#llm.chat(messages, {
      temperature: 0.3,
      maxTokens: 4096,
    });

    return this.#parseResponse(response.content);
  }

  #parseResponse(content: string): ProductCard[] {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) ?? content.match(/(\[[\s\S]*\])/);
    const raw = jsonMatch?.[1]?.trim() ?? content.trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('Synthesizer output is not valid JSON');
    }

    const result = productCardsSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Synthesizer output validation failed: ${result.error.message}`);
    }

    return result.data.map((card, idx) => ({
      ...card,
      rank: idx + 1,
    }));
  }
}

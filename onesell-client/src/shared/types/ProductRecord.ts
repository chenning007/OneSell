import type { MarketContext } from './MarketContext.js';

export interface MoneyAmount {
  readonly value: number;
  readonly currency: string; // ISO 4217
}

export interface RiskFlag {
  readonly code: string;
  readonly severity: 'low' | 'medium' | 'high';
  readonly description: string;
}

export interface ScoreBreakdown {
  readonly demand: number;       // 0–100
  readonly competition: number;  // 0–100 (lower = less competition = better)
  readonly margin: number;       // 0–100
  readonly trend: number;        // 0–100
  readonly beginner: number;     // 0–100 (suitability for new sellers)
}

/**
 * ProductRecord — inter-module pipeline contract.
 * Produced by Scout, consumed by Sourcing / Listing / Campaigns.
 * Downstream modules NEVER modify Scout module internals. (Architectural Principle P7)
 *
 * See docs/ARCHITECTURE.md §4.3
 */
export interface ProductRecord {
  readonly productName: string;
  readonly market: MarketContext;
  readonly category: string;
  readonly overallScore: number;            // 0–100, computed by tools
  readonly estimatedCogs: MoneyAmount;
  readonly estimatedSellPrice: MoneyAmount;
  readonly estimatedMargin: number;         // 0.0–1.0 (NOT percentage)
  readonly primaryPlatform: string;
  readonly supplierSearchTerms: readonly string[];
  readonly riskFlags: readonly RiskFlag[];
  readonly agentJustification: string;      // LLM-authored reasoning text only
  readonly rawScores: ScoreBreakdown;
}

/**
 * ReasoningStep — one step in the agent's decision chain for a product.
 * Shows what tool was used, what data values it operated on, and the insight derived.
 */
export interface ReasoningStep {
  readonly stepNumber: number;
  readonly action: string;          // e.g. "Analyzed market competition"
  readonly toolUsed: string;        // e.g. "rank_competition"
  readonly dataValues: Readonly<Record<string, string | number>>;
  readonly insight: string;         // plain-English conclusion
}

/**
 * ProductCard — the UI-facing view of ProductRecord (adds display fields).
 * Returned by GET /analysis/:sessionId/results
 */
export interface ProductCard extends ProductRecord {
  readonly cardId: string;
  readonly rank: number;
  readonly marketInsight: string; // LLM-authored market context for this product
  readonly reasoningSteps?: readonly ReasoningStep[];
}

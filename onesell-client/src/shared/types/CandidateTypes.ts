/**
 * v2 Result Types — Categorized candidates with per-product reasoning.
 *
 * PRD §8, ADR-005 D3:
 * - ProductCandidate extends ProductCard with reasoning, source platforms, risk flags
 * - CandidateCategory groups candidates under an opportunity theme
 * - AnalysisResult wraps categories with session metadata
 *
 * Zod schemas provided for boundary validation (P9).
 */

import { z } from 'zod';
import type { ProductCard } from './ProductRecord.js';

// ── TypeScript interfaces ───────────────────────────────────────────

/**
 * ProductCandidate — extends ProductCard with per-product reasoning (v2).
 * Used in the Results Dashboard to show categorized recommendations.
 *
 * Note: `riskFlags` is inherited from ProductRecord as `readonly RiskFlag[]`.
 * Simple string risk flags for v2 UI are in `candidateRiskFlags`.
 */
export interface ProductCandidate extends ProductCard {
  /** One-line summary reason, ≤120 characters, shown in collapsed row. */
  readonly oneLineReason: string;
  /** 3–5 plain-English bullets explaining why this product is recommended. */
  readonly whyBullets: readonly string[];
  /** Which extracted platforms provided data for this candidate. */
  readonly sourcePlatforms: ReadonlyArray<{
    readonly platformId: string;
    readonly dataPoints: readonly string[];
  }>;
  /** Optional simple string risk flags for v2 UI display. */
  readonly candidateRiskFlags?: readonly string[];
}

/**
 * CandidateCategory — a group of candidates under a common opportunity theme.
 */
export interface CandidateCategory {
  readonly name: string;
  readonly products: readonly ProductCandidate[];
}

/**
 * AnalysisResult — the top-level v2 agent output wrapping categorized candidates.
 */
export interface AnalysisResult {
  readonly categories: readonly CandidateCategory[];
  /** ISO 8601 timestamp when the analysis was generated. */
  readonly generatedAt: string;
  /** The market this analysis was performed for. */
  readonly marketId: string;
}

// ── Zod schemas (P9: validate at boundary) ──────────────────────────

/** Schema for the sourcePlatforms entry on ProductCandidate. */
const sourcePlatformSchema = z.object({
  platformId: z.string().min(1).max(64),
  dataPoints: z.array(z.string().min(1)).min(1),
});

/**
 * Zod schema for ProductCandidate.
 *
 * Note: This validates the *extension* fields added by ProductCandidate.
 * The base ProductCard fields are assumed to already be validated at their
 * own boundary. Use `productCandidateFullSchema` for full validation
 * including base fields.
 */
export const productCandidateExtensionSchema = z.object({
  oneLineReason: z.string().min(1).max(120),
  whyBullets: z.array(z.string().min(1)).min(3).max(5),
  sourcePlatforms: z.array(sourcePlatformSchema).min(1),
  candidateRiskFlags: z.array(z.string().min(1)).optional(),
});

/** Full ProductCandidate schema including base ProductCard fields. */
export const productCandidateSchema = z.object({
  // Base ProductRecord fields
  productName: z.string().min(1),
  market: z.object({
    marketId: z.enum(['us', 'cn', 'uk', 'de', 'jp', 'sea', 'au']),
    language: z.string(),
    currency: z.string(),
    platforms: z.array(z.string()),
  }),
  category: z.string().min(1),
  overallScore: z.number().min(0).max(100),
  estimatedCogs: z.object({ value: z.number(), currency: z.string() }),
  estimatedSellPrice: z.object({ value: z.number(), currency: z.string() }),
  estimatedMargin: z.number().min(0).max(1),
  primaryPlatform: z.string().min(1),
  supplierSearchTerms: z.array(z.string()),
  riskFlags: z.array(z.object({
    code: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    description: z.string(),
  })).optional(),
  agentJustification: z.string(),
  rawScores: z.object({
    demand: z.number().min(0).max(100),
    competition: z.number().min(0).max(100),
    margin: z.number().min(0).max(100),
    trend: z.number().min(0).max(100),
    beginner: z.number().min(0).max(100),
  }),
  // Base ProductCard fields
  cardId: z.string().min(1),
  rank: z.number().int().min(1),
  marketInsight: z.string(),
  reasoningSteps: z.array(z.object({
    stepNumber: z.number().int().min(1),
    action: z.string(),
    toolUsed: z.string(),
    dataValues: z.record(z.union([z.string(), z.number()])),
    insight: z.string(),
  })).optional(),
  // ProductCandidate extension fields
  oneLineReason: z.string().min(1).max(120),
  whyBullets: z.array(z.string().min(1)).min(3).max(5),
  sourcePlatforms: z.array(sourcePlatformSchema).min(1),
});

/** Zod schema for CandidateCategory. */
export const candidateCategorySchema = z.object({
  name: z.string().min(1),
  products: z.array(productCandidateSchema).min(1),
});

/** Zod schema for AnalysisResult (v2 top-level output). */
export const analysisResultSchema = z.object({
  categories: z.array(candidateCategorySchema).min(1),
  generatedAt: z.string().datetime(),
  marketId: z.string().min(1).max(16),
});

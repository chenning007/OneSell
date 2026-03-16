/**
 * Shared types for agent tool functions.
 * All tools are pure, synchronous functions with no side effects (P3).
 */

// ── Tool interface (ARCHITECTURE §7.2) ──────────────────────────────

export interface Tool<TInput, TOutput> {
  readonly name: string;
  readonly description: string;
  execute(input: TInput): TOutput;
}

// ── MarketId (mirrors onesell-client/src/shared/types/MarketContext.ts) ─────

export type MarketId = 'us' | 'cn' | 'uk' | 'de' | 'jp' | 'sea' | 'au';

// ── calc_margin ─────────────────────────────────────────────────────

export interface CalcMarginInput {
  readonly sellPrice: number;
  readonly cogs: number;
  readonly platformFeePercent: number;  // 0–1 (e.g. 0.15 = 15%)
  readonly shipping: number;
  readonly market: MarketId;
  readonly currency: string;            // ISO 4217
}

export interface MarginResult {
  readonly grossMarginPercent: number;   // 0–1
  readonly netMarginPercent: number;     // 0–1
  readonly profitPerUnit: number;        // in local currency
  readonly currency: string;
  readonly error?: string;               // set when inputs are invalid
}

// ── rank_competition ────────────────────────────────────────────────

export interface ListingData {
  readonly reviewCount: number;
  readonly sellerAge?: number;           // months
  readonly salesVolume?: number;         // monthly units
}

export interface RankCompetitionInput {
  readonly listings: readonly ListingData[];
  readonly market: MarketId;
}

export interface CompetitionResult {
  readonly score: number;                // 0–100, higher = easier entry
  readonly narrative: string;
}

// ── score_trend ─────────────────────────────────────────────────────

export interface TimeSeriesPoint {
  readonly date: string;                 // ISO date string
  readonly value: number;                // normalized 0–100
}

export type TrendDirection = 'rising' | 'falling' | 'stable' | 'seasonal' | 'unknown';

export interface ScoreTrendInput {
  readonly timeSeries: readonly TimeSeriesPoint[];
  readonly market: MarketId;
}

export interface TrendResult {
  readonly direction: TrendDirection;
  readonly growthPercent: number;
  readonly seasonality: boolean;
  readonly score: number;                // 0–100
}

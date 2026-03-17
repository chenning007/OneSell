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

// ── MarketId & MarketContext (mirrors onesell-client/src/shared/types/MarketContext.ts) ─

export type MarketId = 'us' | 'cn' | 'uk' | 'de' | 'jp' | 'sea' | 'au';

export interface MarketContext {
  readonly marketId: MarketId;
  readonly language: string;     // BCP-47 language tag
  readonly currency: string;     // ISO 4217 currency code
  readonly platforms: readonly string[];
}

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

// ── flag_beginner_risk ──────────────────────────────────────────────

export type RiskLevel = 'SAFE' | 'FLAGGED' | 'WARNING';

export interface FlagBeginnerRiskInput {
  readonly category: string;
  readonly weight?: number;              // kg
  readonly regulatoryKeywords?: readonly string[];
  readonly market: MarketContext;
}

export interface BeginnerRiskResult {
  readonly riskLevel: RiskLevel;
  readonly reasons: readonly string[];
}

// ── compare_products ────────────────────────────────────────────────

export interface ProductComparison {
  readonly name: string;
  readonly marginPercent: number;
  readonly competitionScore: number;
  readonly trendScore: number;
  readonly riskLevel: string;
}

export interface CompareProductsInput {
  readonly products: readonly ProductComparison[];
}

export interface RankedProduct {
  readonly name: string;
  readonly compositeScore: number;
  readonly rank: number;
}

export interface CompareProductsResult {
  readonly ranked: readonly RankedProduct[];
}

// ── estimate_cogs ───────────────────────────────────────────────────

export interface EstimateCOGSInput {
  readonly unitCostUSD: number;
  readonly shippingCostUSD?: number;
  readonly quantity?: number;
  readonly targetCurrency: string;
  readonly exchangeRates: Readonly<Record<string, number>>;
}

export interface COGSResult {
  readonly totalCOGS: number;
  readonly perUnitCOGS: number;
  readonly currency: string;
}

// ── get_platform_fees ───────────────────────────────────────────────

export interface GetPlatformFeesInput {
  readonly platformId: string;
  readonly market: MarketContext;
}

export interface PlatformFeesResult {
  readonly platformId: string;
  readonly commissionPercent: number;
  readonly listingFee: number;
  readonly paymentProcessingPercent: number;
  readonly currency: string;
  readonly notes: string;
}

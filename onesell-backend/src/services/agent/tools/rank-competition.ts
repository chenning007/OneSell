/**
 * rank_competition — Competition accessibility scoring tool (P3, P4).
 *
 * Pure function: deterministic, market-aware, no LLM involvement.
 * Higher score = easier for a beginner to enter the market.
 *
 * Closes #110
 */

import type { Tool, RankCompetitionInput, CompetitionResult, MarketId } from './types.js';

/**
 * Market-specific thresholds for "saturated" competition.
 * These are configuration data, not hardcoded logic (P8).
 */
const SATURATION_THRESHOLDS: Record<MarketId, { reviewsSaturated: number; reviewsModerate: number }> = {
  us:  { reviewsSaturated: 10_000, reviewsModerate: 1_000 },
  cn:  { reviewsSaturated: 5_000,  reviewsModerate: 500 },
  uk:  { reviewsSaturated: 5_000,  reviewsModerate: 500 },
  de:  { reviewsSaturated: 3_000,  reviewsModerate: 300 },
  jp:  { reviewsSaturated: 1_000,  reviewsModerate: 100 },
  sea: { reviewsSaturated: 2_000,  reviewsModerate: 200 },
  au:  { reviewsSaturated: 2_000,  reviewsModerate: 200 },
};

function rankCompetitionExecute(input: RankCompetitionInput): CompetitionResult {
  const { listings, market } = input;

  // Empty listings → maximum accessibility (no visible competition)
  if (listings.length === 0) {
    return { score: 100, narrative: 'No competing listings found — wide open market.' };
  }

  const thresholds = SATURATION_THRESHOLDS[market];

  // ── 1. Review density score (0–100, higher = less competition) ────
  const avgReviews = listings.reduce((sum, l) => sum + l.reviewCount, 0) / listings.length;
  let reviewScore: number;
  if (avgReviews >= thresholds.reviewsSaturated) {
    reviewScore = 0;
  } else if (avgReviews <= 10) {
    reviewScore = 100;
  } else {
    // Linear interpolation between 10 and saturated
    reviewScore = Math.round(100 * (1 - (avgReviews - 10) / (thresholds.reviewsSaturated - 10)));
  }

  // ── 2. Seller concentration score (0–100) ─────────────────────────
  // Fewer sellers = less competition (but could mean low opportunity too)
  // Sweet spot is 5–50 competitors; >200 is crowded
  const sellerCount = listings.length;
  let sellerScore: number;
  if (sellerCount <= 5) {
    sellerScore = 95;   // Almost no competition
  } else if (sellerCount <= 50) {
    sellerScore = 80;   // Healthy, manageable
  } else if (sellerCount <= 200) {
    sellerScore = Math.round(80 - ((sellerCount - 50) / 150) * 50); // 80 → 30
  } else {
    sellerScore = Math.max(5, Math.round(30 - ((sellerCount - 200) / 300) * 25)); // 30 → 5
  }

  // ── 3. Seller maturity score (0–100) if age data available ────────
  const withAge = listings.filter(l => l.sellerAge != null && l.sellerAge! > 0);
  let maturityScore = 50; // neutral default
  if (withAge.length > 0) {
    const avgAge = withAge.reduce((sum, l) => sum + l.sellerAge!, 0) / withAge.length;
    // Young sellers (< 6 months avg) = easier market
    if (avgAge < 6) {
      maturityScore = 90;
    } else if (avgAge < 24) {
      maturityScore = 60;
    } else if (avgAge < 60) {
      maturityScore = 35;
    } else {
      maturityScore = 15; // deeply entrenched sellers
    }
  }

  // ── Weighted composite ────────────────────────────────────────────
  const score = Math.round(reviewScore * 0.5 + sellerScore * 0.25 + maturityScore * 0.25);
  const clampedScore = Math.max(0, Math.min(100, score));

  // ── Narrative ─────────────────────────────────────────────────────
  let narrative: string;
  if (clampedScore >= 80) {
    narrative = `Low competition: average ${Math.round(avgReviews)} reviews across ${sellerCount} sellers — strong entry opportunity.`;
  } else if (clampedScore >= 50) {
    narrative = `Moderate competition: average ${Math.round(avgReviews)} reviews across ${sellerCount} sellers — viable with differentiation.`;
  } else if (clampedScore >= 25) {
    narrative = `High competition: average ${Math.round(avgReviews)} reviews across ${sellerCount} sellers — challenging for new entrants.`;
  } else {
    narrative = `Saturated market: average ${Math.round(avgReviews)} reviews across ${sellerCount} sellers — very difficult for beginners.`;
  }

  return { score: clampedScore, narrative };
}

export const rankCompetition: Tool<RankCompetitionInput, CompetitionResult> = {
  name: 'rank_competition',
  description: 'Score competition accessibility (0–100) for a product niche based on listing data and market-specific thresholds. Higher score = easier entry for beginners.',
  execute: rankCompetitionExecute,
};

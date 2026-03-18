/**
 * compare_products — Compare and rank products by composite score (P3).
 * Relocated from onesell-backend for v2 client-only architecture.
 */

import type { Tool, CompareProductsInput, CompareProductsResult, RankedProduct } from './types.js';

const WEIGHTS = {
  margin: 0.35,
  trend: 0.30,
  competition: 0.25,
  risk: 0.10,
} as const;

const RISK_BONUS: Record<string, number> = {
  SAFE: 100,
  WARNING: 50,
  FLAGGED: 0,
};

function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function compareProductsExecute(input: CompareProductsInput): CompareProductsResult {
  const { products } = input;

  if (!products || products.length === 0) {
    return { ranked: [] };
  }

  const scored: RankedProduct[] = products.map(p => {
    const margin = safeNum(p.marginPercent);
    const trend = safeNum(p.trendScore);
    const competition = safeNum(p.competitionScore);
    const riskBonus = RISK_BONUS[(p.riskLevel ?? '').toUpperCase()] ?? 0;

    const compositeScore =
      (margin * WEIGHTS.margin) +
      (trend * WEIGHTS.trend) +
      ((100 - competition) * WEIGHTS.competition) +
      (riskBonus * WEIGHTS.risk);

    return {
      name: p.name ?? '',
      compositeScore: Math.round(compositeScore * 100) / 100,
      rank: 0,
    };
  });

  scored.sort((a, b) => b.compositeScore - a.compositeScore);

  const ranked: RankedProduct[] = scored.map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));

  return { ranked };
}

export const compareProducts: Tool<CompareProductsInput, CompareProductsResult> = {
  name: 'compare_products',
  description: 'Compare multiple products and rank them by a composite score combining margin, trend, competition, and risk factors.',
  execute: compareProductsExecute,
};

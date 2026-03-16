/**
 * score_trend — Trend scoring for search index time series (P3).
 *
 * Pure function: deterministic, handles both Google Trends and Baidu Index.
 * Detects rising/falling/stable/seasonal patterns and calculates growth %.
 *
 * Closes #112
 */

import type { Tool, ScoreTrendInput, TrendResult, TrendDirection, TimeSeriesPoint } from './types.js';

/**
 * Calculate linear regression slope for a numeric series.
 * Returns the slope per data point (change in value per step).
 */
function linearSlope(values: readonly number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - xMean;
    numerator += dx * (values[i] - yMean);
    denominator += dx * dx;
  }

  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Detect seasonality via autocorrelation at common periods.
 * A periodic pattern with high self-correlation indicates seasonality.
 */
function detectSeasonality(values: readonly number[]): boolean {
  if (values.length < 8) return false;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  if (variance < 1) return false; // flat series — no pattern

  // Check autocorrelation at period = length/4 (quarterly) and length/2 (semi)
  for (const period of [Math.round(values.length / 4), Math.round(values.length / 2)]) {
    if (period < 2 || period >= values.length) continue;

    let correlation = 0;
    let count = 0;
    for (let i = 0; i < values.length - period; i++) {
      correlation += (values[i] - mean) * (values[i + period] - mean);
      count++;
    }
    if (count > 0) {
      const autoCorr = correlation / (count * variance);
      if (autoCorr > 0.5) return true;
    }
  }

  return false;
}

function scoreTrendExecute(input: ScoreTrendInput): TrendResult {
  const { timeSeries } = input;

  // Empty series → graceful result
  if (timeSeries.length === 0) {
    return { direction: 'unknown', growthPercent: 0, seasonality: false, score: 0 };
  }

  // Single point → minimal result
  if (timeSeries.length === 1) {
    return { direction: 'unknown', growthPercent: 0, seasonality: false, score: 25 };
  }

  // Sort by date ascending
  const sorted = [...timeSeries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const values = sorted.map((p: TimeSeriesPoint) => p.value);

  // ── Growth percentage (first half mean vs second half mean) ───────
  const mid = Math.floor(values.length / 2);
  const firstHalf = values.slice(0, mid);
  const secondHalf = values.slice(mid);
  const firstMean = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondMean = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  const growthPercent = firstMean > 0
    ? Math.round(((secondMean - firstMean) / firstMean) * 10000) / 100 // 2 dp
    : 0;

  // ── Direction from slope ──────────────────────────────────────────
  const slope = linearSlope(values);
  const slopeNormalized = values.length > 0
    ? slope / (Math.max(...values) - Math.min(...values) || 1)
    : 0;

  // ── Seasonality ───────────────────────────────────────────────────
  const seasonality = detectSeasonality(values);

  // ── Direction classification ──────────────────────────────────────
  let direction: TrendDirection;
  if (seasonality && Math.abs(slopeNormalized) < 0.05) {
    direction = 'seasonal';
  } else if (slopeNormalized > 0.02) {
    direction = 'rising';
  } else if (slopeNormalized < -0.02) {
    direction = 'falling';
  } else {
    direction = 'stable';
  }

  // ── Score (0–100) ─────────────────────────────────────────────────
  // Rising trends score highest; falling trends lowest
  let score: number;
  switch (direction) {
    case 'rising':
      score = Math.min(100, 60 + Math.min(40, growthPercent)); // 60–100
      break;
    case 'stable':
      score = 50; // neutral
      break;
    case 'seasonal':
      score = 45; // slightly below stable — seasonal risk
      break;
    case 'falling':
      score = Math.max(0, 40 + Math.max(-40, growthPercent)); // 0–40
      break;
    default:
      score = 0;
  }

  return {
    direction,
    growthPercent,
    seasonality,
    score: Math.round(Math.max(0, Math.min(100, score))),
  };
}

export const scoreTrend: Tool<ScoreTrendInput, TrendResult> = {
  name: 'score_trend',
  description: 'Score a search index time series (Google Trends or Baidu Index) for trend direction, growth percentage, and seasonality.',
  execute: scoreTrendExecute,
};

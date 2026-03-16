/**
 * Unit tests for score_trend tool (P3: Deterministic Numbers).
 * 100% branch coverage required per ARCHITECTURE §7.2.
 */

import { describe, it, expect } from 'vitest';
import { scoreTrend } from '../../src/services/agent/tools/score-trend.js';
import type { TimeSeriesPoint } from '../../src/services/agent/tools/types.js';

function makeSeries(values: number[], startMonth = 1): TimeSeriesPoint[] {
  return values.map((value, i) => ({
    date: `2025-${String(startMonth + i).padStart(2, '0')}-01`,
    value,
  }));
}

describe('score_trend', () => {
  it('has correct tool metadata', () => {
    expect(scoreTrend.name).toBe('score_trend');
    expect(scoreTrend.description).toBeTruthy();
  });

  // ── Empty / minimal series ────────────────────────────────────────

  it('returns unknown direction for empty series', () => {
    const r = scoreTrend.execute({ timeSeries: [], market: 'us' });
    expect(r.direction).toBe('unknown');
    expect(r.growthPercent).toBe(0);
    expect(r.seasonality).toBe(false);
    expect(r.score).toBe(0);
  });

  it('returns unknown direction for single point', () => {
    const r = scoreTrend.execute({
      timeSeries: [{ date: '2025-01-01', value: 50 }],
      market: 'us',
    });
    expect(r.direction).toBe('unknown');
    expect(r.score).toBe(25);
  });

  // ── Rising trend ──────────────────────────────────────────────────

  it('detects rising trend', () => {
    const series = makeSeries([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
    const r = scoreTrend.execute({ timeSeries: series, market: 'us' });
    expect(r.direction).toBe('rising');
    expect(r.growthPercent).toBeGreaterThan(0);
    expect(r.score).toBeGreaterThanOrEqual(60);
  });

  // ── Falling trend ─────────────────────────────────────────────────

  it('detects falling trend', () => {
    const series = makeSeries([100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 5, 2]);
    const r = scoreTrend.execute({ timeSeries: series, market: 'us' });
    expect(r.direction).toBe('falling');
    expect(r.growthPercent).toBeLessThan(0);
    expect(r.score).toBeLessThanOrEqual(40);
  });

  // ── Stable trend ──────────────────────────────────────────────────

  it('detects stable trend', () => {
    const series = makeSeries([50, 51, 49, 50, 51, 50, 49, 50, 51, 50, 49, 50]);
    const r = scoreTrend.execute({ timeSeries: series, market: 'us' });
    expect(r.direction).toBe('stable');
    expect(r.score).toBe(50);
  });

  // ── Seasonal pattern ──────────────────────────────────────────────

  it('detects seasonal pattern', () => {
    // Repeating peaks and troughs
    const series = makeSeries([20, 80, 20, 80, 20, 80, 20, 80, 20, 80, 20, 80]);
    const r = scoreTrend.execute({ timeSeries: series, market: 'us' });
    expect(r.seasonality).toBe(true);
  });

  // ── Growth percent calculation ────────────────────────────────────

  it('calculates positive growth percent', () => {
    const series = makeSeries([10, 10, 10, 10, 10, 10, 20, 20, 20, 20, 20, 20]);
    const r = scoreTrend.execute({ timeSeries: series, market: 'us' });
    expect(r.growthPercent).toBeCloseTo(100, 0); // doubled
  });

  it('calculates negative growth percent', () => {
    const series = makeSeries([80, 80, 80, 80, 80, 80, 40, 40, 40, 40, 40, 40]);
    const r = scoreTrend.execute({ timeSeries: series, market: 'us' });
    expect(r.growthPercent).toBeCloseTo(-50, 0);
  });

  // ── Market parameter (all 7 markets) ──────────────────────────────

  it('handles all 7 markets', () => {
    const markets = ['us', 'cn', 'uk', 'de', 'jp', 'sea', 'au'] as const;
    const series = makeSeries([10, 20, 30, 40, 50, 60]);
    for (const market of markets) {
      const r = scoreTrend.execute({ timeSeries: series, market });
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  // ── Score bounds ──────────────────────────────────────────────────

  it('score is always between 0 and 100', () => {
    const testCases = [
      makeSeries([0, 0, 0, 0]),
      makeSeries([100, 100, 100, 100]),
      makeSeries([0, 100, 0, 100, 0, 100, 0, 100]),
      makeSeries([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
    ];
    for (const series of testCases) {
      const r = scoreTrend.execute({ timeSeries: series, market: 'us' });
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  // ── Out-of-order dates sorted correctly ───────────────────────────

  it('handles unsorted time series', () => {
    const series: TimeSeriesPoint[] = [
      { date: '2025-06-01', value: 60 },
      { date: '2025-01-01', value: 10 },
      { date: '2025-12-01', value: 120 },
      { date: '2025-03-01', value: 30 },
    ];
    const r = scoreTrend.execute({ timeSeries: series, market: 'us' });
    expect(r.direction).toBe('rising');
  });

  // ── Determinism (P3) ──────────────────────────────────────────────

  it('returns identical results for identical inputs', () => {
    const series = makeSeries([10, 40, 60, 80, 30, 70, 50, 90, 20, 100, 45, 75]);
    const r1 = scoreTrend.execute({ timeSeries: series, market: 'de' });
    const r2 = scoreTrend.execute({ timeSeries: series, market: 'de' });
    expect(r1).toEqual(r2);
  });

  // ── Two-point series ──────────────────────────────────────────────

  it('handles two data points', () => {
    const r = scoreTrend.execute({
      timeSeries: [
        { date: '2025-01-01', value: 10 },
        { date: '2025-12-01', value: 90 },
      ],
      market: 'us',
    });
    expect(r.direction).toBe('rising');
    expect(r.growthPercent).toBeGreaterThan(0);
  });
});

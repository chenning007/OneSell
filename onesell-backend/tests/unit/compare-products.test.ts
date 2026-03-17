/**
 * Unit tests for compare_products tool (P3).
 * 100% branch coverage required per ARCHITECTURE §7.2.
 */

import { describe, it, expect } from 'vitest';
import { compareProducts } from '../../src/services/agent/tools/compare-products.js';
import type { ProductComparison } from '../../src/services/agent/tools/types.js';

const productA: ProductComparison = {
  name: 'Widget A',
  marginPercent: 40,
  competitionScore: 30,
  trendScore: 70,
  riskLevel: 'SAFE',
};

const productB: ProductComparison = {
  name: 'Widget B',
  marginPercent: 20,
  competitionScore: 80,
  trendScore: 50,
  riskLevel: 'FLAGGED',
};

const productC: ProductComparison = {
  name: 'Widget C',
  marginPercent: 60,
  competitionScore: 50,
  trendScore: 60,
  riskLevel: 'WARNING',
};

describe('compare_products', () => {
  it('has correct tool metadata', () => {
    expect(compareProducts.name).toBe('compare_products');
    expect(compareProducts.description).toBeTruthy();
  });

  // ── Happy path ────────────────────────────────────────────────────

  it('ranks multiple products correctly by composite score', () => {
    const r = compareProducts.execute({ products: [productA, productB, productC] });
    expect(r.ranked).toHaveLength(3);
    expect(r.ranked[0].rank).toBe(1);
    expect(r.ranked[1].rank).toBe(2);
    expect(r.ranked[2].rank).toBe(3);
    // Scores should be descending
    expect(r.ranked[0].compositeScore).toBeGreaterThanOrEqual(r.ranked[1].compositeScore);
    expect(r.ranked[1].compositeScore).toBeGreaterThanOrEqual(r.ranked[2].compositeScore);
  });

  it('calculates composite score correctly for known values', () => {
    // productA: margin*0.35 + trend*0.30 + (100-competition)*0.25 + riskBonus*0.10
    //         = 40*0.35 + 70*0.30 + 70*0.25 + 100*0.10
    //         = 14 + 21 + 17.5 + 10 = 62.5
    const r = compareProducts.execute({ products: [productA] });
    expect(r.ranked[0].compositeScore).toBeCloseTo(62.5, 1);
    expect(r.ranked[0].rank).toBe(1);
  });

  it('assigns riskBonus correctly per level', () => {
    const safe = compareProducts.execute({
      products: [{ name: 'S', marginPercent: 0, competitionScore: 0, trendScore: 0, riskLevel: 'SAFE' }],
    });
    const warn = compareProducts.execute({
      products: [{ name: 'W', marginPercent: 0, competitionScore: 0, trendScore: 0, riskLevel: 'WARNING' }],
    });
    const flag = compareProducts.execute({
      products: [{ name: 'F', marginPercent: 0, competitionScore: 0, trendScore: 0, riskLevel: 'FLAGGED' }],
    });
    // Only competition inverse (25) and risk bonus differ
    expect(safe.ranked[0].compositeScore).toBe(35); // 0 + 0 + 25 + 10
    expect(warn.ranked[0].compositeScore).toBe(30); // 0 + 0 + 25 + 5
    expect(flag.ranked[0].compositeScore).toBe(25); // 0 + 0 + 25 + 0
  });

  // ── Single product ────────────────────────────────────────────────

  it('handles single product', () => {
    const r = compareProducts.execute({ products: [productA] });
    expect(r.ranked).toHaveLength(1);
    expect(r.ranked[0].rank).toBe(1);
    expect(r.ranked[0].name).toBe('Widget A');
  });

  // ── Empty array (P5) ─────────────────────────────────────────────

  it('returns empty ranked array for empty products', () => {
    const r = compareProducts.execute({ products: [] });
    expect(r.ranked).toHaveLength(0);
  });

  // ── NaN/undefined handling (P5) ───────────────────────────────────

  it('treats NaN marginPercent as 0', () => {
    const r = compareProducts.execute({
      products: [{ name: 'Bad', marginPercent: NaN, competitionScore: 0, trendScore: 0, riskLevel: 'SAFE' }],
    });
    // margin=0, trend=0, competition inverse=25, risk=10 → 35
    expect(r.ranked[0].compositeScore).toBe(35);
  });

  it('treats unknown riskLevel as 0 bonus', () => {
    const r = compareProducts.execute({
      products: [{ name: 'X', marginPercent: 0, competitionScore: 0, trendScore: 0, riskLevel: 'UNKNOWN' }],
    });
    // 0 + 0 + 25 + 0 = 25
    expect(r.ranked[0].compositeScore).toBe(25);
  });

  it('treats empty riskLevel as 0 bonus', () => {
    const r = compareProducts.execute({
      products: [{ name: 'X', marginPercent: 0, competitionScore: 0, trendScore: 0, riskLevel: '' }],
    });
    expect(r.ranked[0].compositeScore).toBe(25);
  });

  // ── Tied scores ───────────────────────────────────────────────────

  it('assigns sequential ranks even when scores are tied', () => {
    const r = compareProducts.execute({
      products: [
        { name: 'A', marginPercent: 50, competitionScore: 50, trendScore: 50, riskLevel: 'SAFE' },
        { name: 'B', marginPercent: 50, competitionScore: 50, trendScore: 50, riskLevel: 'SAFE' },
      ],
    });
    expect(r.ranked[0].rank).toBe(1);
    expect(r.ranked[1].rank).toBe(2);
    expect(r.ranked[0].compositeScore).toBe(r.ranked[1].compositeScore);
  });
});

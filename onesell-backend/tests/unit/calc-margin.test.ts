/**
 * Unit tests for calc_margin tool (P3: Deterministic Numbers).
 * 100% branch coverage required per ARCHITECTURE §7.2.
 */

import { describe, it, expect } from 'vitest';
import { calcMargin } from '../../src/services/agent/tools/calc-margin.js';
import type { CalcMarginInput } from '../../src/services/agent/tools/types.js';

const base: CalcMarginInput = {
  sellPrice: 30,
  cogs: 7,
  platformFeePercent: 0.15,
  shipping: 5,
  market: 'us',
  currency: 'USD',
};

describe('calc_margin', () => {
  it('has correct tool metadata', () => {
    expect(calcMargin.name).toBe('calc_margin');
    expect(calcMargin.description).toBeTruthy();
  });

  // ── Standard calculation ──────────────────────────────────────────

  it('calculates correct margins for US market', () => {
    const r = calcMargin.execute(base);
    // sell=30, cogs=7, fee=30*0.15=4.5, ship=5 → profit=13.5
    expect(r.grossMarginPercent).toBeCloseTo(0.7667, 3);   // (30-7)/30
    expect(r.profitPerUnit).toBeCloseTo(13.5, 1);
    expect(r.netMarginPercent).toBeCloseTo(0.45, 2);       // 13.5/30
    expect(r.currency).toBe('USD');
    expect(r.error).toBeUndefined();
  });

  it('calculates correct margins for CN market', () => {
    const r = calcMargin.execute({
      sellPrice: 100,
      cogs: 30,
      platformFeePercent: 0.05,
      shipping: 10,
      market: 'cn',
      currency: 'CNY',
    });
    // fee = 100*0.05=5, total=30+10+5=45, profit=55
    expect(r.profitPerUnit).toBe(55);
    expect(r.currency).toBe('CNY');
  });

  it('handles all 7 markets', () => {
    const markets = ['us', 'cn', 'uk', 'de', 'jp', 'sea', 'au'] as const;
    for (const market of markets) {
      const r = calcMargin.execute({ ...base, market });
      expect(r.profitPerUnit).toBeGreaterThan(0);
    }
  });

  // ── Edge cases ────────────────────────────────────────────────────

  it('returns error flag when sellPrice is zero', () => {
    const r = calcMargin.execute({ ...base, sellPrice: 0 });
    expect(r.error).toBe('sellPrice must be positive');
    expect(r.grossMarginPercent).toBe(0);
    expect(r.netMarginPercent).toBe(0);
    expect(r.profitPerUnit).toBe(0);
  });

  it('returns error flag when sellPrice is negative', () => {
    const r = calcMargin.execute({ ...base, sellPrice: -10 });
    expect(r.error).toBe('sellPrice must be positive');
  });

  it('clamps negative cogs to zero', () => {
    const r = calcMargin.execute({ ...base, cogs: -5 });
    // cogs=0, fee=4.5, ship=5 → profit=20.5
    expect(r.profitPerUnit).toBeCloseTo(20.5, 1);
  });

  it('clamps negative shipping to zero', () => {
    const r = calcMargin.execute({ ...base, shipping: -3 });
    // cogs=7, fee=4.5, ship=0 → profit=18.5
    expect(r.profitPerUnit).toBeCloseTo(18.5, 1);
  });

  it('clamps fee percent to 0–1 range', () => {
    const r = calcMargin.execute({ ...base, platformFeePercent: 1.5 });
    // Fee clamped to 1.0 → fee=30, total=7+5+30=42 → profit=-12
    expect(r.profitPerUnit).toBe(-12);
    expect(r.netMarginPercent).toBeCloseTo(-0.4, 1);
  });

  it('handles zero cogs (free sourcing)', () => {
    const r = calcMargin.execute({ ...base, cogs: 0, shipping: 0 });
    // cogs=0, ship=0, fee=4.5 → profit=25.5
    expect(r.grossMarginPercent).toBe(1);
    expect(r.profitPerUnit).toBe(25.5);
  });

  it('handles very large sell price without overflow', () => {
    const r = calcMargin.execute({ ...base, sellPrice: 1_000_000, cogs: 500_000 });
    expect(Number.isFinite(r.grossMarginPercent)).toBe(true);
    expect(Number.isFinite(r.profitPerUnit)).toBe(true);
  });

  it('produces no NaN or Infinity in any output field', () => {
    const edgeCases: CalcMarginInput[] = [
      { ...base, sellPrice: 0.01, cogs: 0, platformFeePercent: 0, shipping: 0 },
      { ...base, sellPrice: 1, cogs: 1, platformFeePercent: 0, shipping: 0 },
      { ...base, sellPrice: 0.001, cogs: 0.001, platformFeePercent: 1, shipping: 0 },
    ];
    for (const input of edgeCases) {
      const r = calcMargin.execute(input);
      expect(Number.isFinite(r.grossMarginPercent)).toBe(true);
      expect(Number.isFinite(r.netMarginPercent)).toBe(true);
      expect(Number.isFinite(r.profitPerUnit)).toBe(true);
    }
  });

  // ── Determinism (P3) ──────────────────────────────────────────────

  it('returns identical results for identical inputs', () => {
    const r1 = calcMargin.execute(base);
    const r2 = calcMargin.execute(base);
    expect(r1).toEqual(r2);
  });
});

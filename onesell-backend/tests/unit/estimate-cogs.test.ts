/**
 * Unit tests for estimate_cogs tool (P3, P5).
 * 100% branch coverage required per ARCHITECTURE §7.2.
 */

import { describe, it, expect } from 'vitest';
import { estimateCOGS } from '../../src/services/agent/tools/estimate-cogs.js';
import type { EstimateCOGSInput } from '../../src/services/agent/tools/types.js';

const baseInput: EstimateCOGSInput = {
  unitCostUSD: 10,
  shippingCostUSD: 5,
  quantity: 100,
  targetCurrency: 'CNY',
  exchangeRates: { CNY: 7.2, EUR: 0.92, GBP: 0.79, JPY: 150.5 },
};

describe('estimate_cogs', () => {
  it('has correct tool metadata', () => {
    expect(estimateCOGS.name).toBe('estimate_cogs');
    expect(estimateCOGS.description).toBeTruthy();
  });

  // ── Standard calculation ──────────────────────────────────────────

  it('calculates total and per-unit COGS in target currency', () => {
    const r = estimateCOGS.execute(baseInput);
    // totalUSD = (10 + 5) * 100 = 1500
    // totalCNY = 1500 * 7.2 = 10800
    // perUnit = 10800 / 100 = 108
    expect(r.totalCOGS).toBe(10800);
    expect(r.perUnitCOGS).toBe(108);
    expect(r.currency).toBe('CNY');
  });

  it('converts to EUR correctly', () => {
    const r = estimateCOGS.execute({ ...baseInput, targetCurrency: 'EUR' });
    // totalUSD = 1500, * 0.92 = 1380
    expect(r.totalCOGS).toBe(1380);
    expect(r.perUnitCOGS).toBe(13.8);
    expect(r.currency).toBe('EUR');
  });

  it('converts to JPY correctly', () => {
    const r = estimateCOGS.execute({ ...baseInput, targetCurrency: 'JPY' });
    // totalUSD = 1500, * 150.5 = 225750
    expect(r.totalCOGS).toBe(225750);
    expect(r.perUnitCOGS).toBe(2257.5);
  });

  // ── Defaults ──────────────────────────────────────────────────────

  it('defaults quantity to 1 when not provided', () => {
    const r = estimateCOGS.execute({
      unitCostUSD: 10,
      targetCurrency: 'USD',
      exchangeRates: { USD: 1 },
    });
    // (10 + 0) * 1 * 1 = 10
    expect(r.totalCOGS).toBe(10);
    expect(r.perUnitCOGS).toBe(10);
  });

  it('defaults shippingCostUSD to 0 when not provided', () => {
    const r = estimateCOGS.execute({
      unitCostUSD: 25,
      quantity: 10,
      targetCurrency: 'USD',
      exchangeRates: { USD: 1 },
    });
    expect(r.totalCOGS).toBe(250);
    expect(r.perUnitCOGS).toBe(25);
  });

  // ── Unknown currency → rate 1.0 (P5) ─────────────────────────────

  it('uses rate 1.0 for unknown target currency', () => {
    const r = estimateCOGS.execute({
      unitCostUSD: 10,
      shippingCostUSD: 5,
      quantity: 1,
      targetCurrency: 'XYZ',
      exchangeRates: { CNY: 7.2 },
    });
    // (10 + 5) * 1 * 1.0 = 15
    expect(r.totalCOGS).toBe(15);
    expect(r.currency).toBe('XYZ');
  });

  // ── Rounding to 2 decimal places ──────────────────────────────────

  it('rounds results to 2 decimal places', () => {
    const r = estimateCOGS.execute({
      unitCostUSD: 3.33,
      shippingCostUSD: 1.11,
      quantity: 3,
      targetCurrency: 'EUR',
      exchangeRates: { EUR: 0.92 },
    });
    // totalUSD = (3.33 + 1.11) * 3 = 13.32
    // totalEUR = 13.32 * 0.92 = 12.2544 → 12.25
    // perUnit = 12.25 / 3 = 4.083... → 4.08
    expect(r.totalCOGS).toBe(12.25);
    expect(r.perUnitCOGS).toBe(4.08);
  });

  // ── Edge cases (P5) ───────────────────────────────────────────────

  it('handles zero unitCostUSD', () => {
    const r = estimateCOGS.execute({
      unitCostUSD: 0,
      quantity: 5,
      targetCurrency: 'USD',
      exchangeRates: { USD: 1 },
    });
    expect(r.totalCOGS).toBe(0);
    expect(r.perUnitCOGS).toBe(0);
  });

  it('handles negative unitCostUSD gracefully (treats as 0)', () => {
    const r = estimateCOGS.execute({
      unitCostUSD: -10,
      quantity: 1,
      targetCurrency: 'USD',
      exchangeRates: { USD: 1 },
    });
    expect(r.totalCOGS).toBe(0);
    expect(r.perUnitCOGS).toBe(0);
  });

  it('handles NaN quantity gracefully (defaults to 1)', () => {
    const r = estimateCOGS.execute({
      unitCostUSD: 10,
      quantity: NaN,
      targetCurrency: 'USD',
      exchangeRates: { USD: 1 },
    });
    expect(r.totalCOGS).toBe(10);
    expect(r.perUnitCOGS).toBe(10);
  });

  it('handles zero quantity (defaults to 1)', () => {
    const r = estimateCOGS.execute({
      unitCostUSD: 10,
      quantity: 0,
      targetCurrency: 'USD',
      exchangeRates: { USD: 1 },
    });
    expect(r.totalCOGS).toBe(10);
    expect(r.perUnitCOGS).toBe(10);
  });

  it('handles empty exchangeRates object', () => {
    const r = estimateCOGS.execute({
      unitCostUSD: 10,
      quantity: 1,
      targetCurrency: 'EUR',
      exchangeRates: {},
    });
    // Falls back to rate 1.0
    expect(r.totalCOGS).toBe(10);
  });
});

/**
 * Unit tests for flag_beginner_risk tool (P3, P4, P5, P8).
 * 100% branch coverage required per ARCHITECTURE §7.2.
 */

import { describe, it, expect } from 'vitest';
import { flagBeginnerRisk } from '../../src/services/agent/tools/flag-beginner-risk.js';
import type { FlagBeginnerRiskInput, MarketContext } from '../../src/services/agent/tools/types.js';

const usMarket: MarketContext = {
  marketId: 'us',
  language: 'en-US',
  currency: 'USD',
  platforms: ['amazon-us', 'ebay-us'],
};

const cnMarket: MarketContext = {
  marketId: 'cn',
  language: 'zh-CN',
  currency: 'CNY',
  platforms: ['taobao', 'jd'],
};

describe('flag_beginner_risk', () => {
  it('has correct tool metadata', () => {
    expect(flagBeginnerRisk.name).toBe('flag_beginner_risk');
    expect(flagBeginnerRisk.description).toBeTruthy();
  });

  // ── SAFE cases ────────────────────────────────────────────────────

  it('returns SAFE for benign category with no risk factors', () => {
    const r = flagBeginnerRisk.execute({
      category: 'home decor',
      market: usMarket,
    });
    expect(r.riskLevel).toBe('SAFE');
    expect(r.reasons).toHaveLength(0);
  });

  it('returns SAFE for lightweight non-regulated product', () => {
    const r = flagBeginnerRisk.execute({
      category: 'pet accessories',
      weight: 2,
      regulatoryKeywords: [],
      market: usMarket,
    });
    expect(r.riskLevel).toBe('SAFE');
    expect(r.reasons).toHaveLength(0);
  });

  // ── FLAGGED: regulated category ───────────────────────────────────

  it('flags electronics category in US market', () => {
    const r = flagBeginnerRisk.execute({
      category: 'Consumer Electronics',
      market: usMarket,
    });
    expect(r.riskLevel).toBe('FLAGGED');
    expect(r.reasons.some(s => s.includes('electronics'))).toBe(true);
  });

  it('flags food category in CN market', () => {
    const r = flagBeginnerRisk.execute({
      category: 'Organic Food Products',
      market: cnMarket,
    });
    expect(r.riskLevel).toBe('FLAGGED');
    expect(r.reasons.some(s => s.includes('food'))).toBe(true);
  });

  it('flags baby products', () => {
    const r = flagBeginnerRisk.execute({
      category: 'Baby Clothing',
      market: usMarket,
    });
    expect(r.riskLevel).toBe('FLAGGED');
  });

  it('flags supplements', () => {
    const r = flagBeginnerRisk.execute({
      category: 'Dietary Supplements',
      market: usMarket,
    });
    expect(r.riskLevel).toBe('FLAGGED');
  });

  it('flags cosmetics', () => {
    const r = flagBeginnerRisk.execute({
      category: 'Cosmetics & Beauty',
      market: usMarket,
    });
    expect(r.riskLevel).toBe('FLAGGED');
  });

  // ── FLAGGED: regulatory keywords ──────────────────────────────────

  it('flags FDA keyword in US market', () => {
    const r = flagBeginnerRisk.execute({
      category: 'kitchen gadgets',
      regulatoryKeywords: ['FDA'],
      market: usMarket,
    });
    expect(r.riskLevel).toBe('FLAGGED');
    expect(r.reasons.some(s => s.includes('FDA'))).toBe(true);
  });

  it('flags CCC keyword in CN market', () => {
    const r = flagBeginnerRisk.execute({
      category: 'phone cases',
      regulatoryKeywords: ['CCC', 'SAMR'],
      market: cnMarket,
    });
    expect(r.riskLevel).toBe('FLAGGED');
    expect(r.reasons.some(s => s.includes('CCC'))).toBe(true);
  });

  it('ignores irrelevant keywords for the market', () => {
    const r = flagBeginnerRisk.execute({
      category: 'stationery',
      regulatoryKeywords: ['CCC'], // CCC is CN-specific, not US
      market: usMarket,
    });
    expect(r.riskLevel).toBe('SAFE');
  });

  // ── WARNING: heavy weight ─────────────────────────────────────────

  it('warns on heavy weight (>30kg)', () => {
    const r = flagBeginnerRisk.execute({
      category: 'furniture',
      weight: 45,
      market: usMarket,
    });
    expect(r.riskLevel).toBe('WARNING');
    expect(r.reasons.some(s => s.includes('Heavy'))).toBe(true);
  });

  it('does not warn on exactly 30kg', () => {
    const r = flagBeginnerRisk.execute({
      category: 'furniture',
      weight: 30,
      market: usMarket,
    });
    expect(r.riskLevel).toBe('SAFE');
  });

  // ── FLAGGED takes priority over WARNING ───────────────────────────

  it('returns FLAGGED when both category and weight trigger', () => {
    const r = flagBeginnerRisk.execute({
      category: 'Electronics Equipment',
      weight: 50,
      market: usMarket,
    });
    expect(r.riskLevel).toBe('FLAGGED');
    expect(r.reasons.length).toBeGreaterThanOrEqual(2);
  });

  // ── Market-specific differences (P4) ──────────────────────────────

  it('CN market flags telecom category that US does not', () => {
    const cnResult = flagBeginnerRisk.execute({
      category: 'Telecom Equipment',
      market: cnMarket,
    });
    const usResult = flagBeginnerRisk.execute({
      category: 'Telecom Equipment',
      market: usMarket,
    });
    expect(cnResult.riskLevel).toBe('FLAGGED');
    expect(usResult.riskLevel).toBe('SAFE');
  });

  it('handles all 7 markets', () => {
    const markets: MarketContext[] = [
      { marketId: 'us', language: 'en-US', currency: 'USD', platforms: [] },
      { marketId: 'cn', language: 'zh-CN', currency: 'CNY', platforms: [] },
      { marketId: 'uk', language: 'en-GB', currency: 'GBP', platforms: [] },
      { marketId: 'de', language: 'de-DE', currency: 'EUR', platforms: [] },
      { marketId: 'jp', language: 'ja-JP', currency: 'JPY', platforms: [] },
      { marketId: 'sea', language: 'en-SG', currency: 'SGD', platforms: [] },
      { marketId: 'au', language: 'en-AU', currency: 'AUD', platforms: [] },
    ];
    for (const market of markets) {
      const r = flagBeginnerRisk.execute({ category: 'hats', market });
      expect(r.riskLevel).toBe('SAFE');
    }
  });

  // ── Edge cases (P5) ───────────────────────────────────────────────

  it('handles empty category string', () => {
    const r = flagBeginnerRisk.execute({
      category: '',
      market: usMarket,
    });
    expect(r.riskLevel).toBe('SAFE');
  });

  it('handles undefined weight and regulatoryKeywords', () => {
    const r = flagBeginnerRisk.execute({
      category: 'general goods',
      market: usMarket,
    });
    expect(r.riskLevel).toBe('SAFE');
  });

  it('handles NaN weight gracefully', () => {
    const r = flagBeginnerRisk.execute({
      category: 'general goods',
      weight: NaN,
      market: usMarket,
    });
    expect(r.riskLevel).toBe('SAFE');
  });

  it('handles empty regulatoryKeywords array', () => {
    const r = flagBeginnerRisk.execute({
      category: 'general goods',
      regulatoryKeywords: [],
      market: usMarket,
    });
    expect(r.riskLevel).toBe('SAFE');
  });
});

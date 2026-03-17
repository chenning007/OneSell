/**
 * Performance baseline tests — PRD §9 NFR verification.
 *
 * Verifies that deterministic tool functions and payload serialization
 * meet performance budgets required for the 90-second agent analysis target.
 *
 * Issue: #59
 */

import { describe, it, expect } from 'vitest';
import { calcMargin } from '../../onesell-backend/src/services/agent/tools/calc-margin.js';
import { rankCompetition } from '../../onesell-backend/src/services/agent/tools/rank-competition.js';
import { scoreTrend } from '../../onesell-backend/src/services/agent/tools/score-trend.js';
import { flagBeginnerRisk } from '../../onesell-backend/src/services/agent/tools/flag-beginner-risk.js';
import { compareProducts } from '../../onesell-backend/src/services/agent/tools/compare-products.js';
import { estimateCOGS } from '../../onesell-backend/src/services/agent/tools/estimate-cogs.js';
import { getPlatformFees } from '../../onesell-backend/src/services/agent/tools/get-platform-fees.js';
import { ToolRegistry } from '../../onesell-backend/src/services/agent/tool-registry.js';
import type {
  CalcMarginInput,
  RankCompetitionInput,
  ScoreTrendInput,
  FlagBeginnerRiskInput,
  CompareProductsInput,
  EstimateCOGSInput,
  GetPlatformFeesInput,
  MarketContext,
} from '../../onesell-backend/src/services/agent/tools/types.js';

// ── Fixtures ────────────────────────────────────────────────────────

const US_MARKET: MarketContext = {
  marketId: 'us',
  language: 'en',
  currency: 'USD',
  platforms: ['amazon-us', 'ebay-us', 'etsy', 'tiktok-shop-us', 'alibaba', 'google-trends'],
};

const calcMarginInput: CalcMarginInput = {
  sellPrice: 29.99,
  cogs: 8.50,
  platformFeePercent: 0.15,
  shipping: 4.99,
  market: 'us',
  currency: 'USD',
};

const rankCompetitionInput: RankCompetitionInput = {
  listings: Array.from({ length: 50 }, (_, i) => ({
    reviewCount: Math.floor(Math.random() * 5000),
    sellerAge: Math.floor(Math.random() * 36),
    salesVolume: Math.floor(Math.random() * 1000),
  })),
  market: 'us',
};

const scoreTrendInput: ScoreTrendInput = {
  timeSeries: Array.from({ length: 52 }, (_, i) => ({
    date: `2025-${String(Math.floor(i / 4) + 1).padStart(2, '0')}-${String((i % 4) * 7 + 1).padStart(2, '0')}`,
    value: 50 + Math.sin(i / 4) * 20 + i * 0.5,
  })),
  market: 'us',
};

const flagBeginnerRiskInput: FlagBeginnerRiskInput = {
  category: 'Electronics - Bluetooth Headphones',
  weight: 0.3,
  regulatoryKeywords: ['FCC'],
  market: US_MARKET,
};

const compareProductsInput: CompareProductsInput = {
  products: Array.from({ length: 50 }, (_, i) => ({
    name: `Product ${i + 1}`,
    marginPercent: 20 + Math.random() * 60,
    competitionScore: Math.random() * 100,
    trendScore: Math.random() * 100,
    riskLevel: ['SAFE', 'WARNING', 'FLAGGED'][i % 3],
  })),
};

const estimateCOGSInput: EstimateCOGSInput = {
  unitCostUSD: 8.50,
  shippingCostUSD: 2.50,
  quantity: 100,
  targetCurrency: 'USD',
  exchangeRates: { USD: 1.0, CNY: 7.24, EUR: 0.92, GBP: 0.79, JPY: 149.5 },
};

const getPlatformFeesInput: GetPlatformFeesInput = {
  platformId: 'amazon-us',
  market: US_MARKET,
};

// ── Helper ──────────────────────────────────────────────────────────

function timeExecution(fn: () => unknown): number {
  const start = performance.now();
  fn();
  const end = performance.now();
  return end - start;
}

// ── Tool Execution Speed Tests (< 100ms each) ──────────────────────

describe('Performance baseline — Tool execution speed', () => {
  const TOOL_BUDGET_MS = 100;

  it('calc_margin executes in < 100ms', () => {
    const elapsed = timeExecution(() => calcMargin.execute(calcMarginInput));
    expect(elapsed).toBeLessThan(TOOL_BUDGET_MS);
  });

  it('rank_competition executes in < 100ms (50 listings)', () => {
    const elapsed = timeExecution(() => rankCompetition.execute(rankCompetitionInput));
    expect(elapsed).toBeLessThan(TOOL_BUDGET_MS);
  });

  it('score_trend executes in < 100ms (52-week series)', () => {
    const elapsed = timeExecution(() => scoreTrend.execute(scoreTrendInput));
    expect(elapsed).toBeLessThan(TOOL_BUDGET_MS);
  });

  it('flag_beginner_risk executes in < 100ms', () => {
    const elapsed = timeExecution(() => flagBeginnerRisk.execute(flagBeginnerRiskInput));
    expect(elapsed).toBeLessThan(TOOL_BUDGET_MS);
  });

  it('compare_products executes in < 100ms (50 products)', () => {
    const elapsed = timeExecution(() => compareProducts.execute(compareProductsInput));
    expect(elapsed).toBeLessThan(TOOL_BUDGET_MS);
  });

  it('estimate_cogs executes in < 100ms', () => {
    const elapsed = timeExecution(() => estimateCOGS.execute(estimateCOGSInput));
    expect(elapsed).toBeLessThan(TOOL_BUDGET_MS);
  });

  it('get_platform_fees executes in < 100ms', () => {
    const elapsed = timeExecution(() => getPlatformFees.execute(getPlatformFeesInput));
    expect(elapsed).toBeLessThan(TOOL_BUDGET_MS);
  });

  it('all 7 tools execute sequentially in < 700ms (executor budget)', () => {
    const start = performance.now();
    calcMargin.execute(calcMarginInput);
    rankCompetition.execute(rankCompetitionInput);
    scoreTrend.execute(scoreTrendInput);
    flagBeginnerRisk.execute(flagBeginnerRiskInput);
    compareProducts.execute(compareProductsInput);
    estimateCOGS.execute(estimateCOGSInput);
    getPlatformFees.execute(getPlatformFeesInput);
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(700);
  });
});

// ── ToolRegistry resolution speed ───────────────────────────────────

describe('Performance baseline — ToolRegistry resolution', () => {
  it('resolves and executes all 7 tools via registry in < 100ms', () => {
    const registry = new ToolRegistry();
    const start = performance.now();

    registry.resolve('calc_margin').execute(calcMarginInput);
    registry.resolve('rank_competition').execute(rankCompetitionInput);
    registry.resolve('score_trend').execute(scoreTrendInput);
    registry.resolve('flag_beginner_risk').execute(flagBeginnerRiskInput);
    registry.resolve('compare_products').execute(compareProductsInput);
    registry.resolve('estimate_cogs').execute(estimateCOGSInput);
    registry.resolve('get_platform_fees').execute(getPlatformFeesInput);

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});

// ── Payload Serialization Speed (< 500ms for 50 products) ──────────

describe('Performance baseline — Payload serialization', () => {
  it('serializes a 50-product analysis payload in < 500ms', () => {
    const payload = {
      sessionId: 'perf-test-session',
      market: US_MARKET,
      preferences: {
        budget: 500,
        platforms: ['amazon-us', 'ebay-us'],
        categories: ['electronics', 'home'],
      },
      products: Array.from({ length: 50 }, (_, i) => ({
        id: `prod-${i}`,
        name: `Test Product ${i}`,
        price: 10 + Math.random() * 90,
        category: 'electronics',
        platform: 'amazon-us',
        reviewCount: Math.floor(Math.random() * 10000),
        rating: 3 + Math.random() * 2,
        monthlySales: Math.floor(Math.random() * 5000),
        trendData: Array.from({ length: 12 }, (_, j) => ({
          date: `2025-${String(j + 1).padStart(2, '0')}-01`,
          value: Math.random() * 100,
        })),
        competitorCount: Math.floor(Math.random() * 200),
        sellerAge: Math.floor(Math.random() * 48),
      })),
    };

    const start = performance.now();
    const json = JSON.stringify(payload);
    const parsed = JSON.parse(json);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(parsed.products).toHaveLength(50);
    expect(typeof json).toBe('string');
  });

  it('deserializes a 50-product result set in < 500ms', () => {
    const results = {
      ranked: Array.from({ length: 50 }, (_, i) => ({
        name: `Product ${i}`,
        compositeScore: Math.random() * 100,
        rank: i + 1,
        margin: { grossMarginPercent: 0.65, netMarginPercent: 0.35, profitPerUnit: 12.5, currency: 'USD' },
        trend: { direction: 'rising', growthPercent: 15, seasonality: false, score: 72 },
        competition: { score: 65, narrative: 'Moderate competition' },
        risk: { riskLevel: 'SAFE', reasons: [] },
      })),
      narrative: 'Based on analysis of 50 products across 6 platforms...',
      generatedAt: new Date().toISOString(),
    };

    const json = JSON.stringify(results);

    const start = performance.now();
    const parsed = JSON.parse(json);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
    expect(parsed.ranked).toHaveLength(50);
  });
});

// ── i18n Bundle Validation ──────────────────────────────────────────

describe('Performance baseline — i18n bundle structure', () => {
  it('all 4 locale modules are importable (synchronous, no async fetch)', async () => {
    // Verify locale files exist and are valid ES modules with translation keys
    const en = await import('../../onesell-client/src/renderer/i18n/locales/en.js');
    const zhCn = await import('../../onesell-client/src/renderer/i18n/locales/zh-cn.js');
    const ja = await import('../../onesell-client/src/renderer/i18n/locales/ja.js');
    const de = await import('../../onesell-client/src/renderer/i18n/locales/de.js');

    // Each locale must export a default object with at least one key
    expect(typeof en.default).toBe('object');
    expect(typeof zhCn.default).toBe('object');
    expect(typeof ja.default).toBe('object');
    expect(typeof de.default).toBe('object');

    expect(Object.keys(en.default).length).toBeGreaterThan(0);
    expect(Object.keys(zhCn.default).length).toBeGreaterThan(0);
    expect(Object.keys(ja.default).length).toBeGreaterThan(0);
    expect(Object.keys(de.default).length).toBeGreaterThan(0);
  });

  it('all locales have matching top-level keys (no missing translations)', async () => {
    const en = await import('../../onesell-client/src/renderer/i18n/locales/en.js');
    const zhCn = await import('../../onesell-client/src/renderer/i18n/locales/zh-cn.js');
    const ja = await import('../../onesell-client/src/renderer/i18n/locales/ja.js');
    const de = await import('../../onesell-client/src/renderer/i18n/locales/de.js');

    const enKeys = Object.keys(en.default).sort();
    const zhCnKeys = Object.keys(zhCn.default).sort();
    const jaKeys = Object.keys(ja.default).sort();
    const deKeys = Object.keys(de.default).sort();

    expect(zhCnKeys).toEqual(enKeys);
    expect(jaKeys).toEqual(enKeys);
    expect(deKeys).toEqual(enKeys);
  });
});

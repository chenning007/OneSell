/**
 * Unit Test — Relocated agent modules compile and tool functions work (A-02, #220).
 *
 * AC:
 * 1. All 7 tool functions produce expected outputs
 * 2. PlannerAgent/ExecutorAgent/SynthesizerAgent classes instantiate without error
 * 3. ToolRegistry registers all tools
 *
 * Principles tested: P3 (deterministic tools), P5 (graceful degradation)
 *
 * Patterns adapted from onesell-backend/tests/unit/ (calc-margin.test.ts, tool-registry.test.ts)
 */

import { describe, it, expect, vi } from 'vitest';

// ── Tool function imports ───────────────────────────────────────────

import { calcMargin } from '../../src/main/agent/tools/calc-margin.js';
import { rankCompetition } from '../../src/main/agent/tools/rank-competition.js';
import { scoreTrend } from '../../src/main/agent/tools/score-trend.js';
import { flagBeginnerRisk } from '../../src/main/agent/tools/flag-beginner-risk.js';
import { compareProducts } from '../../src/main/agent/tools/compare-products.js';
import { estimateCOGS } from '../../src/main/agent/tools/estimate-cogs.js';
import { getPlatformFees } from '../../src/main/agent/tools/get-platform-fees.js';
import type { MarketContext } from '../../src/main/agent/tools/types.js';

// ── Registry and Agent imports ──────────────────────────────────────

import { ToolRegistry } from '../../src/main/agent/ToolRegistry.js';
import { ExecutorAgent } from '../../src/main/agent/ExecutorAgent.js';

// PlannerAgent and SynthesizerAgent need LLMProvider — mock it
import type { LLMProvider, ChatMessage, LLMResponse, ChatOptions } from '../../src/main/agent/LLMProvider.js';

// Mock prompt-loader to avoid file system dependency
vi.mock('../../src/main/agent/prompt-loader.js', () => ({
  loadPrompts: () => ({
    planner: 'mock planner prompt',
    executor: 'mock executor prompt',
    synthesizer: 'mock synthesizer prompt',
  }),
  sanitizeUserInput: (input: string) => input,
}));

// ── Fixtures ────────────────────────────────────────────────────────

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

function makeMockLLM(): LLMProvider {
  return {
    providerId: 'mock-llm',
    chat: async (_messages: readonly ChatMessage[], _options?: ChatOptions): Promise<LLMResponse> => {
      return {
        content: JSON.stringify([{
          rank: 1,
          name: 'Test Product',
          compositeScore: 85,
          marginEstimate: 0.45,
          riskLevel: 'low',
          reasons: ['Good margin'],
          category: 'Test',
        }]),
        usage: { promptTokens: 100, completionTokens: 50 },
      };
    },
  };
}

// ── AC-1: All 7 tool functions produce expected outputs ─────────────

describe('AC-1: Tool function outputs', () => {
  describe('calc_margin', () => {
    it('has correct metadata', () => {
      expect(calcMargin.name).toBe('calc_margin');
      expect(calcMargin.description).toBeTruthy();
    });

    it('calculates correct margins for US market', () => {
      const r = calcMargin.execute({
        sellPrice: 30, cogs: 7, platformFeePercent: 0.15, shipping: 5, market: 'us', currency: 'USD',
      });
      expect(r.grossMarginPercent).toBeCloseTo(0.7667, 3);
      expect(r.profitPerUnit).toBeCloseTo(13.5, 1);
      expect(r.netMarginPercent).toBeCloseTo(0.45, 2);
      expect(r.currency).toBe('USD');
      expect(r.error).toBeUndefined();
    });

    it('returns error for zero/negative sell price', () => {
      const r = calcMargin.execute({
        sellPrice: 0, cogs: 7, platformFeePercent: 0.15, shipping: 5, market: 'us', currency: 'USD',
      });
      expect(r.error).toBe('sellPrice must be positive');
    });
  });

  describe('rank_competition', () => {
    it('has correct metadata', () => {
      expect(rankCompetition.name).toBe('rank_competition');
      expect(rankCompetition.description).toBeTruthy();
    });

    it('returns high score for empty listings (wide open market)', () => {
      const r = rankCompetition.execute({ listings: [], market: 'us' });
      expect(r.score).toBe(100);
      expect(r.narrative).toContain('No competing listings');
    });

    it('returns lower score for saturated listings', () => {
      const listings = Array.from({ length: 300 }, () => ({
        reviewCount: 15_000, sellerAge: 48, salesVolume: 500,
      }));
      const r = rankCompetition.execute({ listings, market: 'us' });
      expect(r.score).toBeLessThan(30);
    });

    it('returns score between 0 and 100', () => {
      const r = rankCompetition.execute({
        listings: [{ reviewCount: 500, sellerAge: 12 }],
        market: 'us',
      });
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    });
  });

  describe('score_trend', () => {
    it('has correct metadata', () => {
      expect(scoreTrend.name).toBe('score_trend');
      expect(scoreTrend.description).toBeTruthy();
    });

    it('returns score 0 for empty time series', () => {
      const r = scoreTrend.execute({ timeSeries: [], market: 'us' });
      expect(r.score).toBe(0);
      expect(r.direction).toBe('unknown');
    });

    it('detects rising trend', () => {
      const timeSeries = Array.from({ length: 12 }, (_, i) => ({
        date: `2026-0${String(i + 1).padStart(2, '0')}-01`,
        value: 20 + i * 5,
      }));
      const r = scoreTrend.execute({ timeSeries, market: 'us' });
      expect(r.direction).toBe('rising');
      expect(r.score).toBeGreaterThan(50);
    });

    it('returns score between 0 and 100', () => {
      const r = scoreTrend.execute({
        timeSeries: [
          { date: '2026-01-01', value: 50 },
          { date: '2026-02-01', value: 55 },
        ],
        market: 'us',
      });
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    });
  });

  describe('flag_beginner_risk', () => {
    it('has correct metadata', () => {
      expect(flagBeginnerRisk.name).toBe('flag_beginner_risk');
      expect(flagBeginnerRisk.description).toBeTruthy();
    });

    it('flags regulated category in US market', () => {
      const r = flagBeginnerRisk.execute({
        category: 'electronics', market: usMarket,
      });
      expect(r.riskLevel).toBe('FLAGGED');
      expect(r.reasons.length).toBeGreaterThan(0);
    });

    it('returns SAFE for non-regulated category', () => {
      const r = flagBeginnerRisk.execute({
        category: 'stationery', market: usMarket,
      });
      expect(r.riskLevel).toBe('SAFE');
    });

    it('warns for heavy products', () => {
      const r = flagBeginnerRisk.execute({
        category: 'stationery', weight: 35, market: usMarket,
      });
      expect(r.riskLevel).toBe('WARNING');
      expect(r.reasons.some(r => r.includes('Heavy'))).toBe(true);
    });

    it('detects regulatory keywords', () => {
      const r = flagBeginnerRisk.execute({
        category: 'stationery',
        regulatoryKeywords: ['FDA'],
        market: usMarket,
      });
      expect(r.riskLevel).toBe('FLAGGED');
    });
  });

  describe('compare_products', () => {
    it('has correct metadata', () => {
      expect(compareProducts.name).toBe('compare_products');
      expect(compareProducts.description).toBeTruthy();
    });

    it('ranks products by composite score', () => {
      const r = compareProducts.execute({
        products: [
          { name: 'Low', marginPercent: 10, competitionScore: 80, trendScore: 20, riskLevel: 'FLAGGED' },
          { name: 'High', marginPercent: 80, competitionScore: 20, trendScore: 90, riskLevel: 'SAFE' },
        ],
      });
      expect(r.ranked[0].name).toBe('High');
      expect(r.ranked[0].rank).toBe(1);
      expect(r.ranked[1].name).toBe('Low');
      expect(r.ranked[1].rank).toBe(2);
    });

    it('returns empty array for empty products', () => {
      const r = compareProducts.execute({ products: [] });
      expect(r.ranked).toEqual([]);
    });
  });

  describe('estimate_cogs', () => {
    it('has correct metadata', () => {
      expect(estimateCOGS.name).toBe('estimate_cogs');
      expect(estimateCOGS.description).toBeTruthy();
    });

    it('calculates COGS with currency conversion', () => {
      const r = estimateCOGS.execute({
        unitCostUSD: 5,
        shippingCostUSD: 2,
        quantity: 10,
        targetCurrency: 'CNY',
        exchangeRates: { CNY: 7.2 },
      });
      // (5+2)*10 = 70 USD * 7.2 = 504 CNY
      expect(r.totalCOGS).toBe(504);
      expect(r.perUnitCOGS).toBe(50.4);
      expect(r.currency).toBe('CNY');
    });

    it('defaults quantity to 1 when not specified', () => {
      const r = estimateCOGS.execute({
        unitCostUSD: 10,
        targetCurrency: 'USD',
        exchangeRates: { USD: 1 },
      });
      expect(r.totalCOGS).toBe(10);
      expect(r.perUnitCOGS).toBe(10);
    });
  });

  describe('get_platform_fees', () => {
    it('has correct metadata', () => {
      expect(getPlatformFees.name).toBe('get_platform_fees');
      expect(getPlatformFees.description).toBeTruthy();
    });

    it('returns Amazon US fees', () => {
      const r = getPlatformFees.execute({ platformId: 'amazon-us', market: usMarket });
      expect(r.platformId).toBe('amazon-us');
      expect(r.commissionPercent).toBe(0.15);
      expect(r.currency).toBe('USD');
    });

    it('returns Taobao fees for CN market', () => {
      const r = getPlatformFees.execute({ platformId: 'taobao', market: cnMarket });
      expect(r.platformId).toBe('taobao');
      expect(r.commissionPercent).toBe(0.01);
      expect(r.currency).toBe('CNY');
    });

    it('returns zero fees and note for unknown platform', () => {
      const r = getPlatformFees.execute({ platformId: 'unknown-platform', market: usMarket });
      expect(r.commissionPercent).toBe(0);
      expect(r.notes).toContain('Unknown platform');
    });
  });
});

// ── AC-2: Agent classes instantiate without error ────────────────────

describe('AC-2: Agent class instantiation', () => {
  it('ToolRegistry instantiates and auto-registers tools', () => {
    const registry = new ToolRegistry();
    expect(registry).toBeDefined();
    expect(registry.getAll().length).toBeGreaterThan(0);
  });

  it('ExecutorAgent instantiates with a ToolRegistry', () => {
    const registry = new ToolRegistry();
    const executor = new ExecutorAgent(registry);
    expect(executor).toBeDefined();
  });

  it('PlannerAgent instantiates with LLMProvider and ToolRegistry', async () => {
    // Dynamic import to avoid issues with prompt-loader at module level
    const { PlannerAgent } = await import('../../src/main/agent/PlannerAgent.js');
    const registry = new ToolRegistry();
    const llm = makeMockLLM();
    const planner = new PlannerAgent(llm, registry);
    expect(planner).toBeDefined();
  });

  it('SynthesizerAgent instantiates with LLMProvider', async () => {
    const { SynthesizerAgent } = await import('../../src/main/agent/SynthesizerAgent.js');
    const llm = makeMockLLM();
    const synthesizer = new SynthesizerAgent(llm);
    expect(synthesizer).toBeDefined();
  });
});

// ── AC-3: ToolRegistry registers all 7 tools ────────────────────────

describe('AC-3: ToolRegistry registers all tools', () => {
  let registry: ToolRegistry;

  beforeAll(() => {
    registry = new ToolRegistry();
  });

  const expectedTools = [
    'calc_margin',
    'rank_competition',
    'score_trend',
    'flag_beginner_risk',
    'compare_products',
    'estimate_cogs',
    'get_platform_fees',
  ];

  it('has exactly 7 default tools registered', () => {
    expect(registry.getAll()).toHaveLength(7);
  });

  for (const toolName of expectedTools) {
    it(`resolves "${toolName}" by name`, () => {
      const tool = registry.resolve(toolName);
      expect(tool.name).toBe(toolName);
      expect(tool.description).toBeTruthy();
      expect(typeof tool.execute).toBe('function');
    });
  }

  it('throws for unknown tool name', () => {
    expect(() => registry.resolve('nonexistent_tool')).toThrow('Unknown tool: nonexistent_tool');
  });

  it('validates input before executing (P9)', () => {
    const tool = registry.resolve('calc_margin');
    const result = tool.execute({
      sellPrice: 30, cogs: 7, platformFeePercent: 0.15, shipping: 5, market: 'us', currency: 'USD',
    });
    expect(result).toHaveProperty('grossMarginPercent');
  });

  it('rejects invalid input with Zod error (P9)', () => {
    const tool = registry.resolve('calc_margin');
    expect(() => tool.execute({ sellPrice: 'not-a-number' })).toThrow();
  });

  it('generates function schema for all tools', () => {
    const schemas = registry.generateSchema();
    expect(schemas).toHaveLength(7);
    for (const schema of schemas) {
      expect(schema.name).toBeTruthy();
      expect(schema.description).toBeTruthy();
      expect(schema.parameters).toBeDefined();
    }
  });

  // ExecutorAgent integration with registry
  it('ExecutorAgent executes a plan step using registered tool', async () => {
    const executor = new ExecutorAgent(registry);
    const plan = {
      steps: [{
        taskId: 'step-1',
        toolName: 'calc_margin',
        toolInput: { sellPrice: 30, cogs: 7, platformFeePercent: 0.15, shipping: 5 },
        reason: 'Calculate margin',
      }],
      missingData: [],
    };
    const results = await executor.execute(plan, usMarket);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].output).toHaveProperty('grossMarginPercent');
  });

  it('ExecutorAgent handles unknown tool gracefully (P5)', async () => {
    const executor = new ExecutorAgent(registry);
    const plan = {
      steps: [{
        taskId: 'step-bad',
        toolName: 'nonexistent_tool',
        toolInput: {},
        reason: 'This should fail gracefully',
      }],
      missingData: [],
    };
    const results = await executor.execute(plan, usMarket);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain('Unknown tool');
  });
});

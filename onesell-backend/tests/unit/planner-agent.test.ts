/**
 * Unit tests for PlannerAgent (#128).
 * Covers: happy path, partial data, invalid LLM output, tool validation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockLLMProvider, type LLMResponse } from '../../src/services/agent/llm-provider.js';
import { ToolRegistry } from '../../src/services/agent/tool-registry.js';
import {
  PlannerAgent,
  type UserPreferences,
  type ExtractionDataSource,
} from '../../src/services/agent/planner-agent.js';
import type { MarketContext } from '../../src/services/agent/tools/types.js';

const US_MARKET: MarketContext = {
  marketId: 'us',
  language: 'en-US',
  currency: 'USD',
  platforms: ['amazon', 'ebay'],
};

const CN_MARKET: MarketContext = {
  marketId: 'cn',
  language: 'zh-CN',
  currency: 'CNY',
  platforms: ['taobao', 'jd'],
};

const DEFAULT_PREFS: UserPreferences = {
  budget: 500,
  preferredPlatforms: ['amazon'],
  categories: ['electronics'],
  riskTolerance: 'medium',
};

const FULL_DATA_SOURCES: ExtractionDataSource[] = [
  { platformId: 'amazon', available: true, data: { listings: 50 } },
  { platformId: 'ebay', available: true, data: { listings: 30 } },
];

const PARTIAL_DATA_SOURCES: ExtractionDataSource[] = [
  { platformId: 'amazon', available: true, data: { listings: 50 } },
  { platformId: 'ebay', available: false },
];

function makeValidPlanResponse(): LLMResponse {
  return {
    content: JSON.stringify({
      steps: [
        { taskId: 'task-1', toolName: 'calc_margin', toolInput: { sellPrice: 30, cogs: 10, platformFeePercent: 0.15, shipping: 5 }, reason: 'Calculate margin' },
        { taskId: 'task-2', toolName: 'rank_competition', toolInput: { listings: [] }, reason: 'Rank competition' },
        { taskId: 'task-3', toolName: 'compare_products', toolInput: { products: [] }, reason: 'Compare products' },
      ],
      missingData: [],
    }),
    usage: { promptTokens: 100, completionTokens: 200 },
  };
}

describe('PlannerAgent', () => {
  let mockLLM: MockLLMProvider;
  let registry: ToolRegistry;
  let planner: PlannerAgent;

  beforeEach(() => {
    mockLLM = new MockLLMProvider();
    registry = new ToolRegistry();
    planner = new PlannerAgent(mockLLM, registry);
  });

  // ── Happy path ──────────────────────────────────────────────────

  it('returns a valid TaskPlan from well-formed LLM output', async () => {
    mockLLM.setResponses([makeValidPlanResponse()]);

    const result = await planner.plan(DEFAULT_PREFS, FULL_DATA_SOURCES, US_MARKET);

    expect(result.steps).toHaveLength(3);
    expect(result.steps[0].toolName).toBe('calc_margin');
    expect(result.steps[1].toolName).toBe('rank_competition');
    expect(result.steps[2].toolName).toBe('compare_products');
    expect(result.missingData).toHaveLength(0);
  });

  it('sends system prompt and user message to LLM', async () => {
    mockLLM.setResponses([makeValidPlanResponse()]);

    await planner.plan(DEFAULT_PREFS, FULL_DATA_SOURCES, US_MARKET);

    expect(mockLLM.calls).toHaveLength(1);
    const call = mockLLM.calls[0];
    expect(call.messages[0].role).toBe('system');
    expect(call.messages[0].content).toContain('Planner agent');
    expect(call.messages[1].role).toBe('user');
    expect(call.messages[1].content).toContain('amazon');
  });

  // ── Partial data (P5) ──────────────────────────────────────────

  it('includes missing data sources in missingData', async () => {
    const response: LLMResponse = {
      content: JSON.stringify({
        steps: [
          { taskId: 'task-1', toolName: 'calc_margin', toolInput: { sellPrice: 30, cogs: 10, platformFeePercent: 0.15, shipping: 5 }, reason: 'Calculate margin' },
        ],
        missingData: ['trend_data'],
      }),
      usage: { promptTokens: 100, completionTokens: 200 },
    };
    mockLLM.setResponses([response]);

    const result = await planner.plan(DEFAULT_PREFS, PARTIAL_DATA_SOURCES, US_MARKET);

    expect(result.missingData).toContain('ebay');
    expect(result.missingData).toContain('trend_data');
  });

  // ── China market (P4) ──────────────────────────────────────────

  it('uses China planner prompt for cn market', async () => {
    mockLLM.setResponses([makeValidPlanResponse()]);

    await planner.plan(DEFAULT_PREFS, FULL_DATA_SOURCES, CN_MARKET);

    const systemPrompt = mockLLM.calls[0].messages[0].content;
    expect(systemPrompt).toContain('CN');
  });

  // ── Invalid LLM output → fallback plan ─────────────────────────

  it('returns fallback plan when LLM returns non-JSON', async () => {
    mockLLM.setResponses([{
      content: 'Here is my plan:\n1. Do analysis\n2. Compare products',
      usage: { promptTokens: 100, completionTokens: 50 },
    }]);

    const result = await planner.plan(DEFAULT_PREFS, FULL_DATA_SOURCES, US_MARKET);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].taskId).toBe('fallback-1');
    expect(result.steps[0].toolName).toBe('compare_products');
  });

  it('returns fallback plan when LLM returns empty response', async () => {
    mockLLM.setResponses([{
      content: '',
      usage: { promptTokens: 0, completionTokens: 0 },
    }]);

    const result = await planner.plan(DEFAULT_PREFS, FULL_DATA_SOURCES, US_MARKET);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].taskId).toBe('fallback-1');
  });

  it('filters out steps referencing unknown tools', async () => {
    mockLLM.setResponses([{
      content: JSON.stringify({
        steps: [
          { taskId: 'task-1', toolName: 'calc_margin', toolInput: { sellPrice: 30, cogs: 10, platformFeePercent: 0.15, shipping: 5 }, reason: 'Valid tool' },
          { taskId: 'task-2', toolName: 'nonexistent_tool', toolInput: {}, reason: 'Invalid tool' },
        ],
        missingData: [],
      }),
      usage: { promptTokens: 100, completionTokens: 200 },
    }]);

    const result = await planner.plan(DEFAULT_PREFS, FULL_DATA_SOURCES, US_MARKET);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].toolName).toBe('calc_margin');
  });

  it('returns fallback when all tools in plan are invalid', async () => {
    mockLLM.setResponses([{
      content: JSON.stringify({
        steps: [
          { taskId: 'task-1', toolName: 'fake_tool_1', toolInput: {}, reason: 'Fake 1' },
          { taskId: 'task-2', toolName: 'fake_tool_2', toolInput: {}, reason: 'Fake 2' },
        ],
        missingData: [],
      }),
      usage: { promptTokens: 100, completionTokens: 200 },
    }]);

    const result = await planner.plan(DEFAULT_PREFS, FULL_DATA_SOURCES, US_MARKET);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].taskId).toBe('fallback-1');
  });

  // ── JSON in code fence ─────────────────────────────────────────

  it('extracts JSON from markdown code fence', async () => {
    const json = JSON.stringify({
      steps: [
        { taskId: 'task-1', toolName: 'score_trend', toolInput: { timeSeries: [], market: 'us' }, reason: 'Score trends' },
      ],
      missingData: [],
    });
    mockLLM.setResponses([{
      content: `Here is the plan:\n\`\`\`json\n${json}\n\`\`\``,
      usage: { promptTokens: 100, completionTokens: 200 },
    }]);

    const result = await planner.plan(DEFAULT_PREFS, FULL_DATA_SOURCES, US_MARKET);

    expect(result.steps).toHaveLength(1);
    expect(result.steps[0].toolName).toBe('score_trend');
  });
});

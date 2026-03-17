/**
 * Unit tests for SynthesizerAgent (#132).
 * Covers: happy path, partial results, invalid LLM output, market language (P4).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MockLLMProvider, type LLMResponse } from '../../src/services/agent/llm-provider.js';
import { SynthesizerAgent } from '../../src/services/agent/synthesizer-agent.js';
import type { ExecutionResult } from '../../src/services/agent/executor-agent.js';
import type { UserPreferences } from '../../src/services/agent/planner-agent.js';
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
  categories: ['electronics'],
  riskTolerance: 'medium',
};

const EXECUTION_RESULTS: ExecutionResult[] = [
  {
    taskId: 'task-1',
    toolName: 'calc_margin',
    output: { grossMarginPercent: 0.58, netMarginPercent: 0.35, profitPerUnit: 12, currency: 'USD' },
    success: true,
  },
  {
    taskId: 'task-2',
    toolName: 'rank_competition',
    output: { competitionScore: 35, level: 'moderate' },
    success: true,
  },
  {
    taskId: 'task-3',
    toolName: 'score_trend',
    output: { direction: 'rising', growthPercent: 15 },
    success: true,
  },
];

function makeValidSynthResponse(): LLMResponse {
  const cards = [
    {
      rank: 1,
      name: 'Wireless Earbuds',
      compositeScore: 85,
      marginEstimate: 58,
      riskLevel: 'low',
      reasons: ['High demand signal', 'Moderate competition', 'Good margin at 58%'],
      category: 'Electronics',
    },
    {
      rank: 2,
      name: 'Phone Cases',
      compositeScore: 72,
      marginEstimate: 45,
      riskLevel: 'medium',
      reasons: ['Steady demand', 'Low barrier to entry', 'Lower margin'],
      category: 'Accessories',
    },
  ];

  return {
    content: '```json\n' + JSON.stringify(cards) + '\n```',
    usage: { promptTokens: 500, completionTokens: 400 },
  };
}

describe('SynthesizerAgent', () => {
  let mockLLM: MockLLMProvider;
  let synthesizer: SynthesizerAgent;

  beforeEach(() => {
    mockLLM = new MockLLMProvider();
    synthesizer = new SynthesizerAgent(mockLLM);
  });

  // ── Happy path ──────────────────────────────────────────────────

  it('returns validated ProductCard[] from well-formed LLM output', async () => {
    mockLLM.setResponses([makeValidSynthResponse()]);

    const cards = await synthesizer.synthesize(EXECUTION_RESULTS, DEFAULT_PREFS, US_MARKET);

    expect(cards).toHaveLength(2);
    expect(cards[0].rank).toBe(1);
    expect(cards[0].name).toBe('Wireless Earbuds');
    expect(cards[0].compositeScore).toBe(85);
    expect(cards[0].marginEstimate).toBe(58);
    expect(cards[0].riskLevel).toBe('low');
    expect(cards[0].reasons.length).toBeGreaterThanOrEqual(1);
    expect(cards[0].category).toBe('Electronics');
  });

  it('re-indexes ranks sequentially', async () => {
    const response: LLMResponse = {
      content: JSON.stringify([
        { rank: 5, name: 'Product A', compositeScore: 90, marginEstimate: 60, riskLevel: 'low', reasons: ['Good'], category: 'Cat A' },
        { rank: 10, name: 'Product B', compositeScore: 80, marginEstimate: 50, riskLevel: 'medium', reasons: ['OK'], category: 'Cat B' },
      ]),
      usage: { promptTokens: 100, completionTokens: 200 },
    };
    mockLLM.setResponses([response]);

    const cards = await synthesizer.synthesize(EXECUTION_RESULTS, DEFAULT_PREFS, US_MARKET);

    expect(cards[0].rank).toBe(1);
    expect(cards[1].rank).toBe(2);
  });

  // ── Market language (P4) ──────────────────────────────────────

  it('sends synthesizer prompt for China market', async () => {
    mockLLM.setResponses([makeValidSynthResponse()]);

    await synthesizer.synthesize(EXECUTION_RESULTS, DEFAULT_PREFS, CN_MARKET);

    const systemPrompt = mockLLM.calls[0].messages[0].content;
    expect(systemPrompt).toContain('CN');
    expect(systemPrompt).toContain('简体中文');
  });

  // ── Partial results ───────────────────────────────────────────

  it('handles mixed success/failed execution results', async () => {
    const mixedResults: ExecutionResult[] = [
      ...EXECUTION_RESULTS,
      { taskId: 'task-4', toolName: 'estimate_cogs', output: null, success: false, error: 'Tool failed' },
    ];
    mockLLM.setResponses([makeValidSynthResponse()]);

    const cards = await synthesizer.synthesize(mixedResults, DEFAULT_PREFS, US_MARKET);

    // Should still produce cards from available data
    expect(cards.length).toBeGreaterThanOrEqual(1);

    // Verify the user message includes failed tasks info
    const userMsg = JSON.parse(mockLLM.calls[0].messages[1].content);
    expect(userMsg.failedTasks).toHaveLength(1);
    expect(userMsg.failedTasks[0].toolName).toBe('estimate_cogs');
  });

  // ── Invalid LLM output ────────────────────────────────────────

  it('throws when LLM returns non-JSON', async () => {
    mockLLM.setResponses([{
      content: 'Here are my recommendations: Product A is great.',
      usage: { promptTokens: 100, completionTokens: 50 },
    }]);

    await expect(
      synthesizer.synthesize(EXECUTION_RESULTS, DEFAULT_PREFS, US_MARKET),
    ).rejects.toThrow('Synthesizer output is not valid JSON');
  });

  it('throws when LLM returns invalid card structure', async () => {
    mockLLM.setResponses([{
      content: JSON.stringify([{ name: 'Bad Card' }]), // missing required fields
      usage: { promptTokens: 100, completionTokens: 50 },
    }]);

    await expect(
      synthesizer.synthesize(EXECUTION_RESULTS, DEFAULT_PREFS, US_MARKET),
    ).rejects.toThrow('Synthesizer output validation failed');
  });

  it('throws when LLM returns empty array', async () => {
    mockLLM.setResponses([{
      content: '[]',
      usage: { promptTokens: 100, completionTokens: 50 },
    }]);

    await expect(
      synthesizer.synthesize(EXECUTION_RESULTS, DEFAULT_PREFS, US_MARKET),
    ).rejects.toThrow('Synthesizer output validation failed');
  });

  // ── Nullable marginEstimate ───────────────────────────────────

  it('accepts null marginEstimate for missing COGS data', async () => {
    const response: LLMResponse = {
      content: JSON.stringify([
        {
          rank: 1,
          name: 'Product A',
          compositeScore: 80,
          marginEstimate: null,
          riskLevel: 'high',
          reasons: ['No margin data available'],
          category: 'Cat A',
        },
      ]),
      usage: { promptTokens: 100, completionTokens: 200 },
    };
    mockLLM.setResponses([response]);

    const cards = await synthesizer.synthesize(EXECUTION_RESULTS, DEFAULT_PREFS, US_MARKET);

    expect(cards[0].marginEstimate).toBeNull();
  });
});

/**
 * Unit tests for AgentService orchestrator (#134).
 * Covers: full pipeline, status progression, partial failure, Redis storage.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockLLMProvider, type LLMResponse } from '../../src/services/agent/llm-provider.js';
import { ToolRegistry } from '../../src/services/agent/tool-registry.js';
import { AgentService, type AgentServiceDeps } from '../../src/services/agent/agent-service.js';
import type { UserPreferences, ExtractionDataSource } from '../../src/services/agent/planner-agent.js';
import type { MarketContext } from '../../src/services/agent/tools/types.js';
import type { SessionStatus } from '../../src/services/redis.js';

const US_MARKET: MarketContext = {
  marketId: 'us',
  language: 'en-US',
  currency: 'USD',
  platforms: ['amazon', 'ebay'],
};

const DEFAULT_PREFS: UserPreferences = {
  budget: 500,
  categories: ['electronics'],
  riskTolerance: 'medium',
};

const DATA_SOURCES: ExtractionDataSource[] = [
  { platformId: 'amazon', available: true, data: { listings: 50 } },
];

function makePlannerResponse(): LLMResponse {
  return {
    content: JSON.stringify({
      steps: [
        {
          taskId: 'task-1',
          toolName: 'calc_margin',
          toolInput: { sellPrice: 50, cogs: 15, platformFeePercent: 0.15, shipping: 5 },
          reason: 'Calculate margin for target product',
        },
      ],
      missingData: [],
    }),
    usage: { promptTokens: 100, completionTokens: 200 },
  };
}

function makeSynthResponse(): LLMResponse {
  const cards = [
    {
      rank: 1,
      name: 'Test Product',
      compositeScore: 82,
      marginEstimate: 55,
      riskLevel: 'low',
      reasons: ['Good margin from calc_margin tool', 'Rising trend'],
      category: 'Electronics',
    },
  ];
  return {
    content: JSON.stringify(cards),
    usage: { promptTokens: 500, completionTokens: 400 },
  };
}

describe('AgentService', () => {
  let mockLLM: MockLLMProvider;
  let registry: ToolRegistry;
  let mockSetStatus: ReturnType<typeof vi.fn>;
  let mockStoreResults: ReturnType<typeof vi.fn>;
  let service: AgentService;
  let statusCalls: SessionStatus[];

  beforeEach(() => {
    mockLLM = new MockLLMProvider();
    registry = new ToolRegistry();
    statusCalls = [];

    mockSetStatus = vi.fn(async (_sessionId: string, status: SessionStatus) => {
      statusCalls.push(status);
      return true;
    });
    mockStoreResults = vi.fn(async () => true);

    const deps: AgentServiceDeps = {
      llm: mockLLM,
      registry,
      setStatus: mockSetStatus,
      storeResults: mockStoreResults,
    };
    service = new AgentService(deps);
  });

  // ── Full pipeline success ──────────────────────────────────────

  it('completes full pipeline: plan → execute → synthesize', async () => {
    // LLM call 1: planner, LLM call 2: synthesizer
    mockLLM.setResponses([makePlannerResponse(), makeSynthResponse()]);

    const result = await service.analyze('session-1', DATA_SOURCES, DEFAULT_PREFS, US_MARKET);

    expect(result.status).toBe('complete');
    expect(result.products).toHaveLength(1);
    expect(result.products[0].name).toBe('Test Product');
    expect(result.executionResults).toHaveLength(1);
    expect(result.executionResults[0].success).toBe(true);
    expect(result.sessionId).toBe('session-1');
  });

  // ── Status progression ────────────────────────────────────────

  it('progresses through status stages: planning → executing → synthesizing → complete', async () => {
    mockLLM.setResponses([makePlannerResponse(), makeSynthResponse()]);

    await service.analyze('session-1', DATA_SOURCES, DEFAULT_PREFS, US_MARKET);

    const stages = statusCalls.map(s => s.status);
    expect(stages).toEqual(['planning', 'executing', 'synthesizing', 'complete']);
  });

  // ── Redis storage ─────────────────────────────────────────────

  it('stores final results in Redis', async () => {
    mockLLM.setResponses([makePlannerResponse(), makeSynthResponse()]);

    await service.analyze('session-1', DATA_SOURCES, DEFAULT_PREFS, US_MARKET);

    expect(mockStoreResults).toHaveBeenCalledTimes(1);
    const storedResult = mockStoreResults.mock.calls[0][1];
    expect(storedResult.status).toBe('complete');
    expect(storedResult.products).toHaveLength(1);
  });

  it('stores session ID with status updates', async () => {
    mockLLM.setResponses([makePlannerResponse(), makeSynthResponse()]);

    await service.analyze('session-42', DATA_SOURCES, DEFAULT_PREFS, US_MARKET);

    expect(mockSetStatus).toHaveBeenCalledTimes(4);
    // All calls should be for the same session
    for (const call of mockSetStatus.mock.calls) {
      expect(call[0]).toBe('session-42');
    }
  });

  // ── Planner failure ───────────────────────────────────────────

  it('returns error status when planner LLM call throws', async () => {
    mockLLM.setResponses([]); // No responses → MockLLMProvider returns empty
    // Override chat to throw
    const failLLM = new MockLLMProvider();
    failLLM.chat = async () => { throw new Error('LLM unavailable'); };

    const deps: AgentServiceDeps = {
      llm: failLLM,
      registry,
      setStatus: mockSetStatus,
      storeResults: mockStoreResults,
    };
    const failService = new AgentService(deps);

    const result = await failService.analyze('session-err', DATA_SOURCES, DEFAULT_PREFS, US_MARKET);

    expect(result.status).toBe('error');
    expect(result.error).toContain('Planning failed');
    expect(result.products).toHaveLength(0);
  });

  // ── Synthesizer failure → partial results (P5) ────────────────

  it('returns partial results when synthesizer fails', async () => {
    // Planner succeeds, synthesizer returns invalid JSON
    mockLLM.setResponses([
      makePlannerResponse(),
      { content: 'NOT JSON AT ALL', usage: { promptTokens: 100, completionTokens: 50 } },
    ]);

    const result = await service.analyze('session-partial', DATA_SOURCES, DEFAULT_PREFS, US_MARKET);

    expect(result.status).toBe('error');
    expect(result.error).toContain('Synthesis failed');
    // Execution results are still available
    expect(result.executionResults).toHaveLength(1);
    expect(result.products).toHaveLength(0);
  });

  // ── Missing data propagation ──────────────────────────────────

  it('propagates missing data info from planner to final result', async () => {
    const planResponse: LLMResponse = {
      content: JSON.stringify({
        steps: [
          { taskId: 'task-1', toolName: 'calc_margin', toolInput: { sellPrice: 50, cogs: 15, platformFeePercent: 0.15, shipping: 5 }, reason: 'calc' },
        ],
        missingData: ['trend_api'],
      }),
      usage: { promptTokens: 100, completionTokens: 200 },
    };
    mockLLM.setResponses([planResponse, makeSynthResponse()]);

    const partialSources: ExtractionDataSource[] = [
      { platformId: 'amazon', available: true },
      { platformId: 'ebay', available: false },
    ];

    const result = await service.analyze('session-missing', partialSources, DEFAULT_PREFS, US_MARKET);

    expect(result.missingData).toContain('trend_api');
    expect(result.missingData).toContain('ebay');
  });

  // ── Execution tool failures don't crash pipeline ──────────────

  it('continues pipeline when some executor tools fail', async () => {
    const planResponse: LLMResponse = {
      content: JSON.stringify({
        steps: [
          { taskId: 'task-ok', toolName: 'calc_margin', toolInput: { sellPrice: 50, cogs: 15, platformFeePercent: 0.15, shipping: 5 }, reason: 'Valid' },
          { taskId: 'task-fail', toolName: 'calc_margin', toolInput: { sellPrice: 'bad', cogs: 'bad' }, reason: 'Will fail with bad input' },
        ],
        missingData: [],
      }),
      usage: { promptTokens: 100, completionTokens: 200 },
    };
    mockLLM.setResponses([planResponse, makeSynthResponse()]);

    const result = await service.analyze('session-mixed', DATA_SOURCES, DEFAULT_PREFS, US_MARKET);

    expect(result.status).toBe('complete');
    expect(result.executionResults).toHaveLength(2);
    expect(result.executionResults[0].success).toBe(true);
    expect(result.executionResults[1].success).toBe(false);
  });
});

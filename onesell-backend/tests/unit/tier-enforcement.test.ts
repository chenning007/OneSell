/**
 * Unit tests for tier enforcement middleware (#63).
 * Tests weekly analysis limits, result truncation, feature gating.
 * DB and Redis fully mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Generate RSA keypairs before mocks ──────────────────────────────

const { testKeys } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('node:crypto');
  const pair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { testKeys: { privateKey: pair.privateKey as string, publicKey: pair.publicKey as string } };
});

// ── Hoisted mock state ──────────────────────────────────────────────

const { mockWeeklyCount } = vi.hoisted(() => ({
  mockWeeklyCount: { value: 0 },
}));

// ── Mock env ────────────────────────────────────────────────────────

vi.mock('../../src/env.js', () => ({
  env: {
    JWT_PRIVATE_KEY: testKeys.privateKey,
    JWT_PUBLIC_KEY: testKeys.publicKey,
    CORS_ORIGIN: 'http://localhost:5173',
    NODE_ENV: 'test',
    PORT: 3001,
    LOG_LEVEL: 'error',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    OPENAI_API_KEY: 'test-key',
  },
}));

// ── Mock DB ─────────────────────────────────────────────────────────

vi.mock('../../src/db/index.js', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn(async () => [{ count: mockWeeklyCount.value }]),
      }),
    }),
  },
}));

// ── In-memory Redis mock ────────────────────────────────────────────

const redisStore = new Map<string, string>();

const mockRedis = {
  get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
  set: vi.fn(async (key: string, value: string, ..._args: unknown[]) => {
    redisStore.set(key, value);
    return 'OK';
  }),
};

vi.mock('../../src/services/redis.js', () => ({
  getRedis: () => mockRedis,
}));

// ── Mock AgentService ───────────────────────────────────────────────

const mockAnalyze = vi.fn<(...args: unknown[]) => Promise<unknown>>();
const mockAgentService = { analyze: mockAnalyze } as any;

// ── Imports (after mocks) ───────────────────────────────────────────

import Fastify from 'fastify';
import { analysisRoutes } from '../../src/api/routes/analysis.js';
import { generateAccessToken } from '../../src/api/middleware/auth.js';
import {
  TIER_ANALYSIS_LIMITS,
  TIER_RESULT_LIMITS,
  TIER_FEATURES,
  getIsoWeekStart,
  truncateResults,
} from '../../src/api/middleware/tier-enforcement.js';
import type { SubscriptionTier } from '../../src/api/middleware/auth.js';

// ── Helpers ─────────────────────────────────────────────────────────

function buildApp() {
  const app = Fastify({ logger: false });
  app.decorateRequest('user', null);
  app.register(analysisRoutes, { prefix: '/analysis', agentService: mockAgentService });
  return app;
}

function authHeader(userId: string, tier: SubscriptionTier = 'free') {
  return { Authorization: `Bearer ${generateAccessToken(userId, tier)}` };
}

const validPayload = {
  extractionData: [{ platformId: 'amazon', available: true, data: { title: 'Widget' } }],
  preferences: { budget: 500, riskTolerance: 'medium' as const },
  marketId: 'us',
};

// ── Tests ───────────────────────────────────────────────────────────

describe('Tier Enforcement (#63)', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    redisStore.clear();
    mockWeeklyCount.value = 0;
    mockAnalyze.mockReset();
    mockAnalyze.mockResolvedValue({ sessionId: 'any', status: 'complete', products: [], executionResults: [], missingData: [] });
    mockRedis.get.mockImplementation(async (key: string) => redisStore.get(key) ?? null);
    mockRedis.set.mockImplementation(async (key: string, value: string) => { redisStore.set(key, value); return 'OK'; });
    app = buildApp();
    await app.ready();
  });

  // ── Config constants ────────────────────────────────────────────

  describe('Tier config constants', () => {
    it('free tier allows 1 analysis/week', () => {
      expect(TIER_ANALYSIS_LIMITS.free).toBe(1);
    });

    it('starter tier allows 5 analyses/week', () => {
      expect(TIER_ANALYSIS_LIMITS.starter).toBe(5);
    });

    it('pro tier allows unlimited analyses', () => {
      expect(TIER_ANALYSIS_LIMITS.pro).toBe(Infinity);
    });

    it('business tier allows unlimited analyses', () => {
      expect(TIER_ANALYSIS_LIMITS.business).toBe(Infinity);
    });

    it('free tier shows 3 result cards', () => {
      expect(TIER_RESULT_LIMITS.free).toBe(3);
    });

    it('starter/pro/business show 10 result cards', () => {
      expect(TIER_RESULT_LIMITS.starter).toBe(10);
      expect(TIER_RESULT_LIMITS.pro).toBe(10);
      expect(TIER_RESULT_LIMITS.business).toBe(10);
    });

    it('free tier has no drill-down', () => {
      expect(TIER_FEATURES.free.drillDown).toBe(false);
    });

    it('starter tier has drill-down', () => {
      expect(TIER_FEATURES.starter.drillDown).toBe(true);
    });

    it('pro tier has all features except API and team sharing', () => {
      expect(TIER_FEATURES.pro.drillDown).toBe(true);
      expect(TIER_FEATURES.pro.marginCalculator).toBe(true);
      expect(TIER_FEATURES.pro.supplierLinks).toBe(true);
      expect(TIER_FEATURES.pro.csvExport).toBe(true);
      expect(TIER_FEATURES.pro.apiAccess).toBe(false);
    });

    it('business tier has all features', () => {
      expect(TIER_FEATURES.business.drillDown).toBe(true);
      expect(TIER_FEATURES.business.apiAccess).toBe(true);
      expect(TIER_FEATURES.business.teamSharing).toBe(true);
    });
  });

  // ── getIsoWeekStart ─────────────────────────────────────────────

  describe('getIsoWeekStart', () => {
    it('returns a Date that is a Monday', () => {
      const start = getIsoWeekStart();
      expect(start.getUTCDay()).toBe(1); // Monday
    });

    it('returns midnight UTC', () => {
      const start = getIsoWeekStart();
      expect(start.getUTCHours()).toBe(0);
      expect(start.getUTCMinutes()).toBe(0);
      expect(start.getUTCSeconds()).toBe(0);
    });
  });

  // ── Analysis limit enforcement ──────────────────────────────────

  describe('Analysis limit — POST /analysis', () => {
    it('free user: 1st analysis succeeds', async () => {
      mockWeeklyCount.value = 0;

      const res = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-free', 'free'),
        payload: validPayload,
      });

      expect(res.statusCode).toBe(202);
    });

    it('free user: 2nd analysis in same week blocked with 402', async () => {
      mockWeeklyCount.value = 1; // already used 1

      const res = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-free', 'free'),
        payload: validPayload,
      });

      expect(res.statusCode).toBe(402);
      const body = res.json();
      expect(body.upgradeRequired).toBe(true);
      expect(body.currentTier).toBe('free');
      expect(body.weeklyLimit).toBe(1);
    });

    it('starter user: 5th analysis succeeds', async () => {
      mockWeeklyCount.value = 4;

      const res = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-starter', 'starter'),
        payload: validPayload,
      });

      expect(res.statusCode).toBe(202);
    });

    it('starter user: 6th analysis in week blocked with 402', async () => {
      mockWeeklyCount.value = 5;

      const res = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-starter', 'starter'),
        payload: validPayload,
      });

      expect(res.statusCode).toBe(402);
      const body = res.json();
      expect(body.upgradeRequired).toBe(true);
      expect(body.currentTier).toBe('starter');
      expect(body.weeklyLimit).toBe(5);
    });

    it('pro user: unlimited analyses (100th succeeds)', async () => {
      mockWeeklyCount.value = 100;

      const res = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-pro', 'pro'),
        payload: validPayload,
      });

      expect(res.statusCode).toBe(202);
    });

    it('business user: unlimited analyses', async () => {
      mockWeeklyCount.value = 500;

      const res = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-biz', 'business'),
        payload: validPayload,
      });

      expect(res.statusCode).toBe(202);
    });
  });

  // ── Result truncation ───────────────────────────────────────────

  describe('Result truncation', () => {
    it('truncates rankedProducts to 3 for free tier', () => {
      const results = {
        status: 'complete',
        rankedProducts: Array.from({ length: 10 }, (_, i) => ({ name: `P${i}` })),
      };

      const truncated = truncateResults(results, 'free');
      expect(truncated.rankedProducts).toHaveLength(3);
      expect((truncated as any).truncated).toBe(true);
      expect((truncated as any).totalResults).toBe(10);
      expect((truncated as any).visibleResults).toBe(3);
    });

    it('returns all 10 for starter tier', () => {
      const results = {
        status: 'complete',
        rankedProducts: Array.from({ length: 10 }, (_, i) => ({ name: `P${i}` })),
      };

      const truncated = truncateResults(results, 'starter');
      expect(truncated.rankedProducts).toHaveLength(10);
      expect((truncated as any).truncated).toBeUndefined();
    });

    it('returns all for pro tier when fewer than limit', () => {
      const results = {
        status: 'complete',
        rankedProducts: Array.from({ length: 5 }, (_, i) => ({ name: `P${i}` })),
      };

      const truncated = truncateResults(results, 'pro');
      expect(truncated.rankedProducts).toHaveLength(5);
    });

    it('does not crash when rankedProducts is missing', () => {
      const results = { status: 'complete' } as any;
      const truncated = truncateResults(results, 'free');
      expect(truncated.status).toBe('complete');
    });
  });

  // ── Result truncation in GET /analysis/:id/results ──────────────

  describe('GET /analysis/:id/results — tier result limits', () => {
    it('free user sees only 3 result cards even when 10 exist', async () => {
      // Submit as free user
      const submitRes = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-free', 'free'),
        payload: validPayload,
      });
      const { analysisId } = submitRes.json();

      // Store results with 10 products
      const mockResults = {
        sessionId: analysisId,
        status: 'complete',
        rankedProducts: Array.from({ length: 10 }, (_, i) => ({ name: `Product ${i}` })),
        executionResults: [],
        missingData: [],
      };

      redisStore.set(
        `session:${analysisId}:status`,
        JSON.stringify({ status: 'complete' }),
      );
      redisStore.set(
        `session:${analysisId}:results`,
        JSON.stringify(mockResults),
      );

      const res = await app.inject({
        method: 'GET',
        url: `/analysis/${analysisId}/results`,
        headers: authHeader('user-free', 'free'),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.results.rankedProducts).toHaveLength(3);
      expect(body.results.truncated).toBe(true);
      expect(body.results.totalResults).toBe(10);
    });

    it('pro user sees all 10 result cards', async () => {
      const submitRes = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-pro', 'pro'),
        payload: validPayload,
      });
      const { analysisId } = submitRes.json();

      const mockResults = {
        sessionId: analysisId,
        status: 'complete',
        rankedProducts: Array.from({ length: 10 }, (_, i) => ({ name: `Product ${i}` })),
        executionResults: [],
        missingData: [],
      };

      redisStore.set(
        `session:${analysisId}:status`,
        JSON.stringify({ status: 'complete' }),
      );
      redisStore.set(
        `session:${analysisId}:results`,
        JSON.stringify(mockResults),
      );

      const res = await app.inject({
        method: 'GET',
        url: `/analysis/${analysisId}/results`,
        headers: authHeader('user-pro', 'pro'),
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.results.rankedProducts).toHaveLength(10);
    });
  });

  // ── Feature gate: drill-down ────────────────────────────────────

  describe('GET /analysis/:id/drilldown — feature gate', () => {
    it('free user: drill-down returns 402', async () => {
      const submitRes = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-free', 'free'),
        payload: validPayload,
      });
      const { analysisId } = submitRes.json();

      const res = await app.inject({
        method: 'GET',
        url: `/analysis/${analysisId}/drilldown`,
        headers: authHeader('user-free', 'free'),
      });

      expect(res.statusCode).toBe(402);
      const body = res.json();
      expect(body.upgradeRequired).toBe(true);
      expect(body.requiredFeature).toBe('drillDown');
    });

    it('starter user: drill-down succeeds', async () => {
      const submitRes = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-starter', 'starter'),
        payload: validPayload,
      });
      const { analysisId } = submitRes.json();

      // Store results
      redisStore.set(
        `session:${analysisId}:results`,
        JSON.stringify({ status: 'complete', rankedProducts: [] }),
      );

      const res = await app.inject({
        method: 'GET',
        url: `/analysis/${analysisId}/drilldown`,
        headers: authHeader('user-starter', 'starter'),
      });

      expect(res.statusCode).toBe(200);
    });

    it('pro user: drill-down succeeds', async () => {
      const submitRes = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-pro', 'pro'),
        payload: validPayload,
      });
      const { analysisId } = submitRes.json();

      redisStore.set(
        `session:${analysisId}:results`,
        JSON.stringify({ status: 'complete', rankedProducts: [] }),
      );

      const res = await app.inject({
        method: 'GET',
        url: `/analysis/${analysisId}/drilldown`,
        headers: authHeader('user-pro', 'pro'),
      });

      expect(res.statusCode).toBe(200);
    });
  });

  // ── Server-side enforcement (client bypass) ─────────────────────

  describe('Server-side enforcement — client cannot bypass', () => {
    it('client cannot get more results by manipulating request (server truncates)', async () => {
      const submitRes = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-free', 'free'),
        payload: validPayload,
      });
      const { analysisId } = submitRes.json();

      const mockResults = {
        sessionId: analysisId,
        status: 'complete',
        rankedProducts: Array.from({ length: 10 }, (_, i) => ({ name: `Product ${i}` })),
      };

      redisStore.set(`session:${analysisId}:status`, JSON.stringify({ status: 'complete' }));
      redisStore.set(`session:${analysisId}:results`, JSON.stringify(mockResults));

      // Even if client sends extra headers or params, server enforces limit
      const res = await app.inject({
        method: 'GET',
        url: `/analysis/${analysisId}/results`,
        headers: {
          ...authHeader('user-free', 'free'),
          'X-Override-Limit': '100', // hypothetical bypass attempt
        },
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().results.rankedProducts).toHaveLength(3);
    });

    it('402 response includes upgradeRequired metadata', async () => {
      mockWeeklyCount.value = 1; // free tier exhausted

      const res = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-free', 'free'),
        payload: validPayload,
      });

      expect(res.statusCode).toBe(402);
      const body = res.json();
      expect(body).toHaveProperty('upgradeRequired', true);
      expect(body).toHaveProperty('currentTier', 'free');
      expect(body).toHaveProperty('weeklyLimit');
      expect(body).toHaveProperty('weeklyUsed');
    });
  });
});

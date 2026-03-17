/**
 * Unit tests for analysis routes (#136).
 * Tests submission, status polling, results retrieval, auth, user isolation, validation.
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

// ── In-memory Redis mock ────────────────────────────────────────────

const redisStore = new Map<string, string>();

const mockRedis = {
  get: vi.fn(async (key: string) => redisStore.get(key) ?? null),
  set: vi.fn(async (key: string, value: string, ..._args: unknown[]) => {
    redisStore.set(key, value);
    return 'OK';
  }),
};

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

// ── Mock Redis ──────────────────────────────────────────────────────

vi.mock('../../src/services/redis.js', () => ({
  getRedis: () => mockRedis,
}));

// ── Mock DB (tier enforcement inserts analysis_sessions) ────────────

vi.mock('../../src/db/index.js', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue([]),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
      }),
    }),
  },
}));

// ── Mock AgentService ───────────────────────────────────────────────

const mockAnalyze = vi.fn<(...args: unknown[]) => Promise<unknown>>();

const mockAgentService = {
  analyze: mockAnalyze,
} as any;

// ── Imports (after mocks) ───────────────────────────────────────────

import Fastify from 'fastify';
import { analysisRoutes } from '../../src/api/routes/analysis.js';
import { generateAccessToken } from '../../src/api/middleware/auth.js';

// ── Helpers ─────────────────────────────────────────────────────────

function buildApp() {
  const app = Fastify({ logger: false });
  app.decorateRequest('user', null);
  app.register(analysisRoutes, { prefix: '/analysis', agentService: mockAgentService });
  return app;
}

function authHeader(userId: string, tier: 'free' | 'starter' | 'pro' | 'business' = 'free') {
  return { Authorization: `Bearer ${generateAccessToken(userId, tier)}` };
}

const validPayload = {
  extractionData: [{ platformId: 'amazon', available: true, data: { title: 'Widget' } }],
  preferences: { budget: 500, riskTolerance: 'medium' as const },
  marketId: 'us',
};

// ── Tests ───────────────────────────────────────────────────────────

describe('Analysis Routes (#136)', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    redisStore.clear();
    mockAnalyze.mockReset();
    mockAnalyze.mockResolvedValue({ sessionId: 'any', status: 'complete', products: [], executionResults: [], missingData: [] });
    mockRedis.get.mockImplementation(async (key: string) => redisStore.get(key) ?? null);
    mockRedis.set.mockImplementation(async (key: string, value: string) => { redisStore.set(key, value); return 'OK'; });
    app = buildApp();
    await app.ready();
  });

  // ── POST /analysis ──────────────────────────────────────────────

  describe('POST /analysis', () => {
    it('returns 202 with analysisId and pending status', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-1'),
        payload: validPayload,
      });

      expect(res.statusCode).toBe(202);
      const body = res.json();
      expect(body.analysisId).toBeDefined();
      expect(typeof body.analysisId).toBe('string');
      expect(body.status).toBe('pending');
    });

    it('stores owner in Redis', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-1'),
        payload: validPayload,
      });

      const { analysisId } = res.json();
      expect(redisStore.get(`analysis:${analysisId}:owner`)).toBe('user-1');
    });

    it('calls AgentService.analyze with correct arguments', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-1'),
        payload: validPayload,
      });

      // Allow fire-and-forget to resolve
      await new Promise((r) => setTimeout(r, 10));

      expect(mockAnalyze).toHaveBeenCalledTimes(1);
      const [sessionId, extractionData, preferences, market] = mockAnalyze.mock.calls[0] as unknown[];
      expect(sessionId).toBe(res.json().analysisId);
      expect(extractionData).toEqual(validPayload.extractionData);
      expect(preferences).toEqual(validPayload.preferences);
      expect((market as any).marketId).toBe('us');
    });

    it('returns 401 without auth header', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/analysis',
        payload: validPayload,
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 400 for invalid body — missing extractionData', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-1'),
        payload: { preferences: {}, marketId: 'us' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Validation failed');
    });

    it('returns 400 for invalid body — bad marketId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-1'),
        payload: { ...validPayload, marketId: 'invalid' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for empty extractionData array', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-1'),
        payload: { ...validPayload, extractionData: [] },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── GET /analysis/:analysisId/status ────────────────────────────

  describe('GET /analysis/:analysisId/status', () => {
    it('returns pending when no status stored yet', async () => {
      // Submit first
      const submitRes = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-1'),
        payload: validPayload,
      });
      const { analysisId } = submitRes.json();

      const res = await app.inject({
        method: 'GET',
        url: `/analysis/${analysisId}/status`,
        headers: authHeader('user-1'),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('pending');
    });

    it('returns current status when analysis is in progress', async () => {
      const submitRes = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-1'),
        payload: validPayload,
      });
      const { analysisId } = submitRes.json();

      // Simulate status update in Redis
      redisStore.set(
        `session:${analysisId}:status`,
        JSON.stringify({ status: 'executing', message: 'Running tasks…' }),
      );

      const res = await app.inject({
        method: 'GET',
        url: `/analysis/${analysisId}/status`,
        headers: authHeader('user-1'),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('executing');
      expect(res.json().message).toBe('Running tasks…');
    });

    it('returns 404 for non-existent analysisId', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/analysis/non-existent-id/status',
        headers: authHeader('user-1'),
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/analysis/some-id/status',
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 404 when different user tries to access (user isolation)', async () => {
      const submitRes = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-1'),
        payload: validPayload,
      });
      const { analysisId } = submitRes.json();

      // Different user tries to access
      const res = await app.inject({
        method: 'GET',
        url: `/analysis/${analysisId}/status`,
        headers: authHeader('user-2'),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  // ── GET /analysis/:analysisId/results ───────────────────────────

  describe('GET /analysis/:analysisId/results', () => {
    it('returns 202 when analysis is still in progress', async () => {
      const submitRes = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-1'),
        payload: validPayload,
      });
      const { analysisId } = submitRes.json();

      redisStore.set(
        `session:${analysisId}:status`,
        JSON.stringify({ status: 'planning' }),
      );

      const res = await app.inject({
        method: 'GET',
        url: `/analysis/${analysisId}/results`,
        headers: authHeader('user-1'),
      });

      expect(res.statusCode).toBe(202);
      expect(res.json().status).toBe('planning');
    });

    it('returns 202 when no status exists yet (pending)', async () => {
      const submitRes = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-1'),
        payload: validPayload,
      });
      const { analysisId } = submitRes.json();

      const res = await app.inject({
        method: 'GET',
        url: `/analysis/${analysisId}/results`,
        headers: authHeader('user-1'),
      });

      expect(res.statusCode).toBe(202);
      expect(res.json().status).toBe('pending');
    });

    it('returns results when analysis is complete', async () => {
      const submitRes = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-1'),
        payload: validPayload,
      });
      const { analysisId } = submitRes.json();

      const mockResults = {
        sessionId: analysisId,
        status: 'complete',
        products: [{ name: 'Widget A' }],
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
        headers: authHeader('user-1'),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('complete');
      expect(res.json().results.products).toEqual([{ name: 'Widget A' }]);
    });

    it('returns results when analysis errored (partial results)', async () => {
      const submitRes = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-1'),
        payload: validPayload,
      });
      const { analysisId } = submitRes.json();

      const errorResults = {
        sessionId: analysisId,
        status: 'error',
        products: [],
        executionResults: [],
        missingData: [],
        error: 'Planning failed',
      };

      redisStore.set(
        `session:${analysisId}:status`,
        JSON.stringify({ status: 'error' }),
      );
      redisStore.set(
        `session:${analysisId}:results`,
        JSON.stringify(errorResults),
      );

      const res = await app.inject({
        method: 'GET',
        url: `/analysis/${analysisId}/results`,
        headers: authHeader('user-1'),
      });

      expect(res.statusCode).toBe(200);
      expect(res.json().status).toBe('error');
      expect(res.json().results.error).toBe('Planning failed');
    });

    it('returns 404 for non-existent analysisId', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/analysis/non-existent-id/results',
        headers: authHeader('user-1'),
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 401 without auth', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/analysis/some-id/results',
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 404 when different user tries to access (user isolation)', async () => {
      const submitRes = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-1'),
        payload: validPayload,
      });
      const { analysisId } = submitRes.json();

      redisStore.set(
        `session:${analysisId}:status`,
        JSON.stringify({ status: 'complete' }),
      );
      redisStore.set(
        `session:${analysisId}:results`,
        JSON.stringify({ status: 'complete', products: [] }),
      );

      const res = await app.inject({
        method: 'GET',
        url: `/analysis/${analysisId}/results`,
        headers: authHeader('user-2'),
      });

      expect(res.statusCode).toBe(404);
    });

    it('returns 404 when results missing but status is complete', async () => {
      const submitRes = await app.inject({
        method: 'POST',
        url: '/analysis',
        headers: authHeader('user-1'),
        payload: validPayload,
      });
      const { analysisId } = submitRes.json();

      redisStore.set(
        `session:${analysisId}:status`,
        JSON.stringify({ status: 'complete' }),
      );
      // No results stored

      const res = await app.inject({
        method: 'GET',
        url: `/analysis/${analysisId}/results`,
        headers: authHeader('user-1'),
      });

      expect(res.statusCode).toBe(404);
    });
  });
});

/**
 * Unit tests for Redis-backed rate limiting (#98).
 * Tests tier limits, 429 response, sliding window behaviour.
 * Redis is fully mocked — no running server required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3001,
    LOG_LEVEL: 'error',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_PRIVATE_KEY: 'test',
    JWT_PUBLIC_KEY: 'test',
    OPENAI_API_KEY: 'test-key',
    CORS_ORIGIN: 'http://localhost:5173',
  },
}));

vi.mock('../../src/services/redis.js', () => ({
  getRedis: vi.fn(() => ({})),
  redisKeys: {},
}));

import {
  TIER_LIMITS,
  rateLimitKey,
  checkRateLimit,
  rateLimitHook,
  type RateLimitResult,
} from '../../src/api/middleware/rate-limit.js';
import type { SubscriptionTier } from '../../src/api/middleware/auth.js';

// ── Mock Redis factory ──────────────────────────────────────────────

function createMockRedis(currentCount: number) {
  const pipeline = {
    zremrangebyscore: vi.fn().mockReturnThis(),
    zadd: vi.fn().mockReturnThis(),
    zcard: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([
      [null, 0],                  // zremrangebyscore
      [null, 1],                  // zadd
      [null, currentCount + 1],   // zcard (count after adding)
      [null, 1],                  // expire
    ]),
  };

  return {
    multi: vi.fn().mockReturnValue(pipeline),
    zrem: vi.fn().mockResolvedValue(1),
    zrange: vi.fn().mockResolvedValue([
      'oldest-member',
      String(Date.now() - 30_000), // oldest entry 30s ago
    ]),
    _pipeline: pipeline,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Rate Limit Middleware (#98)', () => {
  // ── Config ──────────────────────────────────────────────────────

  describe('TIER_LIMITS config (P8)', () => {
    it('defines limits for all tiers', () => {
      expect(TIER_LIMITS.free).toBe(10);
      expect(TIER_LIMITS.starter).toBe(30);
      expect(TIER_LIMITS.pro).toBe(60);
      expect(TIER_LIMITS.business).toBe(120);
    });

    it('each tier limit is a positive integer', () => {
      for (const tier of Object.keys(TIER_LIMITS) as SubscriptionTier[]) {
        expect(TIER_LIMITS[tier]).toBeGreaterThan(0);
        expect(Number.isInteger(TIER_LIMITS[tier])).toBe(true);
      }
    });
  });

  // ── Key builder ─────────────────────────────────────────────────

  describe('rateLimitKey', () => {
    it('builds deterministic keys', () => {
      expect(rateLimitKey('u1', '/api/analyze')).toBe(
        'ratelimit:sliding:u1:/api/analyze',
      );
    });

    it('different users produce different keys', () => {
      expect(rateLimitKey('u1', '/x')).not.toBe(rateLimitKey('u2', '/x'));
    });

    it('different endpoints produce different keys', () => {
      expect(rateLimitKey('u1', '/a')).not.toBe(rateLimitKey('u1', '/b'));
    });
  });

  // ── checkRateLimit ──────────────────────────────────────────────

  describe('checkRateLimit', () => {
    it('allows requests under the limit', async () => {
      const redis = createMockRedis(5); // 5 existing → 6 after add ≤ 10 (free)
      const result = await checkRateLimit(redis as any, 'u1', '/api', 'free');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4); // 10 - 6
    });

    it('allows exactly at the limit', async () => {
      const redis = createMockRedis(9); // 9 existing → 10 after add = 10 (free)
      const result = await checkRateLimit(redis as any, 'u1', '/api', 'free');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
    });

    it('rejects requests exceeding the limit', async () => {
      const redis = createMockRedis(10); // 10 existing → 11 after add > 10 (free)
      const result = await checkRateLimit(redis as any, 'u1', '/api', 'free');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('removes ghost entry on rejection', async () => {
      const redis = createMockRedis(10);
      await checkRateLimit(redis as any, 'u1', '/api', 'free');
      expect(redis.zrem).toHaveBeenCalled();
    });

    it('uses correct tier limits for each tier', async () => {
      for (const tier of ['free', 'starter', 'pro', 'business'] as SubscriptionTier[]) {
        const limit = TIER_LIMITS[tier];
        // Under limit
        const redisOk = createMockRedis(limit - 2);
        const ok = await checkRateLimit(redisOk as any, 'u1', '/x', tier);
        expect(ok.allowed).toBe(true);
        expect(ok.limit).toBe(limit);

        // Over limit
        const redisOver = createMockRedis(limit);
        const over = await checkRateLimit(redisOver as any, 'u1', '/x', tier);
        expect(over.allowed).toBe(false);
        expect(over.limit).toBe(limit);
      }
    });

    it('calls Redis pipeline with correct operations', async () => {
      const redis = createMockRedis(0);
      await checkRateLimit(redis as any, 'u1', '/ep', 'free');

      expect(redis.multi).toHaveBeenCalled();
      expect(redis._pipeline.zremrangebyscore).toHaveBeenCalled();
      expect(redis._pipeline.zadd).toHaveBeenCalled();
      expect(redis._pipeline.zcard).toHaveBeenCalled();
      expect(redis._pipeline.expire).toHaveBeenCalled();
      expect(redis._pipeline.exec).toHaveBeenCalled();
    });

    it('degrades gracefully on Redis error (P5)', async () => {
      const redis = {
        multi: vi.fn(() => {
          throw new Error('connection refused');
        }),
      };
      const result = await checkRateLimit(redis as any, 'u1', '/api', 'free');
      expect(result.allowed).toBe(true); // allow through on failure
    });
  });

  // ── rateLimitHook ───────────────────────────────────────────────

  describe('rateLimitHook', () => {
    function mockReply() {
      const r: any = {
        statusCode: 200,
        body: null,
        headers: {} as Record<string, unknown>,
        code(c: number) { r.statusCode = c; return r; },
        send(body: any) { r.body = body; return r; },
        header(k: string, v: unknown) { r.headers[k] = v; return r; },
      };
      return r;
    }

    it('skips rate limiting for unauthenticated requests', async () => {
      const req = { user: null, url: '/healthz', routeOptions: undefined } as any;
      const reply = mockReply();
      await rateLimitHook(req, reply);
      expect(reply.statusCode).toBe(200); // no change
    });

    it('sets rate-limit headers on response', async () => {
      // Mock getRedis to return our mock — reimport needed
      const { getRedis } = await import('../../src/services/redis.js');
      const redis = createMockRedis(3);
      (getRedis as ReturnType<typeof vi.fn>).mockReturnValue(redis);

      const req = {
        user: { userId: 'u1', tier: 'pro' as const },
        url: '/api/analyze',
        routeOptions: { url: '/api/analyze' },
      } as any;
      const reply = mockReply();
      await rateLimitHook(req, reply);

      expect(reply.headers['X-RateLimit-Limit']).toBe(60);
      expect(reply.headers['X-RateLimit-Remaining']).toBeGreaterThanOrEqual(0);
    });
  });
});

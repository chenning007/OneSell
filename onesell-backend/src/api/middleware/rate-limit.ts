/**
 * Redis-backed Rate Limiting — sliding window via sorted sets.
 *
 * Tier-based limits (P8: config-driven, not hardcoded):
 *   Free=10/min, Starter=30/min, Pro=60/min, Business=120/min
 *
 * P5: Graceful Degradation — Redis errors allow the request through.
 *
 * Closes #98
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type Redis from 'ioredis';
import type { SubscriptionTier } from './auth.js';
import { getRedis } from '../../services/redis.js';

// ── Tier config (P8: configurable, not hardcoded) ───────────────────

export const TIER_LIMITS: Record<SubscriptionTier, number> = {
  free: 10,
  starter: 30,
  pro: 60,
  business: 120,
};

const WINDOW_MS = 60_000; // 1 minute

// ── Types ───────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterMs: number;
}

// ── Key builder ─────────────────────────────────────────────────────

export function rateLimitKey(userId: string, endpoint: string): string {
  return `ratelimit:sliding:${userId}:${endpoint}`;
}

// ── Core logic (accepts Redis for testability) ──────────────────────

export async function checkRateLimit(
  redis: Redis,
  userId: string,
  endpoint: string,
  tier: SubscriptionTier,
): Promise<RateLimitResult> {
  const limit = TIER_LIMITS[tier];
  const key = rateLimitKey(userId, endpoint);
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const member = `${now}:${Math.random().toString(36).slice(2, 8)}`;

  try {
    const pipeline = redis.multi();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, now.toString(), member);
    pipeline.zcard(key);
    pipeline.expire(key, Math.ceil(WINDOW_MS / 1000));
    const results = await pipeline.exec();

    const count = (results?.[2]?.[1] as number) ?? 0;

    if (count > limit) {
      // Remove the entry we just added — request is rejected
      await redis.zrem(key, member);

      // Compute retry-after from the oldest entry in the window
      const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const oldestTs = oldest.length >= 2 ? parseInt(oldest[1], 10) : now;
      const retryAfterMs = Math.max(oldestTs + WINDOW_MS - now, 1000);

      return { allowed: false, limit, remaining: 0, retryAfterMs };
    }

    return { allowed: true, limit, remaining: limit - count, retryAfterMs: 0 };
  } catch (err) {
    // P5: degrade gracefully — allow the request on Redis failure
    console.error('[RateLimit] Redis error (degraded):', (err as Error).message);
    return { allowed: true, limit, remaining: limit, retryAfterMs: 0 };
  }
}

// ── Pre-handler hook ────────────────────────────────────────────────

export async function rateLimitHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = request.user;
  if (!user) return; // unauthenticated routes bypass rate limiting

  const endpoint = request.routeOptions?.url ?? request.url;
  const result = await checkRateLimit(getRedis(), user.userId, endpoint, user.tier);

  reply.header('X-RateLimit-Limit', result.limit);
  reply.header('X-RateLimit-Remaining', Math.max(result.remaining, 0));

  if (!result.allowed) {
    const retryAfterSec = Math.ceil(result.retryAfterMs / 1000);
    reply.header('Retry-After', retryAfterSec);
    reply.code(429).send({
      error: 'Too many requests',
      retryAfter: retryAfterSec,
    });
  }
}

// ── Fastify plugin ──────────────────────────────────────────────────

export async function rateLimitPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('preHandler', rateLimitHook);
}

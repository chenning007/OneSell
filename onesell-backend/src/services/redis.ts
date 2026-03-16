/**
 * Redis session store helpers — ARCHITECTURE §8.2.
 *
 * All ephemeral session data (payload, status, results) lives in Redis
 * with TTL-based auto-purge. PostgreSQL stores only metadata and saved products.
 *
 * P5: Graceful Degradation — Redis errors are logged, never crash the service.
 *
 * Closes #94
 */

import Redis from 'ioredis';
import { env } from '../env.js';

// ── TTL constants (seconds) ─────────────────────────────────────────

const TTL = {
  payload: 3600,         // 1 hour
  status: 7200,          // 2 hours
  results: 3600,         // 1 hour
  marketConfig: 21600,   // 6 hours
  feeCache: 86400,       // 24 hours
  exchangeRate: 86400,   // 24 hours
} as const;

// ── Redis client ────────────────────────────────────────────────────

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 5) return null; // stop retrying after 5 attempts
        return Math.min(times * 200, 2000);
      },
    });
    redis.on('error', (err) => {
      console.error('[Redis] Connection error (degraded mode):', err.message);
    });
  }
  return redis;
}

// ── Safe JSON helpers ───────────────────────────────────────────────

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ── Key builders ────────────────────────────────────────────────────

const keys = {
  payload: (sessionId: string) => `session:${sessionId}:payload`,
  status: (sessionId: string) => `session:${sessionId}:status`,
  results: (sessionId: string) => `session:${sessionId}:results`,
  rateLimit: (userId: string, weekISO: string) => `ratelimit:${userId}:${weekISO}`,
  marketConfig: (market: string) => `market:config:${market}`,
  feeCache: (market: string, platform: string) => `market:fees:${market}:${platform}`,
  exchangeRate: (from: string, to: string, date: string) => `exchange-rate:${from}:${to}:${date}`,
} as const;

export { keys as redisKeys };

// ── Session payload ─────────────────────────────────────────────────

export async function storePayload(sessionId: string, payload: unknown): Promise<boolean> {
  try {
    const r = getRedis();
    await r.set(keys.payload(sessionId), JSON.stringify(payload), 'EX', TTL.payload);
    return true;
  } catch (err) {
    console.error('[Redis] storePayload failed (degraded):', (err as Error).message);
    return false;
  }
}

export async function getPayload<T = unknown>(sessionId: string): Promise<T | null> {
  try {
    const r = getRedis();
    const raw = await r.get(keys.payload(sessionId));
    return safeJsonParse<T>(raw);
  } catch (err) {
    console.error('[Redis] getPayload failed (degraded):', (err as Error).message);
    return null;
  }
}

// ── Session status ──────────────────────────────────────────────────

export interface SessionStatus {
  status: 'pending' | 'planning' | 'executing' | 'synthesizing' | 'complete' | 'error';
  step?: string;
  message?: string;
  updatedAt: string;
}

export async function setStatus(sessionId: string, status: SessionStatus): Promise<boolean> {
  try {
    const r = getRedis();
    await r.set(keys.status(sessionId), JSON.stringify(status), 'EX', TTL.status);
    return true;
  } catch (err) {
    console.error('[Redis] setStatus failed (degraded):', (err as Error).message);
    return false;
  }
}

export async function getStatus(sessionId: string): Promise<SessionStatus | null> {
  try {
    const r = getRedis();
    const raw = await r.get(keys.status(sessionId));
    return safeJsonParse<SessionStatus>(raw);
  } catch (err) {
    console.error('[Redis] getStatus failed (degraded):', (err as Error).message);
    return null;
  }
}

// ── Session results ─────────────────────────────────────────────────

export async function storeResults(sessionId: string, results: unknown): Promise<boolean> {
  try {
    const r = getRedis();
    await r.set(keys.results(sessionId), JSON.stringify(results), 'EX', TTL.results);
    return true;
  } catch (err) {
    console.error('[Redis] storeResults failed (degraded):', (err as Error).message);
    return false;
  }
}

export async function getResults<T = unknown>(sessionId: string): Promise<T | null> {
  try {
    const r = getRedis();
    const raw = await r.get(keys.results(sessionId));
    return safeJsonParse<T>(raw);
  } catch (err) {
    console.error('[Redis] getResults failed (degraded):', (err as Error).message);
    return null;
  }
}

// ── Rate limiting ───────────────────────────────────────────────────

/**
 * Get the ISO week string for rate-limit keys.
 * Format: "2026-W12"
 */
export function getISOWeek(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export async function incrementRateLimit(userId: string): Promise<number> {
  try {
    const r = getRedis();
    const key = keys.rateLimit(userId, getISOWeek());
    const count = await r.incr(key);
    // Auto-expire at end of week (max 7 days from now)
    if (count === 1) {
      await r.expire(key, 7 * 86400);
    }
    return count;
  } catch (err) {
    console.error('[Redis] incrementRateLimit failed (degraded):', (err as Error).message);
    return 0; // allow through on Redis failure (P5)
  }
}

export async function getRateLimitCount(userId: string): Promise<number> {
  try {
    const r = getRedis();
    const raw = await r.get(keys.rateLimit(userId, getISOWeek()));
    return raw ? parseInt(raw, 10) : 0;
  } catch (err) {
    console.error('[Redis] getRateLimitCount failed (degraded):', (err as Error).message);
    return 0;
  }
}

// ── Cache helpers ───────────────────────────────────────────────────

export async function cacheMarketConfig(market: string, config: unknown): Promise<boolean> {
  try {
    const r = getRedis();
    await r.set(keys.marketConfig(market), JSON.stringify(config), 'EX', TTL.marketConfig);
    return true;
  } catch (err) {
    console.error('[Redis] cacheMarketConfig failed:', (err as Error).message);
    return false;
  }
}

export async function getCachedMarketConfig<T = unknown>(market: string): Promise<T | null> {
  try {
    const r = getRedis();
    const raw = await r.get(keys.marketConfig(market));
    return safeJsonParse<T>(raw);
  } catch (err) {
    console.error('[Redis] getCachedMarketConfig failed:', (err as Error).message);
    return null;
  }
}

export async function cacheFeeStructure(market: string, platform: string, fees: unknown): Promise<boolean> {
  try {
    const r = getRedis();
    await r.set(keys.feeCache(market, platform), JSON.stringify(fees), 'EX', TTL.feeCache);
    return true;
  } catch (err) {
    console.error('[Redis] cacheFeeStructure failed:', (err as Error).message);
    return false;
  }
}

export async function getCachedFeeStructure<T = unknown>(market: string, platform: string): Promise<T | null> {
  try {
    const r = getRedis();
    const raw = await r.get(keys.feeCache(market, platform));
    return safeJsonParse<T>(raw);
  } catch (err) {
    console.error('[Redis] getCachedFeeStructure failed:', (err as Error).message);
    return null;
  }
}

export async function cacheExchangeRate(from: string, to: string, rate: number): Promise<boolean> {
  try {
    const r = getRedis();
    const date = new Date().toISOString().slice(0, 10);
    await r.set(keys.exchangeRate(from, to, date), String(rate), 'EX', TTL.exchangeRate);
    return true;
  } catch (err) {
    console.error('[Redis] cacheExchangeRate failed:', (err as Error).message);
    return false;
  }
}

export async function getCachedExchangeRate(from: string, to: string): Promise<number | null> {
  try {
    const r = getRedis();
    const date = new Date().toISOString().slice(0, 10);
    const raw = await r.get(keys.exchangeRate(from, to, date));
    if (!raw) return null;
    const rate = parseFloat(raw);
    return Number.isFinite(rate) ? rate : null;
  } catch (err) {
    console.error('[Redis] getCachedExchangeRate failed:', (err as Error).message);
    return null;
  }
}

// ── Cleanup ─────────────────────────────────────────────────────────

export async function disconnectRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

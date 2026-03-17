/**
 * Redis Data Purge Job — Safety-net for PRD §9 data retention requirement.
 *
 * Redis TTLs (1h payload, 1h results, 2h status) handle the primary purge.
 * This background job runs every 15 minutes as defense-in-depth, scanning
 * for any session keys that somehow survived past their TTL.
 *
 * Raw extracted data is NEVER written to PostgreSQL (enforced by schema design).
 *
 * Closes #58
 */

import type Redis from 'ioredis';
import { getRedis } from './redis.js';

// ── Constants ───────────────────────────────────────────────────────

const PURGE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_AGE_SECONDS = 3600; // 1 hour — matches PRD §9

// Session key prefixes that hold raw extracted data
const SESSION_KEY_PREFIXES = [
  'session:*:payload',
  'session:*:results',
  'session:*:status',
];

// ── Purge logic ─────────────────────────────────────────────────────

/**
 * Scans for session keys missing a TTL (TTL = -1 means no expiry set)
 * and sets a 1-hour TTL as a safety net.
 * Returns the number of keys fixed.
 */
export async function purgeExpiredSessionData(redis: Redis): Promise<number> {
  let fixedCount = 0;

  for (const pattern of SESSION_KEY_PREFIXES) {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor, 'MATCH', pattern, 'COUNT', 100,
      );
      cursor = nextCursor;

      for (const key of keys) {
        const ttl = await redis.ttl(key);
        if (ttl === -1) {
          // Key exists but has no TTL — set safety-net TTL
          await redis.expire(key, MAX_AGE_SECONDS);
          fixedCount++;
          console.warn(`[PurgeJob] Set safety-net TTL on orphaned key: ${key}`);
        }
      }
    } while (cursor !== '0');
  }

  return fixedCount;
}

// ── Background runner ───────────────────────────────────────────────

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startPurgeJob(): void {
  if (intervalId) return; // already running

  console.log('[PurgeJob] Starting data purge job (every 15 min)');

  // Run immediately on start
  runPurge();

  intervalId = setInterval(runPurge, PURGE_INTERVAL_MS);
}

export function stopPurgeJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[PurgeJob] Stopped data purge job');
  }
}

async function runPurge(): Promise<void> {
  try {
    const redis = getRedis();
    const fixed = await purgeExpiredSessionData(redis);
    if (fixed > 0) {
      console.log(`[PurgeJob] Fixed ${fixed} key(s) missing TTL`);
    }
  } catch (err) {
    // P5: Never crash the server due to purge failure
    console.error('[PurgeJob] Error during purge (non-fatal):', (err as Error).message);
  }
}

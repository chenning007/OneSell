/**
 * Tier Enforcement Middleware — weekly analysis limits & feature gating.
 *
 * PRD §10:
 *   Free    → 1 analysis/week, top 3 results, no drill-down
 *   Starter → 5 analyses/week, full 10 results, basic drill-down
 *   Pro     → Unlimited, full drill-down, margin calc, supplier links, CSV
 *   Business→ Everything in Pro + API access + team sharing
 *
 * All enforcement is server-side (P4: Security-First).
 *
 * Closes #63
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { sql, and, gte, eq } from 'drizzle-orm';
import type { SubscriptionTier } from './auth.js';
import { db } from '../../db/index.js';
import { analysisSessions } from '../../db/schema.js';

// ── Tier config ─────────────────────────────────────────────────────

/** Maximum analyses per ISO week per tier. Infinity = unlimited. */
export const TIER_ANALYSIS_LIMITS: Record<SubscriptionTier, number> = {
  free: 1,
  starter: 5,
  pro: Infinity,
  business: Infinity,
};

/** Maximum result cards returned per tier. */
export const TIER_RESULT_LIMITS: Record<SubscriptionTier, number> = {
  free: 3,
  starter: 10,
  pro: 10,
  business: 10,
};

/** Feature access by tier. */
export const TIER_FEATURES: Record<SubscriptionTier, {
  drillDown: boolean;
  marginCalculator: boolean;
  supplierLinks: boolean;
  csvExport: boolean;
  apiAccess: boolean;
  teamSharing: boolean;
}> = {
  free: { drillDown: false, marginCalculator: false, supplierLinks: false, csvExport: false, apiAccess: false, teamSharing: false },
  starter: { drillDown: true, marginCalculator: false, supplierLinks: false, csvExport: false, apiAccess: false, teamSharing: false },
  pro: { drillDown: true, marginCalculator: true, supplierLinks: true, csvExport: true, apiAccess: false, teamSharing: false },
  business: { drillDown: true, marginCalculator: true, supplierLinks: true, csvExport: true, apiAccess: true, teamSharing: true },
};

// ── Helpers ─────────────────────────────────────────────────────────

/** Returns the Monday 00:00 UTC of the current ISO week. */
export function getIsoWeekStart(): Date {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diff));
  return monday;
}

/** Count how many analyses a user has submitted this ISO week. */
export async function getWeeklyAnalysisCount(userId: string): Promise<number> {
  const weekStart = getIsoWeekStart();
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(analysisSessions)
    .where(
      and(
        eq(analysisSessions.userId, userId),
        gte(analysisSessions.createdAt, weekStart),
      ),
    );
  return rows[0]?.count ?? 0;
}

// ── Pre-handler: analysis limit ─────────────────────────────────────

/**
 * Blocks analysis submission when the user has exceeded their
 * weekly quota. Returns 402 with upgrade metadata.
 */
export async function analysisLimitHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const user = request.user;
  if (!user) return; // unauthenticated routes handled elsewhere

  const limit = TIER_ANALYSIS_LIMITS[user.tier];
  if (limit === Infinity) return; // unlimited tiers pass through

  const count = await getWeeklyAnalysisCount(user.userId);
  if (count >= limit) {
    reply.code(402).send({
      error: 'Analysis limit reached',
      upgradeRequired: true,
      currentTier: user.tier,
      weeklyLimit: limit,
      weeklyUsed: count,
    });
  }
}

// ── Pre-handler factory: feature gate ───────────────────────────────

type FeatureKey = keyof typeof TIER_FEATURES.free;

/**
 * Returns a pre-handler that blocks access when the user's tier
 * does not include the requested feature. Returns 402.
 */
export function featureGateHook(feature: FeatureKey) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = request.user;
    if (!user) return;

    const features = TIER_FEATURES[user.tier];
    if (!features[feature]) {
      reply.code(402).send({
        error: `Feature '${feature}' requires a higher subscription tier`,
        upgradeRequired: true,
        currentTier: user.tier,
        requiredFeature: feature,
      });
    }
  };
}

// ── Result truncation helper ────────────────────────────────────────

/**
 * Truncates an analysis result's `rankedProducts` array to the
 * tier's maximum visible cards.
 */
export function truncateResults<T extends { rankedProducts?: unknown[] }>(
  results: T,
  tier: SubscriptionTier,
): T {
  const limit = TIER_RESULT_LIMITS[tier];
  if (!results.rankedProducts || results.rankedProducts.length <= limit) {
    return results;
  }
  return {
    ...results,
    rankedProducts: results.rankedProducts.slice(0, limit),
    totalResults: results.rankedProducts.length,
    visibleResults: limit,
    truncated: true,
  };
}

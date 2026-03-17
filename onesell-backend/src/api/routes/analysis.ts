/**
 * Analysis routes — submit, poll status, retrieve results.
 *
 * P4: Security-First — auth required, user isolation via Redis ownership key.
 * P9: All input validated through Zod.
 *
 * Closes #136
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { authHook } from '../middleware/auth.js';
import { analysisLimitHook, truncateResults, featureGateHook } from '../middleware/tier-enforcement.js';
import { validateBody } from '../middleware/validation.js';
import { getRedis } from '../../services/redis.js';
import { db } from '../../db/index.js';
import { analysisSessions } from '../../db/schema.js';
import type { AgentService, AnalysisResult } from '../../services/agent/agent-service.js';
import type { ExtractionDataSource, UserPreferences } from '../../services/agent/planner-agent.js';
import type { MarketId } from '../../services/agent/tools/types.js';

// ── Zod schemas ─────────────────────────────────────────────────────

const extractionDataSchema = z.object({
  platformId: z.string().min(1).max(64),
  available: z.boolean(),
  data: z.unknown().optional(),
});

const preferencesSchema = z.object({
  budget: z.number().positive().optional(),
  preferredPlatforms: z.array(z.string().min(1)).optional(),
  categories: z.array(z.string().min(1)).optional(),
  riskTolerance: z.enum(['low', 'medium', 'high']).optional(),
  fulfillmentPreference: z.string().optional(),
});

const marketIdSchema = z.enum(['us', 'cn', 'uk', 'de', 'jp', 'sea', 'au']);

const submitAnalysisSchema = z.object({
  extractionData: z.array(extractionDataSchema).min(1),
  preferences: preferencesSchema,
  marketId: marketIdSchema,
});

// ── Redis key helpers ───────────────────────────────────────────────

const OWNER_TTL = 7200; // 2 hours — matches status TTL

function ownerKey(analysisId: string): string {
  return `analysis:${analysisId}:owner`;
}

// ── Plugin options ──────────────────────────────────────────────────

export interface AnalysisRoutesOptions {
  agentService: AgentService;
}

// ── Plugin ──────────────────────────────────────────────────────────

export async function analysisRoutes(
  fastify: FastifyInstance,
  opts: AnalysisRoutesOptions,
): Promise<void> {
  const { agentService } = opts;

  // ── POST /analysis ────────────────────────────────────────────

  fastify.post(
    '/',
    { preHandler: [authHook, validateBody(submitAnalysisSchema), analysisLimitHook] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const { extractionData, preferences, marketId } = request.body as z.infer<typeof submitAnalysisSchema>;

      const analysisId = randomUUID();

      // Store ownership in Redis
      const redis = getRedis();
      await redis.set(ownerKey(analysisId), userId, 'EX', OWNER_TTL);

      // Record analysis session in DB for weekly count tracking
      await db.insert(analysisSessions).values({
        id: analysisId,
        userId,
        market: marketId,
        status: 'pending',
        platformsUsed: extractionData.map((d) => d.platformId),
      });

      // Fire-and-forget — analysis runs in the background
      const market = { marketId: marketId as MarketId, language: 'en', currency: 'USD', platforms: [] };
      agentService
        .analyze(
          analysisId,
          extractionData as ExtractionDataSource[],
          preferences as UserPreferences,
          market,
        )
        .catch((err) => {
          fastify.log.error({ analysisId, err }, 'Background analysis failed');
        });

      return reply.code(202).send({ analysisId, status: 'pending' });
    },
  );

  // ── GET /analysis/:analysisId/status ──────────────────────────

  fastify.get<{ Params: { analysisId: string } }>(
    '/:analysisId/status',
    { preHandler: [authHook] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const { analysisId } = request.params;

      // User isolation check
      const redis = getRedis();
      const owner = await redis.get(ownerKey(analysisId));
      if (!owner) {
        return reply.code(404).send({ error: 'Analysis not found' });
      }
      if (owner !== userId) {
        return reply.code(404).send({ error: 'Analysis not found' });
      }

      const raw = await redis.get(`session:${analysisId}:status`);
      if (!raw) {
        return reply.send({ analysisId, status: 'pending' });
      }

      const status = JSON.parse(raw) as { status: string; message?: string };
      return reply.send({ analysisId, status: status.status, message: status.message });
    },
  );

  // ── GET /analysis/:analysisId/results ─────────────────────────

  fastify.get<{ Params: { analysisId: string } }>(
    '/:analysisId/results',
    { preHandler: [authHook] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const { analysisId } = request.params;

      // User isolation check
      const redis = getRedis();
      const owner = await redis.get(ownerKey(analysisId));
      if (!owner) {
        return reply.code(404).send({ error: 'Analysis not found' });
      }
      if (owner !== userId) {
        return reply.code(404).send({ error: 'Analysis not found' });
      }

      // Check status first
      const statusRaw = await redis.get(`session:${analysisId}:status`);
      if (!statusRaw) {
        return reply.code(202).send({ analysisId, status: 'pending', message: 'Analysis in progress' });
      }

      const status = JSON.parse(statusRaw) as { status: string };
      if (status.status !== 'complete' && status.status !== 'error') {
        return reply.code(202).send({ analysisId, status: status.status, message: 'Analysis in progress' });
      }

      const resultsRaw = await redis.get(`session:${analysisId}:results`);
      if (!resultsRaw) {
        return reply.code(404).send({ error: 'Results not found' });
      }

      const results = JSON.parse(resultsRaw) as AnalysisResult;
      const tier = request.user!.tier;
      const truncated = truncateResults(results, tier);
      return reply.send({ analysisId, status: truncated.status, results: truncated });
    },
  );

  // ── GET /analysis/:analysisId/drilldown ───────────────────────

  fastify.get<{ Params: { analysisId: string } }>(
    '/:analysisId/drilldown',
    { preHandler: [authHook, featureGateHook('drillDown')] },
    async (request, reply) => {
      const userId = request.user!.userId;
      const { analysisId } = request.params;

      // User isolation check
      const redis = getRedis();
      const owner = await redis.get(ownerKey(analysisId));
      if (!owner || owner !== userId) {
        return reply.code(404).send({ error: 'Analysis not found' });
      }

      const resultsRaw = await redis.get(`session:${analysisId}:results`);
      if (!resultsRaw) {
        return reply.code(404).send({ error: 'Results not found' });
      }

      const results = JSON.parse(resultsRaw) as AnalysisResult;
      return reply.send({ analysisId, drilldown: results });
    },
  );
}

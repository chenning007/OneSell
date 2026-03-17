/**
 * User routes — preferences and saved product lists.
 *
 * All endpoints require auth. User isolation enforced by JWT userId (P9).
 * All DB queries via Drizzle ORM — no raw SQL.
 *
 * Closes #104
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, userPreferences, savedProducts, analysisSessions } from '../../db/schema.js';
import { authHook } from '../middleware/auth.js';

// ── Zod schemas ─────────────────────────────────────────────────────

const updatePreferencesSchema = z.object({
  market: z.string().min(1).max(10),
  budgetLocal: z.string().optional(),
  preferredPlatforms: z.array(z.string()).optional(),
  productType: z.string().max(20).optional(),
  categories: z.array(z.string()).optional(),
  timeAvailability: z.string().max(20).optional(),
});

const addSavedProductSchema = z.object({
  sessionId: z.string().uuid(),
  market: z.string().min(1).max(10),
  productName: z.string().min(1).max(500),
  overallScore: z.number().int().min(0).max(100),
  cardData: z.record(z.unknown()),
});

// ── Plugin ──────────────────────────────────────────────────────────

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes in this plugin require auth
  fastify.addHook('preHandler', authHook);

  // ── GET /user/preferences ───────────────────────────────────────

  fastify.get('/preferences', async (request, reply) => {
    const userId = request.user!.userId;

    // Verify user exists
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    const prefs = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));

    return reply.send({ preferences: prefs });
  });

  // ── PUT /user/preferences ───────────────────────────────────────

  fastify.put('/preferences', async (request, reply) => {
    const userId = request.user!.userId;

    const parsed = updatePreferencesSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    // Verify user exists
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    const { market, budgetLocal, preferredPlatforms, productType, categories, timeAvailability } = parsed.data;

    // Upsert: insert or update preferences for this user+market
    const existing = await db
      .select({ id: userPreferences.id })
      .from(userPreferences)
      .where(and(eq(userPreferences.userId, userId), eq(userPreferences.market, market)))
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(userPreferences)
        .set({
          budgetLocal: budgetLocal ?? null,
          preferredPlatforms: preferredPlatforms ?? [],
          productType: productType ?? null,
          categories: categories ?? [],
          timeAvailability: timeAvailability ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(userPreferences.userId, userId), eq(userPreferences.market, market)))
        .returning();

      return reply.send({ preference: updated });
    }

    const [created] = await db
      .insert(userPreferences)
      .values({
        userId,
        market,
        budgetLocal: budgetLocal ?? null,
        preferredPlatforms: preferredPlatforms ?? [],
        productType: productType ?? null,
        categories: categories ?? [],
        timeAvailability: timeAvailability ?? null,
      })
      .returning();

    return reply.code(201).send({ preference: created });
  });

  // ── GET /user/saved-lists ───────────────────────────────────────

  fastify.get('/saved-lists', async (request, reply) => {
    const userId = request.user!.userId;

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    const items = await db
      .select()
      .from(savedProducts)
      .where(eq(savedProducts.userId, userId))
      .orderBy(desc(savedProducts.createdAt));

    return reply.send({ savedProducts: items });
  });

  // ── POST /user/saved-lists ──────────────────────────────────────

  fastify.post('/saved-lists', async (request, reply) => {
    const userId = request.user!.userId;

    const parsed = addSavedProductSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    // Verify user exists
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return reply.code(404).send({ error: 'User not found' });
    }

    // Verify session belongs to this user
    const [session] = await db
      .select({ id: analysisSessions.id })
      .from(analysisSessions)
      .where(and(eq(analysisSessions.id, parsed.data.sessionId), eq(analysisSessions.userId, userId)))
      .limit(1);

    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    const { sessionId, market, productName, overallScore, cardData } = parsed.data;

    const [created] = await db
      .insert(savedProducts)
      .values({ userId, sessionId, market, productName, overallScore, cardData })
      .returning();

    return reply.code(201).send({ savedProduct: created });
  });
}

/**
 * Auth routes — register, login, refresh.
 *
 * P4: Security-First — bcrypt hashing, rate limiting, Zod validation.
 * P9: All DB queries via Drizzle ORM, parameterized.
 *
 * Closes #102
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  type SubscriptionTier,
  type RefreshTokenPayload,
} from '../middleware/auth.js';

// ── Zod schemas ─────────────────────────────────────────────────────

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ── Login rate limiter (in-memory, per-email) ───────────────────────

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const loginAttempts = new Map<string, RateLimitEntry>();
const LOGIN_RATE_WINDOW_MS = 60_000; // 1 minute
const LOGIN_RATE_MAX = 5;

function checkLoginRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(email);

  if (!entry || now >= entry.resetAt) {
    loginAttempts.set(email, { count: 1, resetAt: now + LOGIN_RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= LOGIN_RATE_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// Exported for testing
export { loginAttempts, checkLoginRateLimit };

const BCRYPT_ROUNDS = 12;

// ── Plugin ──────────────────────────────────────────────────────────

export async function authRoutes(fastify: FastifyInstance): Promise<void> {

  // ── POST /auth/register ─────────────────────────────────────────

  fastify.post('/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Check for duplicate email
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      return reply.code(409).send({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const [newUser] = await db
      .insert(users)
      .values({ email: normalizedEmail, passwordHash })
      .returning({ id: users.id, tier: users.tier });

    const accessToken = generateAccessToken(newUser.id, newUser.tier as SubscriptionTier);
    const refreshToken = generateRefreshToken(newUser.id);

    return reply.code(201).send({ accessToken, refreshToken });
  });

  // ── POST /auth/login ────────────────────────────────────────────

  fastify.post('/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Rate limit check
    if (!checkLoginRateLimit(normalizedEmail)) {
      return reply.code(429).send({ error: 'Too many login attempts. Try again later.' });
    }

    const [user] = await db
      .select({
        id: users.id,
        passwordHash: users.passwordHash,
        tier: users.tier,
      })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: 'Invalid email or password' });
    }

    const accessToken = generateAccessToken(user.id, user.tier as SubscriptionTier);
    const refreshToken = generateRefreshToken(user.id);

    return reply.code(200).send({ accessToken, refreshToken });
  });

  // ── POST /auth/refresh ──────────────────────────────────────────

  fastify.post('/refresh', async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { refreshToken } = parsed.data;

    let payload: RefreshTokenPayload;
    try {
      const decoded = verifyToken(refreshToken);
      if (decoded.type !== 'refresh') {
        return reply.code(401).send({ error: 'Invalid token type' });
      }
      payload = decoded as RefreshTokenPayload;
    } catch {
      return reply.code(401).send({ error: 'Invalid or expired refresh token' });
    }

    // Verify user still exists
    const [user] = await db
      .select({ id: users.id, tier: users.tier })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user) {
      return reply.code(401).send({ error: 'User not found' });
    }

    // Token rotation: issue a fresh pair
    const newAccessToken = generateAccessToken(user.id, user.tier as SubscriptionTier);
    const newRefreshToken = generateRefreshToken(user.id);

    return reply.code(200).send({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  });
}

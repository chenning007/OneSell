/**
 * JWT Authentication Middleware — RS256.
 *
 * Access tokens: 15-minute expiry.
 * Refresh tokens: 7-day expiry (rotation handled at the route level).
 *
 * P4: Security-First — never log token values, validate all claims.
 *
 * Closes #96
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../../env.js';

// ── Types ───────────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'starter' | 'pro' | 'business';

export interface AccessTokenPayload {
  sub: string;
  tier: SubscriptionTier;
  type: 'access';
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
  iat: number;
  exp: number;
}

export interface AuthUser {
  userId: string;
  tier: SubscriptionTier;
}

// ── Fastify augmentation ────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyRequest {
    user: AuthUser | null;
  }
}

// ── Constants ───────────────────────────────────────────────────────

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const ALGORITHM = 'RS256' as const;

// ── Token helpers ───────────────────────────────────────────────────

export function generateAccessToken(userId: string, tier: SubscriptionTier): string {
  return jwt.sign(
    { sub: userId, tier, type: 'access' },
    env.JWT_PRIVATE_KEY,
    { algorithm: ALGORITHM, expiresIn: ACCESS_TOKEN_EXPIRY },
  );
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { sub: userId, type: 'refresh' },
    env.JWT_PRIVATE_KEY,
    { algorithm: ALGORITHM, expiresIn: REFRESH_TOKEN_EXPIRY },
  );
}

export function verifyToken(token: string): AccessTokenPayload | RefreshTokenPayload {
  const payload = jwt.verify(token, env.JWT_PUBLIC_KEY, {
    algorithms: [ALGORITHM],
  });
  return payload as AccessTokenPayload | RefreshTokenPayload;
}

// ── Pre-handler hook (attach to individual routes) ──────────────────

export async function authHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  if (!token) {
    reply.code(401).send({ error: 'Missing token' });
    return;
  }

  try {
    const payload = verifyToken(token);

    if (payload.type !== 'access') {
      reply.code(401).send({ error: 'Invalid token type' });
      return;
    }

    const access = payload as AccessTokenPayload;
    request.user = { userId: access.sub, tier: access.tier };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      reply.code(401).send({ error: 'Token expired' });
      return;
    }
    // Covers JsonWebTokenError, NotBeforeError, malformed tokens
    reply.code(401).send({ error: 'Invalid token' });
  }
}

// ── Fastify plugin (protects all routes in its registration scope) ──

export async function authPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.decorateRequest('user', null);
  fastify.addHook('preHandler', authHook);
}

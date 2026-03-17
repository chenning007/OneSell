/**
 * Unit tests for JWT auth middleware (#96).
 * Tests token generation, verification, expiry, and malformed tokens.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';

// ── Generate RSA keypairs via vi.hoisted (runs before mock factory) ──

const { testKeys, wrongKeys } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('node:crypto');
  const make = () => {
    const pair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    return { privateKey: pair.privateKey as string, publicKey: pair.publicKey as string };
  };
  return { testKeys: make(), wrongKeys: make() };
});

// ── Mock env with real RSA keys ─────────────────────────────────────

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

import jwt from 'jsonwebtoken';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  authHook,
  type SubscriptionTier,
  type AccessTokenPayload,
  type RefreshTokenPayload,
} from '../../src/api/middleware/auth.js';

// ── Helpers ─────────────────────────────────────────────────────────

function mockRequest(authHeader?: string) {
  return {
    headers: { authorization: authHeader },
    user: null,
  } as any;
}

function mockReply() {
  const reply: any = {
    statusCode: 200,
    body: null,
    headers: {} as Record<string, string>,
    code(c: number) { reply.statusCode = c; return reply; },
    send(body: any) { reply.body = body; return reply; },
    header(k: string, v: string) { reply.headers[k] = v; return reply; },
  };
  return reply;
}

// ── Tests ───────────────────────────────────────────────────────────

describe('JWT Auth Middleware (#96)', () => {
  // ── generateAccessToken ─────────────────────────────────────────

  describe('generateAccessToken', () => {
    it('produces a valid JWT string', () => {
      const token = generateAccessToken('user-1', 'pro');
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('contains correct claims', () => {
      const token = generateAccessToken('user-1', 'starter');
      const decoded = jwt.decode(token) as AccessTokenPayload;
      expect(decoded.sub).toBe('user-1');
      expect(decoded.tier).toBe('starter');
      expect(decoded.type).toBe('access');
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    it('sets 15-minute expiry', () => {
      const token = generateAccessToken('user-1', 'free');
      const decoded = jwt.decode(token) as AccessTokenPayload;
      const diff = decoded.exp - decoded.iat;
      expect(diff).toBe(15 * 60);
    });

    it('uses RS256 algorithm', () => {
      const token = generateAccessToken('user-1', 'business');
      const header = JSON.parse(
        Buffer.from(token.split('.')[0], 'base64url').toString(),
      );
      expect(header.alg).toBe('RS256');
    });

    it('works for all subscription tiers', () => {
      const tiers: SubscriptionTier[] = ['free', 'starter', 'pro', 'business'];
      for (const tier of tiers) {
        const token = generateAccessToken('user-1', tier);
        const decoded = jwt.decode(token) as AccessTokenPayload;
        expect(decoded.tier).toBe(tier);
      }
    });
  });

  // ── generateRefreshToken ────────────────────────────────────────

  describe('generateRefreshToken', () => {
    it('produces a valid JWT string', () => {
      const token = generateRefreshToken('user-2');
      expect(token.split('.')).toHaveLength(3);
    });

    it('contains correct claims (type=refresh, no tier)', () => {
      const token = generateRefreshToken('user-2');
      const decoded = jwt.decode(token) as RefreshTokenPayload;
      expect(decoded.sub).toBe('user-2');
      expect(decoded.type).toBe('refresh');
      expect((decoded as any).tier).toBeUndefined();
    });

    it('sets 7-day expiry', () => {
      const token = generateRefreshToken('user-2');
      const decoded = jwt.decode(token) as RefreshTokenPayload;
      const diff = decoded.exp - decoded.iat;
      expect(diff).toBe(7 * 24 * 60 * 60);
    });
  });

  // ── verifyToken ─────────────────────────────────────────────────

  describe('verifyToken', () => {
    it('verifies a valid access token', () => {
      const token = generateAccessToken('user-3', 'pro');
      const payload = verifyToken(token) as AccessTokenPayload;
      expect(payload.sub).toBe('user-3');
      expect(payload.tier).toBe('pro');
      expect(payload.type).toBe('access');
    });

    it('verifies a valid refresh token', () => {
      const token = generateRefreshToken('user-4');
      const payload = verifyToken(token) as RefreshTokenPayload;
      expect(payload.sub).toBe('user-4');
      expect(payload.type).toBe('refresh');
    });

    it('rejects expired tokens', () => {
      const token = jwt.sign(
        { sub: 'user-5', tier: 'free', type: 'access' },
        testKeys.privateKey,
        { algorithm: 'RS256', expiresIn: '-10s' },
      );
      expect(() => verifyToken(token)).toThrow();
    });

    it('rejects tokens signed with wrong key', () => {
      const token = jwt.sign(
        { sub: 'user-6', tier: 'free', type: 'access' },
        wrongKeys.privateKey,
        { algorithm: 'RS256', expiresIn: '15m' },
      );
      expect(() => verifyToken(token)).toThrow();
    });

    it('rejects malformed tokens', () => {
      expect(() => verifyToken('not-a-jwt')).toThrow();
      expect(() => verifyToken('')).toThrow();
      expect(() => verifyToken('a.b.c')).toThrow();
    });

    it('rejects tokens with wrong algorithm', () => {
      const token = jwt.sign(
        { sub: 'user-7', type: 'access' },
        'hmac-secret',
        { algorithm: 'HS256', expiresIn: '15m' },
      );
      expect(() => verifyToken(token)).toThrow();
    });
  });

  // ── authHook ────────────────────────────────────────────────────

  describe('authHook', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const req = mockRequest(undefined);
      const reply = mockReply();
      await authHook(req, reply);
      expect(reply.statusCode).toBe(401);
      expect(reply.body.error).toMatch(/missing/i);
    });

    it('returns 401 when Authorization header has wrong scheme', async () => {
      const req = mockRequest('Basic abc123');
      const reply = mockReply();
      await authHook(req, reply);
      expect(reply.statusCode).toBe(401);
    });

    it('returns 401 for expired access token', async () => {
      const expired = jwt.sign(
        { sub: 'u1', tier: 'free', type: 'access' },
        testKeys.privateKey,
        { algorithm: 'RS256', expiresIn: '-10s' },
      );
      const req = mockRequest(`Bearer ${expired}`);
      const reply = mockReply();
      await authHook(req, reply);
      expect(reply.statusCode).toBe(401);
      expect(reply.body.error).toMatch(/expired/i);
    });

    it('returns 401 for refresh token used as access token', async () => {
      const refresh = generateRefreshToken('u2');
      const req = mockRequest(`Bearer ${refresh}`);
      const reply = mockReply();
      await authHook(req, reply);
      expect(reply.statusCode).toBe(401);
      expect(reply.body.error).toMatch(/invalid token type/i);
    });

    it('sets request.user for valid access token', async () => {
      const token = generateAccessToken('u3', 'business');
      const req = mockRequest(`Bearer ${token}`);
      const reply = mockReply();
      await authHook(req, reply);
      expect(req.user).toEqual({ userId: 'u3', tier: 'business' });
    });

    it('returns 401 for malformed token', async () => {
      const req = mockRequest('Bearer garbage.token.here');
      const reply = mockReply();
      await authHook(req, reply);
      expect(reply.statusCode).toBe(401);
      expect(reply.body.error).toMatch(/invalid/i);
    });

    it('returns 401 when Bearer prefix present but token is empty', async () => {
      const req = mockRequest('Bearer ');
      const reply = mockReply();
      await authHook(req, reply);
      expect(reply.statusCode).toBe(401);
    });
  });
});

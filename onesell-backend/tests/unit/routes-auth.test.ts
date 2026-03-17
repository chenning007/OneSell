/**
 * Unit tests for auth routes (#102).
 * Tests register, login, refresh — all with mocked DB layer.
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// ── Generate RSA keypairs before mocks ──────────────────────────────

const { testKeys } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('node:crypto');
  const pair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { testKeys: { privateKey: pair.privateKey as string, publicKey: pair.publicKey as string } };
});

// ── In-memory user store for mocking ────────────────────────────────

interface MockUser {
  id: string;
  email: string;
  passwordHash: string;
  tier: string;
}

let mockUsers: MockUser[] = [];
let nextId = 1;

// ── Mock env ────────────────────────────────────────────────────────

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

// ── Mock drizzle DB layer ───────────────────────────────────────────

vi.mock('../../src/db/index.js', () => {
  // Build a chainable query builder mock
  function createQueryBuilder() {
    const state: { table: string; whereFn?: (u: MockUser) => boolean; values?: any; limitN?: number; returning?: any } = {
      table: '',
    };

    const builder: any = {
      select: vi.fn((_cols?: any) => {
        return builder;
      }),
      from: vi.fn((_table: any) => {
        state.table = 'users';
        return builder;
      }),
      where: vi.fn((condition: any) => {
        // Store the condition — we'll resolve it in limit() or the terminal call
        state.whereFn = condition;
        return builder;
      }),
      limit: vi.fn((n: number) => {
        state.limitN = n;
        // Execute the query
        let results = [...mockUsers];
        if (state.whereFn) {
          results = results.filter(state.whereFn);
        }
        if (n) {
          results = results.slice(0, n);
        }
        return Promise.resolve(results);
      }),
      insert: vi.fn((_table: any) => {
        state.table = 'users';
        return builder;
      }),
      values: vi.fn((vals: any) => {
        state.values = vals;
        return builder;
      }),
      returning: vi.fn((_cols?: any) => {
        // Execute the insert
        const id = `user-${nextId++}`;
        const newUser: MockUser = {
          id,
          email: state.values.email,
          passwordHash: state.values.passwordHash,
          tier: 'free',
        };
        mockUsers.push(newUser);
        return Promise.resolve([{ id: newUser.id, tier: newUser.tier }]);
      }),
    };
    return builder;
  }

  const mockDb = createQueryBuilder();
  return { db: mockDb, schema: {} };
});

// ── Mock drizzle-orm eq() to return a filter function ───────────────

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (_column: any, value: any) => {
      return (user: MockUser) => {
        if (typeof value === 'string' && value.includes('@')) {
          return user.email === value;
        }
        return user.id === value;
      };
    },
  };
});

// ── Imports (after mocks) ───────────────────────────────────────────

import Fastify from 'fastify';
import { authRoutes, loginAttempts } from '../../src/api/routes/auth.js';
import { verifyToken } from '../../src/api/middleware/auth.js';

// ── Test app builder ────────────────────────────────────────────────

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(authRoutes, { prefix: '/auth' });
  return app;
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Auth Routes (#102)', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    mockUsers = [];
    nextId = 1;
    loginAttempts.clear();
    app = buildApp();
    await app.ready();
  });

  // ── POST /auth/register ─────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('registers a new user and returns tokens', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'alice@example.com', password: 'securePass123' },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();

      // Tokens must be valid
      const access = verifyToken(body.accessToken);
      expect(access.type).toBe('access');
      expect((access as any).tier).toBe('free');

      const refresh = verifyToken(body.refreshToken);
      expect(refresh.type).toBe('refresh');
    });

    it('stores user with hashed password (not plaintext)', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'bob@example.com', password: 'myPassword99' },
      });

      expect(mockUsers).toHaveLength(1);
      expect(mockUsers[0].passwordHash).not.toBe('myPassword99');
      expect(mockUsers[0].passwordHash).toMatch(/^\$2[aby]?\$/); // bcrypt hash prefix
    });

    it('normalizes email to lowercase', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'Alice@EXAMPLE.COM', password: 'securePass123' },
      });

      expect(mockUsers[0].email).toBe('alice@example.com');
    });

    it('returns 409 on duplicate email', async () => {
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'alice@example.com', password: 'securePass123' },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'alice@example.com', password: 'differentPass1' },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error).toMatch(/already registered/i);
    });

    it('returns 400 for invalid email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'not-an-email', password: 'securePass123' },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toMatch(/validation/i);
    });

    it('returns 400 for short password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'a@b.com', password: 'short' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 400 for missing fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST /auth/login ────────────────────────────────────────────

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Seed a user
      await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'carol@example.com', password: 'carolPass123' },
      });
    });

    it('logs in with correct credentials and returns tokens', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'carol@example.com', password: 'carolPass123' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
    });

    it('returns 401 for wrong password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'carol@example.com', password: 'wrongPassword' },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toMatch(/invalid/i);
    });

    it('returns 401 for nonexistent email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'nobody@example.com', password: 'somePass123' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 400 for malformed input', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 123, password: '' },
      });

      expect(res.statusCode).toBe(400);
    });

    it('rate limits after 5 failed attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await app.inject({
          method: 'POST',
          url: '/auth/login',
          payload: { email: 'carol@example.com', password: 'wrong' },
        });
      }

      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: { email: 'carol@example.com', password: 'carolPass123' },
      });

      expect(res.statusCode).toBe(429);
      expect(res.json().error).toMatch(/too many/i);
    });
  });

  // ── POST /auth/refresh ──────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    let validRefreshToken: string;

    beforeEach(async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'dave@example.com', password: 'davePass1234' },
      });
      validRefreshToken = res.json().refreshToken;
    });

    it('returns new token pair for valid refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: validRefreshToken },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();

      // Both returned tokens must be valid
      const access = verifyToken(body.accessToken);
      expect(access.type).toBe('access');
      const refresh = verifyToken(body.refreshToken);
      expect(refresh.type).toBe('refresh');
    });

    it('returns 401 for invalid refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: 'not-a-valid-token' },
      });

      expect(res.statusCode).toBe(401);
    });

    it('returns 400 for missing refreshToken field', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it('returns 401 when using an access token as refresh', async () => {
      const regRes = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: { email: 'eve@example.com', password: 'evePass12345' },
      });
      const accessToken = regRes.json().accessToken;

      const res = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: { refreshToken: accessToken },
      });

      expect(res.statusCode).toBe(401);
      expect(res.json().error).toMatch(/token type/i);
    });
  });
});

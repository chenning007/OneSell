/**
 * Unit tests for user routes (#104).
 * Tests preferences CRUD + saved lists with mocked DB.
 * Verifies auth required, user isolation via JWT userId.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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

// ── In-memory stores ────────────────────────────────────────────────

interface MockUser { id: string; email: string; passwordHash: string; tier: string }
interface MockPref { id: string; userId: string; market: string; budgetLocal: string | null; preferredPlatforms: string[]; productType: string | null; categories: string[]; timeAvailability: string | null; updatedAt: Date }
interface MockSavedProduct { id: string; userId: string; sessionId: string; market: string; productName: string; overallScore: number; cardData: unknown; createdAt: Date }
interface MockSession { id: string; userId: string }

let mockUsers: MockUser[] = [];
let mockPrefs: MockPref[] = [];
let mockSavedProducts: MockSavedProduct[] = [];
let mockSessions: MockSession[] = [];
let nextPrefId = 1;
let nextSavedId = 1;

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
  // Drizzle pgTable objects have column descriptors as properties.
  // We use unique column names to identify which table was passed.
  function identifyTable(table: any): string {
    if (table && 'email' in table && 'passwordHash' in table) return 'users';
    if (table && 'budgetLocal' in table && 'preferredPlatforms' in table) return 'userPreferences';
    if (table && 'productName' in table && 'overallScore' in table) return 'savedProducts';
    if (table && 'status' in table && 'platformsUsed' in table) return 'analysisSessions';
    return '';
  }

  function getStore(name: string): any[] {
    if (name === 'users') return mockUsers;
    if (name === 'userPreferences') return mockPrefs;
    if (name === 'savedProducts') return mockSavedProducts;
    if (name === 'analysisSessions') return mockSessions;
    return [];
  }

  /** Each db.select/insert/update creates a fresh query chain with own state. */
  function makeSelectQuery() {
    let tbl = '';
    const filters: Array<(r: any) => boolean> = [];

    function filtered() {
      let rows = [...getStore(tbl)];
      for (const f of filters) rows = rows.filter(f);
      return rows;
    }

    const q: any = {
      from(table: any) { tbl = identifyTable(table); return q; },
      where(cond: any) { filters.push(cond); return q; },
      limit(n: number) { return Promise.resolve(filtered().slice(0, n)); },
      orderBy(_c: any) { return Promise.resolve(filtered()); },
      // Makes the chain awaitable when no terminal (.limit/.orderBy) is called
      then(onF: any, onR?: any) { return Promise.resolve(filtered()).then(onF, onR); },
    };
    return q;
  }

  function makeInsertQuery(table: any) {
    const tbl = identifyTable(table);
    let vals: any = null;

    const q: any = {
      values(v: any) { vals = v; return q; },
      returning(_c?: any) {
        if (tbl === 'userPreferences' && vals) {
          const p: MockPref = {
            id: `pref-${nextPrefId++}`, userId: vals.userId, market: vals.market,
            budgetLocal: vals.budgetLocal ?? null, preferredPlatforms: vals.preferredPlatforms ?? [],
            productType: vals.productType ?? null, categories: vals.categories ?? [],
            timeAvailability: vals.timeAvailability ?? null, updatedAt: new Date(),
          };
          mockPrefs.push(p);
          return Promise.resolve([p]);
        }
        if (tbl === 'savedProducts' && vals) {
          const s: MockSavedProduct = {
            id: `saved-${nextSavedId++}`, userId: vals.userId, sessionId: vals.sessionId,
            market: vals.market, productName: vals.productName, overallScore: vals.overallScore,
            cardData: vals.cardData, createdAt: new Date(),
          };
          mockSavedProducts.push(s);
          return Promise.resolve([s]);
        }
        return Promise.resolve([]);
      },
    };
    return q;
  }

  function makeUpdateQuery(table: any) {
    const tbl = identifyTable(table);
    let setVals: any = null;
    const filters: Array<(r: any) => boolean> = [];

    function filtered() {
      let rows = [...getStore(tbl)];
      for (const f of filters) rows = rows.filter(f);
      return rows;
    }

    const q: any = {
      set(v: any) { setVals = v; return q; },
      where(cond: any) { filters.push(cond); return q; },
      returning(_c?: any) {
        const matched = filtered();
        if (matched.length > 0) { Object.assign(matched[0], setVals); return Promise.resolve([matched[0]]); }
        return Promise.resolve([]);
      },
    };
    return q;
  }

  const mockDb = {
    select: vi.fn((_cols?: any) => makeSelectQuery()),
    insert: vi.fn((table: any) => makeInsertQuery(table)),
    update: vi.fn((table: any) => makeUpdateQuery(table)),
  };

  return { db: mockDb, schema: {} };
});

// ── Mock drizzle-orm operators ──────────────────────────────────────

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (_column: any, value: any) => {
      return (row: any) => {
        // Match by various fields
        if (row.email === value) return true;
        if (row.id === value) return true;
        if (row.userId === value) return true;
        if (row.market === value) return true;
        return false;
      };
    },
    and: (...fns: Array<(row: any) => boolean>) => {
      return (row: any) => fns.every((fn) => fn(row));
    },
    desc: (_col: any) => 'desc',
  };
});

// ── Imports (after mocks) ───────────────────────────────────────────

import Fastify from 'fastify';
import { userRoutes } from '../../src/api/routes/user.js';
import { generateAccessToken } from '../../src/api/middleware/auth.js';

// ── Helpers ─────────────────────────────────────────────────────────

function buildApp() {
  const app = Fastify({ logger: false });
  app.decorateRequest('user', null);
  app.register(userRoutes, { prefix: '/user' });
  return app;
}

function authHeader(userId: string, tier: 'free' | 'starter' | 'pro' | 'business' = 'free') {
  return { authorization: `Bearer ${generateAccessToken(userId, tier)}` };
}

function seedUser(id: string, email = 'test@example.com') {
  mockUsers.push({ id, email, passwordHash: 'hashed', tier: 'free' });
}

function seedSession(id: string, userId: string) {
  mockSessions.push({ id, userId });
}

// ── Tests ───────────────────────────────────────────────────────────

describe('User Routes (#104)', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    mockUsers = [];
    mockPrefs = [];
    mockSavedProducts = [];
    mockSessions = [];
    nextPrefId = 1;
    nextSavedId = 1;
    app = buildApp();
    await app.ready();
  });

  // ── Auth required ─────────────────────────────────────────────

  describe('Auth enforcement', () => {
    it('GET /user/preferences returns 401 without token', async () => {
      const res = await app.inject({ method: 'GET', url: '/user/preferences' });
      expect(res.statusCode).toBe(401);
    });

    it('PUT /user/preferences returns 401 without token', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/user/preferences',
        payload: { market: 'us' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('GET /user/saved-lists returns 401 without token', async () => {
      const res = await app.inject({ method: 'GET', url: '/user/saved-lists' });
      expect(res.statusCode).toBe(401);
    });

    it('POST /user/saved-lists returns 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/user/saved-lists',
        payload: {},
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ── GET /user/preferences ─────────────────────────────────────

  describe('GET /user/preferences', () => {
    it('returns empty preferences for new user', async () => {
      seedUser('user-1');
      const res = await app.inject({
        method: 'GET',
        url: '/user/preferences',
        headers: authHeader('user-1'),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().preferences).toEqual([]);
    });

    it('returns 404 if user does not exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/user/preferences',
        headers: authHeader('nonexistent'),
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('User not found');
    });

    it('only returns preferences for the authenticated user', async () => {
      seedUser('user-1');
      seedUser('user-2', 'other@example.com');
      mockPrefs.push({
        id: 'pref-a', userId: 'user-1', market: 'us',
        budgetLocal: '200', preferredPlatforms: ['amazon-us'], productType: null,
        categories: [], timeAvailability: null, updatedAt: new Date(),
      });
      mockPrefs.push({
        id: 'pref-b', userId: 'user-2', market: 'cn',
        budgetLocal: '1000', preferredPlatforms: ['taobao'], productType: null,
        categories: [], timeAvailability: null, updatedAt: new Date(),
      });

      const res = await app.inject({
        method: 'GET',
        url: '/user/preferences',
        headers: authHeader('user-1'),
      });
      expect(res.statusCode).toBe(200);
      const prefs = res.json().preferences;
      expect(prefs).toHaveLength(1);
      expect(prefs[0].market).toBe('us');
    });
  });

  // ── PUT /user/preferences ─────────────────────────────────────

  describe('PUT /user/preferences', () => {
    it('creates new preferences', async () => {
      seedUser('user-1');
      const res = await app.inject({
        method: 'PUT',
        url: '/user/preferences',
        headers: authHeader('user-1'),
        payload: { market: 'us', preferredPlatforms: ['amazon-us', 'ebay-us'] },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().preference.market).toBe('us');
      expect(res.json().preference.preferredPlatforms).toEqual(['amazon-us', 'ebay-us']);
    });

    it('updates existing preferences for same market', async () => {
      seedUser('user-1');
      mockPrefs.push({
        id: 'pref-1', userId: 'user-1', market: 'us',
        budgetLocal: '100', preferredPlatforms: ['amazon-us'], productType: null,
        categories: [], timeAvailability: null, updatedAt: new Date(),
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/user/preferences',
        headers: authHeader('user-1'),
        payload: { market: 'us', budgetLocal: '500', preferredPlatforms: ['etsy'] },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().preference.budgetLocal).toBe('500');
    });

    it('returns 400 for invalid body (missing market)', async () => {
      seedUser('user-1');
      const res = await app.inject({
        method: 'PUT',
        url: '/user/preferences',
        headers: authHeader('user-1'),
        payload: { preferredPlatforms: ['amazon-us'] },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('Validation failed');
    });

    it('returns 404 if user does not exist', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/user/preferences',
        headers: authHeader('ghost'),
        payload: { market: 'us' },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── GET /user/saved-lists ─────────────────────────────────────

  describe('GET /user/saved-lists', () => {
    it('returns empty list for new user', async () => {
      seedUser('user-1');
      const res = await app.inject({
        method: 'GET',
        url: '/user/saved-lists',
        headers: authHeader('user-1'),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().savedProducts).toEqual([]);
    });

    it('returns only products for authenticated user', async () => {
      seedUser('user-1');
      seedUser('user-2', 'user2@test.com');
      mockSavedProducts.push({
        id: 'sp-1', userId: 'user-1', sessionId: 's1', market: 'us',
        productName: 'Widget A', overallScore: 85, cardData: {}, createdAt: new Date(),
      });
      mockSavedProducts.push({
        id: 'sp-2', userId: 'user-2', sessionId: 's2', market: 'cn',
        productName: 'Widget B', overallScore: 70, cardData: {}, createdAt: new Date(),
      });

      const res = await app.inject({
        method: 'GET',
        url: '/user/saved-lists',
        headers: authHeader('user-1'),
      });
      const items = res.json().savedProducts;
      expect(items).toHaveLength(1);
      expect(items[0].productName).toBe('Widget A');
    });

    it('returns 404 for nonexistent user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/user/saved-lists',
        headers: authHeader('nope'),
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── POST /user/saved-lists ────────────────────────────────────

  describe('POST /user/saved-lists', () => {
    it('creates a saved product', async () => {
      seedUser('user-1');
      const sessId = 'a0000000-0000-0000-0000-000000000001';
      seedSession(sessId, 'user-1');

      const res = await app.inject({
        method: 'POST',
        url: '/user/saved-lists',
        headers: authHeader('user-1'),
        payload: {
          sessionId: sessId,
          market: 'us',
          productName: 'Cool Gadget',
          overallScore: 92,
          cardData: { price: 29.99 },
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().savedProduct.productName).toBe('Cool Gadget');
    });

    it('returns 400 for invalid body', async () => {
      seedUser('user-1');
      const res = await app.inject({
        method: 'POST',
        url: '/user/saved-lists',
        headers: authHeader('user-1'),
        payload: { market: 'us' }, // missing required fields
      });
      expect(res.statusCode).toBe(400);
    });

    it('returns 404 for nonexistent user', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/user/saved-lists',
        headers: authHeader('ghost'),
        payload: {
          sessionId: 'a0000000-0000-0000-0000-000000000001',
          market: 'us',
          productName: 'X',
          overallScore: 50,
          cardData: {},
        },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 404 if session does not belong to user', async () => {
      seedUser('user-1');
      seedSession('sess-other', 'user-other'); // belongs to different user

      const res = await app.inject({
        method: 'POST',
        url: '/user/saved-lists',
        headers: authHeader('user-1'),
        payload: {
          sessionId: 'a0000000-0000-0000-0000-000000000001',
          market: 'us',
          productName: 'Y',
          overallScore: 60,
          cardData: {},
        },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('Session not found');
    });
  });
});

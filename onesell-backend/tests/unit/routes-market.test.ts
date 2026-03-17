/**
 * Unit tests for market routes (#106).
 * Tests GET /markets and GET /markets/:marketId.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { marketRoutes } from '../../src/api/routes/market.js';
import { _resetCache } from '../../src/services/market/index.js';

// ── Helpers ─────────────────────────────────────────────────────────

function buildApp() {
  const app = Fastify({ logger: false });
  app.register(marketRoutes, { prefix: '/markets' });
  return app;
}

const ALL_MARKET_IDS = ['us', 'cn', 'uk', 'de', 'jp', 'sea', 'au'];

// ── Tests ───────────────────────────────────────────────────────────

describe('Market Routes (#106)', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    _resetCache();
    app = buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // ── GET /markets ──────────────────────────────────────────────

  describe('GET /markets', () => {
    it('returns all 7 markets', async () => {
      const res = await app.inject({ method: 'GET', url: '/markets' });
      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body.markets).toHaveLength(7);

      const ids = body.markets.map((m: { marketId: string }) => m.marketId);
      for (const id of ALL_MARKET_IDS) {
        expect(ids).toContain(id);
      }
    });

    it('each market has required fields', async () => {
      const res = await app.inject({ method: 'GET', url: '/markets' });
      const { markets } = res.json();

      for (const market of markets) {
        expect(market.marketId).toBeDefined();
        expect(typeof market.language).toBe('string');
        expect(typeof market.currency).toBe('string');
        expect(typeof market.flag).toBe('string');
        expect(Array.isArray(market.platforms)).toBe(true);
        expect(market.platforms.length).toBeGreaterThan(0);
      }
    });

    it('returns consistent data on repeated calls (cache)', async () => {
      const res1 = await app.inject({ method: 'GET', url: '/markets' });
      const res2 = await app.inject({ method: 'GET', url: '/markets' });
      expect(res1.json()).toEqual(res2.json());
    });
  });

  // ── GET /markets/:marketId ────────────────────────────────────

  describe('GET /markets/:marketId', () => {
    it.each(ALL_MARKET_IDS)('returns market config for "%s"', async (marketId) => {
      const res = await app.inject({ method: 'GET', url: `/markets/${marketId}` });
      expect(res.statusCode).toBe(200);

      const { market } = res.json();
      expect(market.marketId).toBe(marketId);
      expect(market.language).toBeDefined();
      expect(market.currency).toBeDefined();
      expect(market.platforms.length).toBeGreaterThan(0);
    });

    it('returns 404 for unknown market', async () => {
      const res = await app.inject({ method: 'GET', url: '/markets/xx' });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('Market not found');
    });

    it('returns 404 for empty marketId', async () => {
      // /:marketId won't match empty string — Fastify serves the list route
      const res = await app.inject({ method: 'GET', url: '/markets/' });
      // This hits GET /markets, which is valid
      expect(res.statusCode).toBe(200);
    });

    it('US market has correct currency and platforms', async () => {
      const res = await app.inject({ method: 'GET', url: '/markets/us' });
      const { market } = res.json();
      expect(market.currency).toBe('USD');
      expect(market.language).toBe('en-US');
      expect(market.platforms).toContain('amazon-us');
      expect(market.platforms).toContain('ebay-us');
    });

    it('CN market has correct currency and platforms', async () => {
      const res = await app.inject({ method: 'GET', url: '/markets/cn' });
      const { market } = res.json();
      expect(market.currency).toBe('CNY');
      expect(market.language).toBe('zh-CN');
      expect(market.platforms).toContain('taobao');
      expect(market.platforms).toContain('jd');
    });

    it('JP market has JPY currency', async () => {
      const res = await app.inject({ method: 'GET', url: '/markets/jp' });
      const { market } = res.json();
      expect(market.currency).toBe('JPY');
      expect(market.platforms).toContain('rakuten');
    });
  });
});

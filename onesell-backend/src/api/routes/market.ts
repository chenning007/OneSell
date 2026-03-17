/**
 * Market routes — public endpoints for market configuration.
 *
 * No auth required — market configs are public data.
 *
 * Closes #106
 */

import type { FastifyInstance } from 'fastify';
import { getAllMarkets, getMarket } from '../../services/market/index.js';

// ── Plugin ──────────────────────────────────────────────────────────

export async function marketRoutes(fastify: FastifyInstance): Promise<void> {

  // ── GET /markets ────────────────────────────────────────────────

  fastify.get('/', async (_request, reply) => {
    const markets = getAllMarkets();
    return reply.send({ markets });
  });

  // ── GET /markets/:marketId ──────────────────────────────────────

  fastify.get<{ Params: { marketId: string } }>('/:marketId', async (request, reply) => {
    const market = getMarket(request.params.marketId);
    if (!market) {
      return reply.code(404).send({ error: 'Market not found' });
    }
    return reply.send({ market });
  });
}

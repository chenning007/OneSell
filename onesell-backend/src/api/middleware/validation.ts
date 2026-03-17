/**
 * Request Validation, CORS & Correlation ID middleware.
 *
 * - Zod-based request body validation (P9: all validation through Zod)
 * - Reject payloads > 1 MB with 413
 * - CORS headers (configurable origins from env)
 * - x-correlation-id on every request/response (UUID v4)
 *
 * Closes #100
 */

import type { FastifyInstance, FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import type { ZodSchema, ZodError } from 'zod';
import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import { env } from '../../env.js';

// ── Fastify augmentation ────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
  }
}

// ── Constants ───────────────────────────────────────────────────────

const MAX_BODY_BYTES = 1_048_576; // 1 MB

// ── Zod validation factory ──────────────────────────────────────────

export function validateBody<T>(schema: ZodSchema<T>): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      const zodError = result.error as ZodError;
      reply.code(400).send({
        error: 'Validation failed',
        details: zodError.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }
    // Replace body with parsed (and potentially transformed) value
    (request as Record<string, unknown>).body = result.data;
  };
}

// ── Correlation ID hook ─────────────────────────────────────────────

export async function correlationIdHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const id =
    (request.headers['x-correlation-id'] as string | undefined) || randomUUID();
  request.correlationId = id;
  reply.header('x-correlation-id', id);
}

// ── Body size guard hook ────────────────────────────────────────────

export async function bodySizeHook(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const contentLength = Number(request.headers['content-length'] || 0);
  if (contentLength > MAX_BODY_BYTES) {
    reply.code(413).send({
      error: 'Payload too large',
      maxBytes: MAX_BODY_BYTES,
    });
  }
}

// ── Fastify plugin ──────────────────────────────────────────────────

export async function validationPlugin(fastify: FastifyInstance): Promise<void> {
  // CORS — configurable origins from env
  const origins = env.CORS_ORIGIN.split(',').map((o) => o.trim());
  await fastify.register(cors, {
    origin: origins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id'],
    credentials: true,
  });

  // Correlation ID — attach to every request & response
  fastify.decorateRequest('correlationId', '');
  fastify.addHook('onRequest', correlationIdHook);

  // Body size guard
  fastify.addHook('onRequest', bodySizeHook);
}

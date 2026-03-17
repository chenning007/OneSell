/**
 * Unit tests for validation, CORS & correlation-ID middleware (#100).
 * Tests Zod validation, 413 body size, CORS headers, correlation ID.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

vi.mock('../../src/env.js', () => ({
  env: {
    NODE_ENV: 'test',
    PORT: 3001,
    LOG_LEVEL: 'error',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_PRIVATE_KEY: 'test',
    JWT_PUBLIC_KEY: 'test',
    OPENAI_API_KEY: 'test-key',
    CORS_ORIGIN: 'http://localhost:5173,http://localhost:3000',
  },
}));

import {
  validateBody,
  correlationIdHook,
  bodySizeHook,
} from '../../src/api/middleware/validation.js';

// ── Helpers ─────────────────────────────────────────────────────────

function mockRequest(overrides: Record<string, unknown> = {}) {
  return {
    headers: {},
    body: undefined,
    correlationId: '',
    ...overrides,
  } as any;
}

function mockReply() {
  const r: any = {
    statusCode: 200,
    body: null,
    headers: {} as Record<string, string>,
    code(c: number) { r.statusCode = c; return r; },
    send(body: any) { r.body = body; return r; },
    header(k: string, v: string) { r.headers[k] = v; return r; },
  };
  return r;
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Validation Middleware (#100)', () => {
  // ── validateBody ────────────────────────────────────────────────

  describe('validateBody', () => {
    const schema = z.object({
      name: z.string().min(1),
      count: z.number().int().positive(),
    });

    it('passes valid payloads through', async () => {
      const hook = validateBody(schema);
      const req = mockRequest({ body: { name: 'Widget', count: 5 } });
      const reply = mockReply();
      await hook(req, reply, vi.fn());
      // body replaced with parsed value
      expect(req.body).toEqual({ name: 'Widget', count: 5 });
      expect(reply.statusCode).toBe(200);
    });

    it('returns 400 for invalid payloads', async () => {
      const hook = validateBody(schema);
      const req = mockRequest({ body: { name: '', count: -1 } });
      const reply = mockReply();
      await hook(req, reply, vi.fn());
      expect(reply.statusCode).toBe(400);
      expect(reply.body.error).toBe('Validation failed');
      expect(reply.body.details).toBeInstanceOf(Array);
      expect(reply.body.details.length).toBeGreaterThan(0);
    });

    it('returns 400 when body is missing', async () => {
      const hook = validateBody(schema);
      const req = mockRequest({ body: undefined });
      const reply = mockReply();
      await hook(req, reply, vi.fn());
      expect(reply.statusCode).toBe(400);
    });

    it('returns 400 when body has wrong types', async () => {
      const hook = validateBody(schema);
      const req = mockRequest({ body: { name: 123, count: 'abc' } });
      const reply = mockReply();
      await hook(req, reply, vi.fn());
      expect(reply.statusCode).toBe(400);
    });

    it('reports individual field errors with paths', async () => {
      const hook = validateBody(schema);
      const req = mockRequest({ body: { name: '', count: -1 } });
      const reply = mockReply();
      await hook(req, reply, vi.fn());
      const paths = reply.body.details.map((d: any) => d.path);
      expect(paths).toContain('name');
      expect(paths).toContain('count');
    });

    it('applies Zod transforms', async () => {
      const trimSchema = z.object({ tag: z.string().trim().toLowerCase() });
      const hook = validateBody(trimSchema);
      const req = mockRequest({ body: { tag: '  HELLO  ' } });
      const reply = mockReply();
      await hook(req, reply, vi.fn());
      expect(req.body).toEqual({ tag: 'hello' });
    });

    it('strips unknown keys with strict schema', async () => {
      const strictSchema = z.object({ a: z.number() }).strict();
      const hook = validateBody(strictSchema);
      const req = mockRequest({ body: { a: 1, b: 2 } });
      const reply = mockReply();
      await hook(req, reply, vi.fn());
      expect(reply.statusCode).toBe(400);
    });
  });

  // ── correlationIdHook ───────────────────────────────────────────

  describe('correlationIdHook', () => {
    it('generates a UUID when no x-correlation-id header is present', async () => {
      const req = mockRequest({ headers: {} });
      const reply = mockReply();
      await correlationIdHook(req, reply);
      expect(req.correlationId).toBeTruthy();
      // UUID v4 format: 8-4-4-4-12 hex chars
      expect(req.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      expect(reply.headers['x-correlation-id']).toBe(req.correlationId);
    });

    it('preserves an existing x-correlation-id header', async () => {
      const req = mockRequest({
        headers: { 'x-correlation-id': 'existing-id-123' },
      });
      const reply = mockReply();
      await correlationIdHook(req, reply);
      expect(req.correlationId).toBe('existing-id-123');
      expect(reply.headers['x-correlation-id']).toBe('existing-id-123');
    });

    it('echoes correlation ID on the response', async () => {
      const req = mockRequest({ headers: {} });
      const reply = mockReply();
      await correlationIdHook(req, reply);
      expect(reply.headers['x-correlation-id']).toBe(req.correlationId);
    });
  });

  // ── bodySizeHook ────────────────────────────────────────────────

  describe('bodySizeHook', () => {
    it('allows requests within 1 MB', async () => {
      const req = mockRequest({
        headers: { 'content-length': '500000' }, // 500 KB
      });
      const reply = mockReply();
      await bodySizeHook(req, reply);
      expect(reply.statusCode).toBe(200); // unchanged
    });

    it('allows exactly 1 MB', async () => {
      const req = mockRequest({
        headers: { 'content-length': '1048576' }, // exactly 1 MB
      });
      const reply = mockReply();
      await bodySizeHook(req, reply);
      expect(reply.statusCode).toBe(200);
    });

    it('rejects payloads larger than 1 MB with 413', async () => {
      const req = mockRequest({
        headers: { 'content-length': '1048577' }, // 1 byte over
      });
      const reply = mockReply();
      await bodySizeHook(req, reply);
      expect(reply.statusCode).toBe(413);
      expect(reply.body.error).toMatch(/too large/i);
    });

    it('allows requests with no content-length header', async () => {
      const req = mockRequest({ headers: {} });
      const reply = mockReply();
      await bodySizeHook(req, reply);
      expect(reply.statusCode).toBe(200);
    });

    it('returns maxBytes in 413 response body', async () => {
      const req = mockRequest({
        headers: { 'content-length': '5000000' },
      });
      const reply = mockReply();
      await bodySizeHook(req, reply);
      expect(reply.body.maxBytes).toBe(1_048_576);
    });
  });
});

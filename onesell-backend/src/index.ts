import Fastify from 'fastify';
import { readFileSync } from 'node:fs';
import { env } from './env.js';

// ── TLS 1.3 enforcement (PRD §9, #57) ──────────────────────────────
// In production, TLS is terminated at the load balancer (Cloudflare/nginx).
// When TLS_CERT_PATH and TLS_KEY_PATH are set, Fastify serves HTTPS directly
// with TLS 1.3 minimum, for direct-access or testing scenarios.

function buildServerOptions(): Record<string, unknown> {
  const opts: Record<string, unknown> = {
    logger: { level: env.LOG_LEVEL },
  };

  if (env.TLS_CERT_PATH && env.TLS_KEY_PATH) {
    opts.https = {
      cert: readFileSync(env.TLS_CERT_PATH),
      key: readFileSync(env.TLS_KEY_PATH),
      minVersion: 'TLSv1.3',
    };
  }

  return opts;
}

const app = Fastify(buildServerOptions());

// ── Security headers ────────────────────────────────────────────────

app.addHook('onSend', async (_request, reply) => {
  // HSTS: 1 year, include subdomains, preload-eligible
  reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  // Prevent MIME sniffing
  reply.header('X-Content-Type-Options', 'nosniff');
  // Prevent clickjacking
  reply.header('X-Frame-Options', 'DENY');
  // Referrer policy
  reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
});

app.get('/healthz', async () => ({ status: 'ok', version: '0.2.0' }));

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

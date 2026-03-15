import Fastify from 'fastify';
import { env } from './env.js';

// TODO (M0): Register plugins and routes
// See docs/ARCHITECTURE.md §6 for full backend structure

const app = Fastify({ logger: { level: env.LOG_LEVEL } });

app.get('/healthz', async () => ({ status: 'ok', version: '0.0.0' }));

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

/**
 * Node entry: `npm run dev:api` locally; `node dist-server/index.mjs` in production
 * (cPanel "Setup Node.js App" startup file, or PM2 on a VPS).
 */
import { serve } from '@hono/node-server';
import { bootstrap } from './bootstrap';
import { logger } from './lib/logger';

const { config, app, pool } = bootstrap();

// On cPanel, Passenger intercepts listen(), so PORT only matters locally / behind PM2 + Nginx.
const server = serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  logger.info('api listening', { port: info.port, env: config.NODE_ENV });
});

async function shutdown(signal: string) {
  logger.info('shutting down', { signal });
  server.close();
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

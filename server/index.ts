/**
 * Node entry: `npm run dev:api` locally; `node dist-server/index.mjs` in production
 * (cPanel "Setup Node.js App" startup file, or PM2 on a VPS).
 */
import { serve } from '@hono/node-server';
import * as Sentry from '@sentry/node';
import { createApp } from './app';
import { createAuth } from './auth/auth';
import { createDb } from './db';
import { env } from './env';
import { logger, setLogLevel } from './lib/logger';
import { logMailer, postmarkMailer } from './notifications/mailer';

const config = env();
setLogLevel(config.LOG_LEVEL);

if (config.SENTRY_DSN) {
  Sentry.init({ dsn: config.SENTRY_DSN, environment: config.NODE_ENV, tracesSampleRate: 0 });
}

const { db, pool } = createDb(config.DATABASE_URL);
const auth = createAuth(config, db);
const mailer = config.POSTMARK_SERVER_TOKEN ? postmarkMailer(config.POSTMARK_SERVER_TOKEN, config.EMAIL_FROM) : logMailer();
const app = createApp({ env: config, db, auth, mailer });

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

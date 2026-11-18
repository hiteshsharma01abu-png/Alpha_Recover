import * as Sentry from '@sentry/node';
import { createApp } from './app';
import { createAuth } from './auth/auth';
import { createDb } from './db';
import { env } from './env';
import { setLogLevel } from './lib/logger';
import { logMailer, postmarkMailer } from './notifications/mailer';

/** Reads the environment and wires the app's dependencies. Shared by the Node server and the Vercel function. */
export function bootstrap() {
  const config = env();
  setLogLevel(config.LOG_LEVEL);

  if (config.SENTRY_DSN) {
    Sentry.init({ dsn: config.SENTRY_DSN, environment: config.NODE_ENV, tracesSampleRate: 0 });
  }

  const { db, pool } = createDb(config.DATABASE_URL);
  const auth = createAuth(config, db);
  const mailer = config.POSTMARK_SERVER_TOKEN ? postmarkMailer(config.POSTMARK_SERVER_TOKEN, config.EMAIL_FROM) : logMailer();
  const app = createApp({ env: config, db, auth, mailer });
  return { config, app, pool };
}

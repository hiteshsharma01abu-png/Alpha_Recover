import { Hono, type ErrorHandler } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import * as Sentry from '@sentry/node';
import { AppError } from './lib/errors';
import { logger } from './lib/logger';
import { requestContext } from './lib/request';
import { csrfGuard } from './lib/security';
import { authRoutes } from './routes/auth';
import { blogRoutes } from './routes/blog';
import { catalogRoutes } from './routes/catalog';
import { certificateRoutes } from './routes/certificates';
import { demoVideoRoutes } from './routes/demoVideos';
import { healthRoutes } from './routes/health';
import { internalRoutes } from './routes/internal';
import { leadRoutes } from './routes/leads';
import { meRoutes } from './routes/me';
import { planRoutes } from './routes/plans';
import { settingsRoutes } from './routes/settings';
import type { AppEnv, Deps } from './types';

export const API_BASE = '/api/v1';

/** Builds the API. Dependencies are injected so tests can run it with `app.request()`. */
export function createApp(deps: Deps) {
  const app = new Hono<AppEnv>().basePath(API_BASE);

  app.use('*', async (c, next) => {
    c.set('deps', deps);
    c.set('user', undefined);
    c.set('sessionId', undefined);
    await next();
  });
  app.use('*', requestContext());
  app.use('*', secureHeaders({ crossOriginResourcePolicy: 'same-origin' }));
  app.use('*', csrfGuard([`${API_BASE}/webhooks/`, `${API_BASE}/internal/`]));
  app.use('*', async (c, next) => {
    await next();
    if (!c.res.headers.has('Cache-Control')) c.header('Cache-Control', 'no-store');
  });

  app.route('/', healthRoutes);
  app.route('/', authRoutes);
  app.route('/', internalRoutes);
  app.route('/', leadRoutes);
  app.route('/', catalogRoutes);
  app.route('/', planRoutes);
  app.route('/', demoVideoRoutes);
  app.route('/', blogRoutes);
  app.route('/', certificateRoutes);
  app.route('/', settingsRoutes);
  app.route('/', meRoutes);

  app.notFound((c) =>
    c.json({ error: { code: 'NOT_FOUND', message: 'Route not found', details: [], requestId: c.get('requestId') } }, 404),
  );

  app.onError(errorHandler);

  return app;
}

/** Renders AppError as the standard envelope; anything else is logged, sent to Sentry and hidden. */
export const errorHandler: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get('requestId');
  if (err instanceof AppError) {
    for (const [k, v] of Object.entries(err.headers)) c.header(k, v);
    return c.json({ error: { code: err.code, message: err.message, details: err.details, requestId } }, err.status);
  }
  logger.error('unhandled error', { requestId, path: c.req.path, error: err.message, stack: err.stack });
  Sentry.captureException(err, { tags: { requestId } });
  return c.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', details: [], requestId } },
    500,
  );
};

export type App = ReturnType<typeof createApp>;

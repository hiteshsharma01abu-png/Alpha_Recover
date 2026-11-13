import { timingSafeEqual } from 'node:crypto';
import { lte } from 'drizzle-orm';
import { Hono, type MiddlewareHandler } from 'hono';
import { rateLimitBuckets, sessions, verifications } from '../db/schema';
import { AppError } from '../lib/errors';
import { drainOutbox, releaseStuckJobs } from '../notifications/outbox';
import { expireEnrollments } from '../services/enrollments';
import type { AppEnv } from '../types';

/** Cron endpoints authenticate with `Authorization: Bearer $CRON_SECRET` (host cron calls them with curl). */
const requireCronSecret = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const expected = Buffer.from(`Bearer ${c.get('deps').env.CRON_SECRET}`);
  const given = Buffer.from(c.req.header('authorization') ?? '');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new AppError('UNAUTHENTICATED', 'Invalid cron secret');
  }
  await next();
};

export const internalRoutes = new Hono<AppEnv>()
  .use('/internal/*', requireCronSecret())
  /** Every minute: send queued emails. */
  .post('/internal/cron/notifications', async (c) => {
    const { db, mailer } = c.get('deps');
    await releaseStuckJobs(db);
    const result = await drainOutbox(db, mailer);
    return c.json({ data: result });
  })
  /** Every few minutes: purge expired sessions, tokens and rate-limit buckets; mark ended enrollments expired. */
  .post('/internal/cron/maintenance', async (c) => {
    const { db } = c.get('deps');
    const now = new Date();
    await db.delete(sessions).where(lte(sessions.expiresAt, now));
    await db.delete(verifications).where(lte(verifications.expiresAt, now));
    await db.delete(rateLimitBuckets).where(lte(rateLimitBuckets.expiresAt, now));
    const expiredEnrollments = await expireEnrollments(db, now);
    return c.json({ data: { ok: true, expiredEnrollments } });
  });

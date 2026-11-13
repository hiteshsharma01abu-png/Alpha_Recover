/** Integration tests against a real MySQL (docs/TESTING.md). */
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { errorHandler } from './app';
import { requireStaff, requireUser } from './auth/middleware';
import { notificationJobs, rateLimitBuckets, sessions, users } from './db/schema';
import { hit, rateLimit } from './lib/ratelimit';
import { enqueueEmail } from './notifications/outbox';
import { browserHeaders, createTestContext, readJson, resetTables, signUp } from './test/helpers';
import type { AppEnv } from './types';

const dbAvailable = inject('dbAvailable');

describe.skipIf(!dbAvailable)('API foundation (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;

  beforeAll(() => {
    ctx = createTestContext();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetTables(ctx.db);
    ctx.mailer.sent.length = 0;
    ctx.mailer.fail(null);
  });

  describe('health & envelope', () => {
    it('GET /health reports the database as ok', async () => {
      const res = await ctx.app.request('/api/v1/health');
      expect(res.status).toBe(200);
      expect((await readJson(res)).data).toMatchObject({ status: 'ok', db: 'ok' });
    });

    it('unknown routes return the standard 404 envelope with a request id', async () => {
      const res = await ctx.app.request('/api/v1/does-not-exist');
      expect(res.status).toBe(404);
      const body = await readJson(res);
      expect(body.error).toMatchObject({ code: 'NOT_FOUND', details: [] });
      expect(body.error.requestId).toBe(res.headers.get('x-request-id'));
    });

    it('sets security and no-store headers', async () => {
      const res = await ctx.app.request('/api/v1/health');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('cache-control')).toBe('no-store');
    });
  });

  describe('CSRF guard', () => {
    it('rejects mutations without X-Requested-With', async () => {
      const res = await ctx.app.request('/api/v1/anything', { method: 'POST' });
      expect(res.status).toBe(403);
    });

    it('rejects mutations from another origin', async () => {
      const res = await ctx.app.request('/api/v1/anything', {
        method: 'POST',
        headers: { ...browserHeaders, Origin: 'https://evil.example' },
      });
      expect(res.status).toBe(403);
    });

    it('lets same-origin fetches through (then 404 for an unknown route)', async () => {
      const res = await ctx.app.request('/api/v1/anything', { method: 'POST', headers: browserHeaders });
      expect(res.status).toBe(404);
    });
  });

  describe('rate limiting (MySQL buckets)', () => {
    it('counts hits per fixed window and resets in the next window', async () => {
      const t0 = Date.UTC(2026, 0, 1, 0, 0, 0);
      expect((await hit(ctx.db, 'k', 60, t0)).hits).toBe(1);
      expect((await hit(ctx.db, 'k', 60, t0 + 1_000)).hits).toBe(2);
      expect((await hit(ctx.db, 'k', 60, t0 + 61_000)).hits).toBe(1);
    });

    it('returns 429 with Retry-After once the limit is exceeded', async () => {
      const app = new Hono<AppEnv>();
      app.use('*', async (c, next) => {
        c.set('deps', { env: ctx.env, db: ctx.db, auth: ctx.auth, mailer: ctx.mailer });
        await next();
      });
      app.get('/limited', rateLimit({ name: 'test', limit: 2, windowSeconds: 60 }), (c) => c.text('ok'));
      app.onError(errorHandler);
      expect((await app.request('/limited')).status).toBe(200);
      expect((await app.request('/limited')).status).toBe(200);
      const third = await app.request('/limited');
      expect(third.status).toBe(429);
      expect(Number(third.headers.get('retry-after'))).toBeGreaterThan(0);
      expect(await ctx.db.select().from(rateLimitBuckets)).toHaveLength(1);
    });
  });

  describe('auth foundation', () => {
    it('signs up a student with role/status defaults and queues a verification email', async () => {
      const { userId } = await signUp(ctx);
      const [u] = await ctx.db.select().from(users).where(eq(users.id, userId));
      expect(u).toMatchObject({ role: 'student', status: 'active', firstName: 'Ravi', country: 'IN', emailVerified: false });
      expect(u.id).toMatch(/^[0-9a-f-]{36}$/);
      const jobs = await ctx.db.select().from(notificationJobs);
      expect(jobs.map((j) => j.template)).toEqual(['verify_email']);
    });

    it('ignores role/status sent in sign-up input (always a student)', async () => {
      // Better Auth drops `input: false` fields silently rather than rejecting the request.
      const res = await ctx.auth.api.signUpEmail({
        body: {
          email: 'sneaky@example.com',
          password: 'correct-horse-battery',
          name: 'X',
          country: 'IN',
          termsAcceptedAt: new Date(),
          role: 'super_admin',
          status: 'active',
        } as never,
      });
      const [u] = await ctx.db.select().from(users).where(eq(users.id, res.user.id));
      expect(u.role).toBe('student');
    });

    it('GET /auth/session returns null when anonymous and the user with a session cookie', async () => {
      const anon = await ctx.app.request('/api/v1/auth/session');
      expect((await readJson(anon)).data.user).toBeNull();

      const { cookie } = await signUp(ctx);
      const res = await ctx.app.request('/api/v1/auth/session', { headers: { Cookie: cookie } });
      expect((await readJson(res)).data.user).toMatchObject({ email: 'student@example.com', role: 'student' });
      expect(await ctx.db.select().from(sessions)).toHaveLength(1);
    });

    function guardedApp() {
      const app = new Hono<AppEnv>();
      app.use('*', async (c, next) => {
        c.set('deps', { env: ctx.env, db: ctx.db, auth: ctx.auth, mailer: ctx.mailer });
        c.set('user', undefined);
        await next();
      });
      app.get('/me', requireUser(), (c) => c.text('me'));
      app.get('/admin', requireStaff('orders.refund'), (c) => c.text('admin'));
      app.onError(errorHandler);
      return app;
    }

    it('requireUser: 401 anonymous, 200 logged in, 403 suspended', async () => {
      const app = guardedApp();
      expect((await app.request('/me')).status).toBe(401);
      const { cookie, userId } = await signUp(ctx);
      expect((await app.request('/me', { headers: { Cookie: cookie } })).status).toBe(200);
      await ctx.db.update(users).set({ status: 'suspended' }).where(eq(users.id, userId));
      expect((await app.request('/me', { headers: { Cookie: cookie } })).status).toBe(403);
    });

    it('requireStaff: 403 for students and support, 200 for admin', async () => {
      const app = guardedApp();
      const { cookie, userId } = await signUp(ctx);
      expect((await app.request('/admin', { headers: { Cookie: cookie } })).status).toBe(403);
      await ctx.db.update(users).set({ role: 'support_manager' }).where(eq(users.id, userId));
      expect((await app.request('/admin', { headers: { Cookie: cookie } })).status).toBe(403);
      await ctx.db.update(users).set({ role: 'admin' }).where(eq(users.id, userId));
      expect((await app.request('/admin', { headers: { Cookie: cookie } })).status).toBe(200);
    });
  });

  describe('internal cron endpoints', () => {
    const cron = (path: string, secret = ctx.env.CRON_SECRET) =>
      ctx.app.request(`/api/v1/internal/cron/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } });

    it('rejects a missing or wrong secret', async () => {
      expect((await ctx.app.request('/api/v1/internal/cron/notifications', { method: 'POST' })).status).toBe(401);
      expect((await cron('notifications', 'wrong')).status).toBe(401);
    });

    it('drains queued emails through the mailer', async () => {
      await enqueueEmail(ctx.db, 'password_reset', 'a@example.com', { firstName: 'A', url: 'https://x.test/r' });
      const res = await cron('notifications');
      expect((await readJson(res)).data).toEqual({ claimed: 1, sent: 1, failed: 0 });
      expect(ctx.mailer.sent[0]).toMatchObject({ to: 'a@example.com', tag: 'password_reset' });
      const [job] = await ctx.db.select().from(notificationJobs);
      expect(job).toMatchObject({ status: 'sent', attempts: 1, providerMessageId: 'test-1' });
    });

    it('retries failures with backoff and marks the job dead after 5 attempts', async () => {
      await enqueueEmail(ctx.db, 'verify_email', 'b@example.com', { firstName: 'B', url: 'https://x.test/v' });
      ctx.mailer.fail('provider down');
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        await ctx.db.update(notificationJobs).set({ nextAttemptAt: new Date(Date.now() - 1000) });
        await cron('notifications');
        const [job] = await ctx.db.select().from(notificationJobs);
        expect(job.attempts).toBe(attempt);
        expect(job.status).toBe(attempt < 5 ? 'pending' : 'dead');
        if (attempt < 5) expect(job.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
      }
      expect(ctx.mailer.sent).toHaveLength(0);
    });

    it('maintenance purges expired sessions and rate-limit buckets', async () => {
      await signUp(ctx);
      await ctx.db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) });
      await hit(ctx.db, 'old', 1, Date.now() - 10_000);
      const res = await cron('maintenance');
      expect(res.status).toBe(200);
      expect(await ctx.db.select().from(sessions)).toHaveLength(0);
      const [{ n }] = (await ctx.db.execute(sql`SELECT COUNT(*) AS n FROM rate_limit_buckets`))[0] as unknown as [{ n: number }];
      expect(Number(n)).toBe(0);
    });
  });
});

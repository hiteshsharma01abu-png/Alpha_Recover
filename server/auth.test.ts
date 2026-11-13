import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { activityLogs, notificationJobs, sessions, siteSettings, users } from './db/schema';
import { CookieJar, createTestContext, getJson, postJson, readJson, resetTables } from './test/helpers';

const dbAvailable = inject('dbAvailable');

const registration = {
  firstName: 'Ravi',
  email: 'Ravi@Example.com',
  country: 'IN',
  phone: '63551 97917',
  password: 'correct-horse-battery',
  confirmPassword: 'correct-horse-battery',
  acceptTerms: true,
};

describe.skipIf(!dbAvailable)('auth API', () => {
  let ctx: ReturnType<typeof createTestContext>;
  const app = () => ctx.app;
  const sessionUser = async (jar: CookieJar) => (await readJson(await getJson(app(), '/auth/session', jar))).data.user;
  const register = async (jar = new CookieJar(), body: Record<string, unknown> = registration) => {
    const res = await postJson(app(), '/auth/register', body, jar);
    return { res, jar };
  };
  const login = async (body: Record<string, unknown> = { email: registration.email, password: registration.password }, jar = new CookieJar()) => {
    const res = await postJson(app(), '/auth/login', body, jar);
    return { res, jar };
  };
  const tokenFromLatest = async (template: string) => {
    const jobs = await ctx.db.select().from(notificationJobs).where(eq(notificationJobs.template, template));
    const url = (jobs.at(-1)!.payload as { url: string }).url;
    return { url, token: new URL(url).searchParams.get('token')! };
  };

  beforeAll(() => {
    ctx = createTestContext();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetTables(ctx.db);
  });

  describe('POST /auth/register', () => {
    it('creates a student, signs them in and queues a verification email linking to the website', async () => {
      const { res, jar } = await register();
      expect(res.status).toBe(201);
      expect((await readJson(res)).data.user).toMatchObject({ email: 'ravi@example.com', firstName: 'Ravi', role: 'student', emailVerified: false });
      expect(await sessionUser(jar)).toMatchObject({ email: 'ravi@example.com' });

      const [u] = await ctx.db.select().from(users);
      expect(u).toMatchObject({ country: 'IN', phone: '+916355197917', role: 'student' });
      expect(u.termsAcceptedAt).toBeInstanceOf(Date);
      const { url } = await tokenFromLatest('verify_email');
      expect(url.startsWith('http://localhost:5173/verify-email?token=')).toBe(true);
      expect((await ctx.db.select().from(activityLogs)).map((l) => l.action)).toContain('auth.register');
    });

    it('validates every field', async () => {
      const { res } = await register(new CookieJar(), {
        firstName: '',
        email: 'nope',
        country: 'XX',
        phone: '12',
        password: 'password123',
        confirmPassword: 'different',
        acceptTerms: false,
      });
      expect(res.status).toBe(400);
      const paths = (await readJson(res)).error.details.map((d: { path: string }) => d.path);
      expect(paths).toEqual(expect.arrayContaining(['firstName', 'email', 'country', 'phone', 'password', 'acceptTerms']));
    });

    it('rejects short and common passwords and mismatched confirmation', async () => {
      const short = await register(new CookieJar(), { ...registration, password: 'abc', confirmPassword: 'abc' });
      expect((await readJson(short.res)).error.details[0].message).toMatch(/at least 8/);
      const common = await register(new CookieJar(), { ...registration, password: 'Password123', confirmPassword: 'Password123' });
      expect((await readJson(common.res)).error.details[0].message).toMatch(/too common/);
      const mismatch = await register(new CookieJar(), { ...registration, confirmPassword: 'something-else-1' });
      expect((await readJson(mismatch.res)).error.details.map((d: { path: string }) => d.path)).toEqual(['confirmPassword']);
    });

    it('returns 409 for an existing email (any case)', async () => {
      await register();
      const { res } = await register(new CookieJar(), { ...registration, email: 'RAVI@example.com' });
      expect(res.status).toBe(409);
      expect((await readJson(res)).error.code).toBe('CONFLICT');
    });

    it('rate limits sign-ups to 5 per hour per IP', async () => {
      for (let i = 0; i < 5; i += 1) await register(new CookieJar(), { ...registration, email: `user${i}@example.com` });
      expect((await register(new CookieJar(), { ...registration, email: 'user9@example.com' })).res.status).toBe(429);
    });
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await register();
      await ctx.db.delete(sessions);
    });

    it('signs in, records last login, and remember-me controls the session length', async () => {
      const short = await login({ email: 'ravi@example.com', password: registration.password });
      expect(short.res.status).toBe(200);
      expect((await readJson(short.res)).data.user.email).toBe('ravi@example.com');
      expect(await sessionUser(short.jar)).toMatchObject({ email: 'ravi@example.com' });
      const [s1] = await ctx.db.select().from(sessions);
      expect(s1.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(24 * 3600 * 1000 + 5000);

      await ctx.db.delete(sessions);
      await login({ email: 'ravi@example.com', password: registration.password, remember: true });
      const [s2] = await ctx.db.select().from(sessions);
      expect(s2.expiresAt.getTime() - Date.now()).toBeGreaterThan(29 * 24 * 3600 * 1000);
      const [u] = await ctx.db.select().from(users);
      expect(u.lastLoginAt).toBeInstanceOf(Date);
    });

    it('gives the same 401 for a wrong password and an unknown email, and logs the failure', async () => {
      const wrong = await login({ email: 'ravi@example.com', password: 'wrong-password-1' });
      const unknown = await login({ email: 'nobody@example.com', password: 'wrong-password-1' });
      expect(wrong.res.status).toBe(401);
      expect(unknown.res.status).toBe(401);
      expect((await readJson(wrong.res)).error.message).toBe((await readJson(unknown.res)).error.message);
      const failed = await ctx.db.select().from(activityLogs).where(eq(activityLogs.action, 'auth.login_failed'));
      expect(failed).toHaveLength(2);
      expect(JSON.stringify(failed)).not.toContain('ravi@example.com');
    });

    it('locks after 5 failures (even with the right password), but successful logins never count', async () => {
      for (let i = 0; i < 7; i += 1) expect((await login()).res.status).toBe(200);
      for (let i = 0; i < 5; i += 1) await login({ email: 'ravi@example.com', password: 'wrong-password-1' });
      const locked = await login();
      expect(locked.res.status).toBe(429);
      expect(Number(locked.res.headers.get('retry-after'))).toBeGreaterThan(0);
    });

    it('refuses suspended accounts and leaves no session behind', async () => {
      await ctx.db.update(users).set({ status: 'suspended' });
      const { res, jar } = await login();
      expect(res.status).toBe(403);
      expect(await ctx.db.$count(sessions)).toBe(0);
      expect(await sessionUser(jar)).toBeNull();
    });

    it('keeps at most 2 sessions per student, signing out the oldest', async () => {
      const first = await login();
      await new Promise((r) => setTimeout(r, 5));
      const second = await login();
      await new Promise((r) => setTimeout(r, 5));
      const third = await login();
      expect(await ctx.db.$count(sessions)).toBe(2);
      expect(await sessionUser(first.jar)).toBeNull();
      expect(await sessionUser(second.jar)).not.toBeNull();
      expect(await sessionUser(third.jar)).not.toBeNull();
    });

    it('honours the max_student_sessions setting', async () => {
      await ctx.db.insert(siteSettings).values({ key: 'max_student_sessions', value: 1 });
      const first = await login();
      await new Promise((r) => setTimeout(r, 5));
      await login();
      expect(await ctx.db.$count(sessions)).toBe(1);
      expect(await sessionUser(first.jar)).toBeNull();
    });
  });

  describe('logout', () => {
    it('logout ends the current session; calling it without one is still OK', async () => {
      const { jar } = await register();
      expect((await postJson(app(), '/auth/logout', {}, jar)).status).toBe(200);
      expect(await sessionUser(jar)).toBeNull();
      expect(await ctx.db.$count(sessions)).toBe(0);
      expect((await postJson(app(), '/auth/logout', {}, new CookieJar())).status).toBe(200);
    });

    it('logout-all ends every session of the user', async () => {
      await register();
      const a = await login();
      const b = await login();
      expect((await postJson(app(), '/auth/logout-all', {}, a.jar)).status).toBe(200);
      expect(await ctx.db.$count(sessions)).toBe(0);
      expect(await sessionUser(b.jar)).toBeNull();
      expect((await postJson(app(), '/auth/logout-all', {}, new CookieJar())).status).toBe(401);
    });
  });

  describe('email verification', () => {
    it('verifies with the emailed token; a bad token is rejected', async () => {
      const { jar } = await register();
      const { token } = await tokenFromLatest('verify_email');
      expect((await postJson(app(), '/auth/verify-email', { token: 'garbage' })).status).toBe(400);
      expect((await postJson(app(), '/auth/verify-email', { token })).status).toBe(200);
      expect((await sessionUser(jar)).emailVerified).toBe(true);
    });

    it('resend needs a session, queues a new email, and reports already-verified accounts', async () => {
      expect((await postJson(app(), '/auth/verify-email/resend', {}, new CookieJar())).status).toBe(401);
      const { jar } = await register();
      const res = await postJson(app(), '/auth/verify-email/resend', {}, jar);
      expect((await readJson(res)).data).toEqual({ sent: true });
      expect(await ctx.db.$count(notificationJobs, eq(notificationJobs.template, 'verify_email'))).toBe(2);
      await ctx.db.update(users).set({ emailVerified: true });
      expect((await readJson(await postJson(app(), '/auth/verify-email/resend', {}, jar))).data).toEqual({ alreadyVerified: true });
    });
  });

  describe('password reset', () => {
    beforeEach(async () => {
      await register();
    });

    it('answers the same for unknown emails and queues nothing', async () => {
      const res = await postJson(app(), '/auth/password/forgot', { email: 'nobody@example.com' });
      expect(res.status).toBe(200);
      expect(await ctx.db.$count(notificationJobs, eq(notificationJobs.template, 'password_reset'))).toBe(0);
    });

    it('resets with the emailed token, signs out everywhere, and the token works only once', async () => {
      const other = await login();
      expect((await postJson(app(), '/auth/password/forgot', { email: 'RAVI@example.com' })).status).toBe(200);
      const { url, token } = await tokenFromLatest('password_reset');
      expect(url.startsWith('http://localhost:5173/reset-password?token=')).toBe(true);

      const weak = await postJson(app(), '/auth/password/reset', { token, password: '12345678', confirmPassword: '12345678' });
      expect(weak.status).toBe(400);
      const ok = await postJson(app(), '/auth/password/reset', { token, password: 'brand-new-secret-9', confirmPassword: 'brand-new-secret-9' });
      expect(ok.status).toBe(200);
      expect(await sessionUser(other.jar)).toBeNull();

      expect((await login()).res.status).toBe(401);
      expect((await login({ email: 'ravi@example.com', password: 'brand-new-secret-9' })).res.status).toBe(200);
      const again = await postJson(app(), '/auth/password/reset', { token, password: 'another-secret-77', confirmPassword: 'another-secret-77' });
      expect(again.status).toBe(400);
    });
  });

  describe('POST /auth/password/change', () => {
    it('requires the current password, keeps this session and signs out the others', async () => {
      const { jar } = await register();
      const other = await login();
      const wrong = await postJson(app(), '/auth/password/change', { currentPassword: 'nope-nope-1', password: 'brand-new-secret-9', confirmPassword: 'brand-new-secret-9' }, jar);
      expect(wrong.status).toBe(400);
      expect((await readJson(wrong)).error.details[0].path).toBe('currentPassword');

      const ok = await postJson(app(), '/auth/password/change', { currentPassword: registration.password, password: 'brand-new-secret-9', confirmPassword: 'brand-new-secret-9' }, jar);
      expect(ok.status).toBe(200);
      expect(await sessionUser(jar)).not.toBeNull();
      expect(await sessionUser(other.jar)).toBeNull();
      const [u] = await ctx.db.select().from(users);
      expect(await ctx.db.$count(sessions, and(eq(sessions.userId, u.id)))).toBe(1);
      expect((await login({ email: 'ravi@example.com', password: 'brand-new-secret-9' })).res.status).toBe(200);
    });
  });
});

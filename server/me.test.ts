import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { activityLogs, sessions, users } from './db/schema';
import { describeDevice } from './lib/userAgent';
import { browserHeaders, CookieJar, createTestContext, getJson, postJson, readJson, resetTables } from './test/helpers';

const dbAvailable = inject('dbAvailable');

describe('describeDevice', () => {
  it('recognises common browsers and systems', () => {
    expect(describeDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36')).toBe('Chrome on macOS');
    expect(describeDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1')).toBe('Safari on iOS');
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 Edg/131.0')).toBe('Edge on Windows');
    expect(describeDevice('Mozilla/5.0 (Linux; Android 14) Gecko/20100101 Firefox/133.0')).toBe('Firefox on Android');
    expect(describeDevice(null)).toBe('Unknown device');
  });
});

describe.skipIf(!dbAvailable)('/me (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;
  const app = () => ctx.app;
  const patch = (body: unknown, jar: CookieJar) =>
    app().request('/api/v1/me', {
      method: 'PATCH',
      headers: { ...browserHeaders, 'Content-Type': 'application/json', Cookie: jar.header() },
      body: JSON.stringify(body),
    });
  const del = (path: string, jar: CookieJar) =>
    app().request(`/api/v1${path}`, { method: 'DELETE', headers: { ...browserHeaders, Cookie: jar.header() } });

  async function signedIn(email = 'ravi@example.com') {
    const jar = new CookieJar();
    await postJson(
      app(),
      '/auth/register',
      { firstName: 'Ravi', email, country: 'IN', password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery', acceptTerms: true },
      jar,
    );
    return jar;
  }
  const loginAgain = async (email = 'ravi@example.com', ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile Safari/604.1') => {
    const jar = new CookieJar();
    const res = await app().request('/api/v1/auth/login', {
      method: 'POST',
      headers: { ...browserHeaders, 'Content-Type': 'application/json', 'User-Agent': ua },
      body: JSON.stringify({ email, password: 'correct-horse-battery' }),
    });
    jar.store(res);
    return jar;
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

  it('requires a session', async () => {
    expect((await getJson(app(), '/me', new CookieJar())).status).toBe(401);
    expect((await getJson(app(), '/me/sessions', new CookieJar())).status).toBe(401);
  });

  it('returns the profile', async () => {
    const jar = await signedIn();
    const { data } = await readJson(await getJson(app(), '/me', jar));
    expect(data).toMatchObject({ email: 'ravi@example.com', firstName: 'Ravi', lastName: null, country: 'IN', role: 'student', emailVerified: false, whatsappOptIn: false });
  });

  it('updates allowed fields, normalizes the phone and clears optional ones', async () => {
    const jar = await signedIn();
    const res = await patch({ firstName: 'Ravi K', lastName: 'Patel', certificateName: 'Ravi Kumar Patel', phone: '98250 12345', country: 'AE' }, jar);
    expect(res.status).toBe(200);
    expect((await readJson(res)).data).toMatchObject({ firstName: 'Ravi K', lastName: 'Patel', certificateName: 'Ravi Kumar Patel', phone: '+919825012345', country: 'AE' });
    const cleared = await readJson(await patch({ lastName: '', phone: null }, jar));
    expect(cleared.data).toMatchObject({ lastName: null, phone: null, firstName: 'Ravi K' });
    expect(await ctx.db.$count(activityLogs, eq(activityLogs.action, 'user.update_profile'))).toBe(2);
  });

  it('refuses email, role or status changes and invalid values', async () => {
    const jar = await signedIn();
    for (const body of [{ email: 'x@example.com' }, { role: 'super_admin' }, { status: 'active' }]) {
      expect((await patch(body, jar)).status).toBe(400);
    }
    const bad = await readJson(await patch({ firstName: '', phone: '12', country: 'XX' }, jar));
    expect(bad.error.details.map((d: { path: string }) => d.path).sort()).toEqual(['country', 'firstName', 'phone']);
    const [u] = await ctx.db.select().from(users);
    expect(u).toMatchObject({ email: 'ravi@example.com', role: 'student' });
  });

  it('records WhatsApp consent once and keeps the original timestamp', async () => {
    const jar = await signedIn();
    await patch({ whatsappOptIn: true }, jar);
    const [{ whatsappOptInAt: first }] = await ctx.db.select().from(users);
    await new Promise((r) => setTimeout(r, 10));
    await patch({ whatsappOptIn: true }, jar);
    const [{ whatsappOptInAt: second }] = await ctx.db.select().from(users);
    expect(second?.getTime()).toBe(first?.getTime());
    expect((await readJson(await patch({ whatsappOptIn: false }, jar))).data.whatsappOptIn).toBe(false);
  });

  it('lists devices with the current one marked, and signs out another device', async () => {
    const laptop = await signedIn();
    const phone = await loginAgain();
    const { data } = await readJson(await getJson(app(), '/me/sessions', laptop));
    expect(data).toHaveLength(2);
    expect(data.filter((s: { current: boolean }) => s.current)).toHaveLength(1);
    const other = data.find((s: { current: boolean }) => !s.current);
    expect(other.device).toBe('Safari on iOS');

    const res = await del(`/me/sessions/${other.id}`, laptop);
    expect((await readJson(res)).data).toEqual({ ok: true, current: false });
    expect((await readJson(await getJson(app(), '/auth/session', phone))).data.user).toBeNull();
    expect((await readJson(await getJson(app(), '/me/sessions', laptop))).data).toHaveLength(1);
  });

  it("can't touch another user's session", async () => {
    const mine = await signedIn('ravi@example.com');
    await signedIn('other@example.com');
    const [otherUser] = await ctx.db.select().from(users).where(eq(users.email, 'other@example.com'));
    const [theirs] = await ctx.db.select().from(sessions).where(eq(sessions.userId, otherUser.id));
    expect((await del(`/me/sessions/${theirs.id}`, mine)).status).toBe(404);
    expect(await ctx.db.$count(sessions, eq(sessions.id, theirs.id))).toBe(1);
    expect((await del('/me/sessions/not-a-uuid', mine)).status).toBe(400);
  });
});

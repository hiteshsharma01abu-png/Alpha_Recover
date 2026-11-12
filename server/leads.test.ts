import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { leads, notificationJobs, siteSettings } from './db/schema';
import { browserHeaders, createTestContext, readJson, resetTables } from './test/helpers';

const dbAvailable = inject('dbAvailable');

const contact = {
  source: 'contact_form',
  name: 'Ravi Patel',
  email: 'Ravi@Example.com',
  phone: '63551 97917',
  reason: 'training',
  message: 'Is the course available in Hindi?',
  whatsappConsent: true,
  pagePath: '/contact',
  utm: { utm_source: 'google' },
};

describe.skipIf(!dbAvailable)('POST /leads', () => {
  let ctx: ReturnType<typeof createTestContext>;
  const post = (body: unknown, c = ctx) =>
    c.app.request('/api/v1/leads', {
      method: 'POST',
      headers: { ...browserHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  beforeAll(() => {
    ctx = createTestContext();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetTables(ctx.db);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saves a contact-form lead with normalized phone/email and queues alert + acknowledgement', async () => {
    const res = await post(contact);
    expect(res.status).toBe(201);
    expect(await readJson(res)).toEqual({ data: { ok: true } });

    const [lead] = await ctx.db.select().from(leads);
    expect(lead).toMatchObject({
      source: 'contact_form',
      name: 'Ravi Patel',
      email: 'ravi@example.com',
      phone: '+916355197917',
      reason: 'training',
      whatsappConsent: true,
      status: 'new',
      pagePath: '/contact',
      utm: { utm_source: 'google' },
    });
    expect(lead.ipHash).toMatch(/^[0-9a-f]{64}$/);

    const jobs = await ctx.db.select().from(notificationJobs);
    expect(jobs.map((j) => [j.template, j.toAddress]).sort()).toEqual([
      ['lead_ack', 'ravi@example.com'],
      ['lead_alert', 'info@alpharecover.com'],
    ]);
    const alert = jobs.find((j) => j.template === 'lead_alert');
    expect(alert?.payload).toMatchObject({ reason: 'Training', phone: '+916355197917' });
  });

  it('sends lead alerts to every address in site_settings.lead_notification_emails', async () => {
    await ctx.db.insert(siteSettings).values({ key: 'lead_notification_emails', value: ['a@team.test', 'b@team.test'] });
    await post(contact);
    const alerts = (await ctx.db.select().from(notificationJobs)).filter((j) => j.template === 'lead_alert');
    expect(alerts.map((j) => j.toAddress).sort()).toEqual(['a@team.test', 'b@team.test']);
  });

  it('accepts a callback request with just a phone number (no acknowledgement email)', async () => {
    const res = await post({ source: 'callback', phone: '+971 50 123 4567', pagePath: '/' });
    expect(res.status).toBe(201);
    const [lead] = await ctx.db.select().from(leads);
    expect(lead).toMatchObject({ source: 'callback', phone: '+971501234567', email: null, reason: null });
    const jobs = await ctx.db.select().from(notificationJobs);
    expect(jobs.map((j) => j.template)).toEqual(['lead_alert']);
  });

  it('rejects a callback without a phone number', async () => {
    const res = await post({ source: 'callback', email: 'x@example.com' });
    expect(res.status).toBe(400);
    const body = await readJson(res);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details.map((d: { path: string }) => d.path)).toContain('phone');
  });

  it('reports every invalid contact-form field', async () => {
    const res = await post({ ...contact, email: 'not-an-email', phone: '123', message: '  ', reason: 'nope' });
    expect(res.status).toBe(400);
    const paths = (await readJson(res)).error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['email', 'phone', 'message', 'reason']));
    expect(await ctx.db.select().from(leads)).toHaveLength(0);
  });

  it('silently marks honeypot submissions as spam and sends nothing', async () => {
    const res = await post({ ...contact, website: 'http://spam.example' });
    expect(res.status).toBe(201);
    const [lead] = await ctx.db.select().from(leads);
    expect(lead.status).toBe('spam');
    expect(await ctx.db.select().from(notificationJobs)).toHaveLength(0);
  });

  it('rate limits to 5 submissions per hour per IP', async () => {
    for (let i = 0; i < 5; i += 1) expect((await post(contact)).status).toBe(201);
    const res = await post(contact);
    expect(res.status).toBe(429);
    expect((await readJson(res)).error.code).toBe('RATE_LIMITED');
  });

  it('requires the cross-site header like every other mutation', async () => {
    const res = await ctx.app.request('/api/v1/leads', { method: 'POST', body: JSON.stringify(contact) });
    expect(res.status).toBe(403);
  });

  describe('with Turnstile configured', () => {
    let secured: ReturnType<typeof createTestContext>;
    beforeAll(() => {
      secured = createTestContext({ TURNSTILE_SECRET_KEY: 'turnstile-test-secret' });
    });
    afterAll(async () => {
      await secured.close();
    });

    const turnstileReplies = (success: boolean) => {
      const real = globalThis.fetch;
      return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('challenges.cloudflare.com')) return Response.json({ success });
        return real(input, init);
      });
    };

    it('rejects a missing token', async () => {
      const res = await post(contact, secured);
      expect(res.status).toBe(400);
      expect((await readJson(res)).error.code).toBe('CAPTCHA_FAILED');
    });

    it('rejects a token Cloudflare says is invalid', async () => {
      turnstileReplies(false);
      const res = await post({ ...contact, captchaToken: 'bad' }, secured);
      expect((await readJson(res)).error.code).toBe('CAPTCHA_FAILED');
    });

    it('accepts a valid token', async () => {
      const spy = turnstileReplies(true);
      const res = await post({ ...contact, captchaToken: 'good' }, secured);
      expect(res.status).toBe(201);
      const [, init] = spy.mock.calls.find(([u]) => String(u).includes('cloudflare'))!;
      expect(String(init?.body)).toContain('secret=turnstile-test-secret');
    });
  });
});

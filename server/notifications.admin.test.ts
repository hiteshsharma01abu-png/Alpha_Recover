import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { activityLogs, notificationJobs } from './db/schema';
import { drainOutbox, enqueueEmail } from './notifications/outbox';
import { createTestContext, getJson, loginAs, postJson, readJson, resetTables } from './test/helpers';

const dbAvailable = inject('dbAvailable');
const SECRET_URL = 'http://localhost:5173/reset-password?token=super-secret-token';

describe.skipIf(!dbAvailable)('admin email log API (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;

  beforeAll(() => {
    ctx = createTestContext();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetTables(ctx.db);
    ctx.mailer.fail(null);
  });

  /** One sent, one failed for good, one retrying, one queued (sign in first: registering queues its own email). */
  async function seedOutbox() {
    await ctx.db.delete(notificationJobs);
    await enqueueEmail(ctx.db, 'lead_ack', 'sent@example.com', { name: 'Asha', callback: false });
    await drainOutbox(ctx.db, ctx.mailer);
    await enqueueEmail(ctx.db, 'lead_ack', 'dead@example.com', { name: null, callback: true });
    await enqueueEmail(ctx.db, 'password_reset', 'retry@example.com', { firstName: 'Ravi', url: SECRET_URL });
    ctx.mailer.fail('Postmark: inactive recipient');
    await drainOutbox(ctx.db, ctx.mailer);
    ctx.mailer.fail(null);
    await ctx.db.update(notificationJobs).set({ status: 'dead', attempts: 5 }).where(eq(notificationJobs.toAddress, 'dead@example.com'));
    await enqueueEmail(ctx.db, 'verify_email', 'queued@example.com', { firstName: 'Meena', url: SECRET_URL });
  }

  const byTo = (data: { to: string }[], to: string) => data.find((r) => r.to === to) as Record<string, unknown>;

  it('lists the outbox with states, counts and subjects, never the payload', async () => {
    const { jar } = await loginAs(ctx, 'support_manager');
    await seedOutbox();
    const res = await getJson(ctx.app, '/admin/notifications', jar);
    const text = await res.clone().text();
    const { data, meta } = await readJson(res);
    expect(meta.counts).toEqual({ queued: 1, retrying: 1, sent: 1, failed: 1 });
    expect(byTo(data, 'sent@example.com')).toMatchObject({ state: 'sent', subject: 'We received your message — Alpha Recover', retryBlockedReason: 'Already sent.' });
    expect(byTo(data, 'dead@example.com')).toMatchObject({ state: 'failed', attempts: 5, lastError: 'Postmark: inactive recipient', retryBlockedReason: null });
    expect(byTo(data, 'retry@example.com')).toMatchObject({ state: 'retrying', attempts: 1, subject: 'Reset your Alpha Recover password' });
    expect(byTo(data, 'queued@example.com')).toMatchObject({ state: 'queued' });
    expect(text).not.toContain('super-secret-token');
    expect(Object.keys(data[0])).not.toContain('payload');
  });

  it('filters by state, template, recipient and IST day', async () => {
    const { jar } = await loginAs(ctx, 'admin');
    await seedOutbox();
    const list = async (qs: string) => (await readJson(await getJson(ctx.app, `/admin/notifications?${qs}`, jar))).data.map((r: { to: string }) => r.to);
    expect(await list('state=failed')).toEqual(['dead@example.com']);
    expect((await list('template=lead_ack')).sort()).toEqual(['dead@example.com', 'sent@example.com']);
    expect(await list('q=queued@')).toEqual(['queued@example.com']);
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    expect(await list(`from=${today}&to=${today}`)).toHaveLength(4);
    expect(await list('from=2020-01-01&to=2020-01-02')).toEqual([]);
    expect((await getJson(ctx.app, '/admin/notifications?template=nope', jar)).status).toBe(400);
  });

  it('retries a failed email with fresh attempts, then it sends; audited', async () => {
    const { jar } = await loginAs(ctx, 'support_manager');
    await seedOutbox();
    const [dead] = await ctx.db.select().from(notificationJobs).where(eq(notificationJobs.toAddress, 'dead@example.com'));
    expect((await postJson(ctx.app, `/admin/notifications/${dead.id}/retry`, {}, jar)).status).toBe(200);
    const [queued] = await ctx.db.select().from(notificationJobs).where(eq(notificationJobs.id, dead.id));
    expect(queued).toMatchObject({ status: 'pending', attempts: 0 });
    await drainOutbox(ctx.db, ctx.mailer);
    const [sent] = await ctx.db.select().from(notificationJobs).where(eq(notificationJobs.id, dead.id));
    expect(sent.status).toBe('sent');
    expect(ctx.mailer.sent.map((m) => m.to)).toContain('dead@example.com');
    const [log] = await ctx.db.select().from(activityLogs).where(eq(activityLogs.action, 'notifications.retry'));
    expect(log).toMatchObject({ entityId: dead.id });
    // Sent and queued emails can't be retried.
    expect((await postJson(ctx.app, `/admin/notifications/${dead.id}/retry`, {}, jar)).status).toBe(422);
  });

  it('refuses to resend an email whose sign-in link has expired', async () => {
    const { jar } = await loginAs(ctx, 'admin');
    await seedOutbox();
    const [reset] = await ctx.db.select().from(notificationJobs).where(eq(notificationJobs.toAddress, 'retry@example.com'));
    await ctx.db.update(notificationJobs).set({ status: 'dead', createdAt: new Date(Date.now() - 2 * 3_600_000) }).where(eq(notificationJobs.id, reset.id));
    const res = await postJson(ctx.app, `/admin/notifications/${reset.id}/retry`, {}, jar);
    expect(res.status).toBe(422);
    expect((await readJson(res)).error.message).toContain('expired');
    // Within its lifetime it's allowed.
    await ctx.db.update(notificationJobs).set({ createdAt: new Date(Date.now() - 10 * 60_000) }).where(eq(notificationJobs.id, reset.id));
    expect((await postJson(ctx.app, `/admin/notifications/${reset.id}/retry`, {}, jar)).status).toBe(200);
  });

  it('flags a stalled outbox when due emails have waited over 30 minutes', async () => {
    const { jar } = await loginAs(ctx, 'admin');
    await seedOutbox();
    const meta = async () => (await readJson(await getJson(ctx.app, '/admin/notifications', jar))).meta;
    expect((await meta()).stalledSince).toBeNull();
    const since = new Date(Date.now() - 45 * 60_000);
    await ctx.db.update(notificationJobs).set({ nextAttemptAt: since }).where(eq(notificationJobs.toAddress, 'queued@example.com'));
    expect(Date.parse((await meta()).stalledSince)).toBe(since.getTime());
  });

  it('is limited to roles with notifications access', async () => {
    expect((await getJson(ctx.app, '/admin/notifications', (await loginAs(ctx, 'finance_manager')).jar)).status).toBe(403);
    expect((await getJson(ctx.app, '/admin/notifications', (await loginAs(ctx, 'content_manager')).jar)).status).toBe(403);
  });
});

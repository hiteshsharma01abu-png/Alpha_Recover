import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { company, socialLinks } from '../src/data/content';
import { activityLogs, siteSettings } from './db/schema';
import { seedSettings } from './db/seed';
import { getSetting } from './settings';
import { createTestContext, getJson, loginAs, readJson, resetTables, sendJson } from './test/helpers';

const dbAvailable = inject('dbAvailable');

describe.skipIf(!dbAvailable)('admin settings API (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;
  const put = (key: string, value: unknown, jar: Parameters<typeof sendJson>[4]) => sendJson(ctx, 'PUT', `/admin/settings/${key}`, { value }, jar);
  const publicSettings = async () => (await readJson(await ctx.app.request('/api/v1/settings/public'))).data;

  beforeAll(() => {
    ctx = createTestContext();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetTables(ctx.db);
    await seedSettings(ctx.db);
  });

  it('returns every key, with null for unset ones, flags, and who changed it', async () => {
    const { jar } = await loginAs(ctx, 'admin');
    const { data } = await readJson(await getJson(ctx.app, '/admin/settings', jar));
    expect(Object.keys(data).sort()).toEqual(['company', 'lead_notification_emails', 'max_student_sessions', 'social_links']);
    expect(data.company).toMatchObject({ value: company, isPublic: true, isPolicy: false, updatedBy: null });
    expect(data.max_student_sessions).toMatchObject({ value: null, isPolicy: true });
    expect((await getJson(ctx.app, '/admin/settings', (await loginAs(ctx, 'finance_manager')).jar)).status).toBe(403);
  });

  it('updates contact details (site follows) and audits before/after', async () => {
    const { jar, id } = await loginAs(ctx, 'admin');
    const res = await put('company', { ...company, email: 'hello@alpharecover.com', hours: 'Mon – Sat, 10 AM – 7 PM' }, jar);
    expect((await readJson(res)).data).toEqual({ ok: true, changed: true });
    expect((await publicSettings()).company).toMatchObject({ email: 'hello@alpharecover.com', hours: 'Mon – Sat, 10 AM – 7 PM' });
    const [row] = await ctx.db.select().from(siteSettings).where(eq(siteSettings.key, 'company'));
    expect(row.updatedBy).toBe(id);
    const [log] = await ctx.db.select().from(activityLogs).where(eq(activityLogs.action, 'settings.update'));
    expect(log).toMatchObject({ entityId: 'company' });
    expect(log.metadata).toMatchObject({ before: { email: company.email }, after: { email: 'hello@alpharecover.com' } });
    // Saving the same value again writes nothing.
    expect((await readJson(await put('company', { ...company, email: 'hello@alpharecover.com', hours: 'Mon – Sat, 10 AM – 7 PM' }, jar))).data.changed).toBe(false);
    expect(await ctx.db.$count(activityLogs, eq(activityLogs.action, 'settings.update'))).toBe(1);
  });

  it('rejects unsafe links and malformed values', async () => {
    const { jar } = await loginAs(ctx, 'admin');
    const bad = async (key: string, value: unknown) => {
      const res = await put(key, value, jar);
      expect(res.status).toBe(400);
      return (await readJson(res)).error;
    };
    expect((await bad('social_links', [{ platform: 'youtube', url: 'javascript:alert(1)' }])).details[0].path).toBe('value.0.url');
    await bad('social_links', [{ platform: 'youtube', url: 'http://youtube.com/@alpha' }]);
    await bad('company', { ...company, whatsapp: 'javascript:alert(1)' });
    await bad('company', { ...company, phoneHref: 'javascript:alert(1)' });
    await bad('company', { ...company, email: undefined });
    await bad('lead_notification_emails', []);
    await bad('lead_notification_emails', ['not-an-email']);
    expect((await sendJson(ctx, 'PUT', '/admin/settings/unknown_key', { value: 1 }, jar)).status).toBe(400);
    expect(await publicSettings()).toEqual({ company, socialLinks });
  });

  it('lets admins set lead recipients and social links (empty list hides them)', async () => {
    const { jar } = await loginAs(ctx, 'admin');
    expect((await put('lead_notification_emails', ['sales@alpharecover.com', 'owner@alpharecover.com'], jar)).status).toBe(200);
    expect(await getSetting(ctx.db, 'lead_notification_emails', [])).toEqual(['sales@alpharecover.com', 'owner@alpharecover.com']);
    expect((await put('social_links', [{ platform: 'youtube', url: 'https://youtube.com/@alpharecover' }], jar)).status).toBe(200);
    expect((await publicSettings()).socialLinks).toEqual([{ platform: 'youtube', url: 'https://youtube.com/@alpharecover' }]);
    // Private keys stay private after an update.
    expect(JSON.stringify(await publicSettings())).not.toContain('sales@');
  });

  it('only Super Admins change policies', async () => {
    const admin = await loginAs(ctx, 'admin');
    expect((await put('max_student_sessions', 3, admin.jar)).status).toBe(403);
    const owner = await loginAs(ctx, 'super_admin');
    expect((await put('max_student_sessions', 0, owner.jar)).status).toBe(400);
    expect((await put('max_student_sessions', 3, owner.jar)).status).toBe(200);
    expect(await getSetting(ctx.db, 'max_student_sessions', 2)).toBe(3);
  });
});

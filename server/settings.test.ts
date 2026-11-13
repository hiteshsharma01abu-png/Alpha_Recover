import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { company, socialLinks } from '../src/data/content';
import { siteSettings } from './db/schema';
import { seedSettings } from './db/seed';
import { getSetting } from './settings';
import { createTestContext, readJson, resetTables } from './test/helpers';

const dbAvailable = inject('dbAvailable');

describe.skipIf(!dbAvailable)('settings (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;
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

  it('seeds company details and social links as public settings, insert-only', async () => {
    const rows = await ctx.db.select().from(siteSettings);
    expect(rows.map((r) => [r.key, r.isPublic]).sort()).toEqual([
      ['company', true],
      ['social_links', true],
    ]);
    await ctx.db.update(siteSettings).set({ value: { ...company, email: 'edited@alpharecover.com' } }).where(eq(siteSettings.key, 'company'));
    expect(await seedSettings(ctx.db)).toEqual({ settings: 0 });
    expect((await publicSettings()).company.email).toBe('edited@alpharecover.com');
  });

  it('GET /settings/public returns company and social links with a public cache', async () => {
    const res = await ctx.app.request('/api/v1/settings/public');
    expect(res.headers.get('cache-control')).toContain('s-maxage=300');
    const { data } = await readJson(res);
    expect(data).toEqual({ company, socialLinks });
  });

  it('never exposes non-public settings', async () => {
    await ctx.db.insert(siteSettings).values({ key: 'lead_notification_emails', value: ['secret-inbox@team.test'] });
    expect(JSON.stringify(await publicSettings())).not.toContain('secret-inbox');
  });

  it('skips a setting whose stored value is invalid instead of breaking the site', async () => {
    await ctx.db.update(siteSettings).set({ value: [{ platform: 'myspace', url: 'not a url' }] }).where(eq(siteSettings.key, 'social_links'));
    const data = await publicSettings();
    expect(data.socialLinks).toBeUndefined();
    expect(data.company).toEqual(company);
  });

  it('getSetting falls back when a value is missing or invalid', async () => {
    expect(await getSetting(ctx.db, 'lead_notification_emails', ['x@team.test'])).toEqual(['x@team.test']);
    await ctx.db.insert(siteSettings).values({ key: 'lead_notification_emails', value: ['not-an-email'] });
    expect(await getSetting(ctx.db, 'lead_notification_emails', ['x@team.test'])).toEqual(['x@team.test']);
  });
});

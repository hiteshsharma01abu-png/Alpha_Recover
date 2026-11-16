import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { activityLogs, demoVideos } from './db/schema';
import { seedDemoVideos } from './db/seed';
import { createTestContext, getJson, loginAs, postJson, readJson, resetTables, sendJson } from './test/helpers';

const dbAvailable = inject('dbAvailable');

const newVideo = (over: Record<string, unknown> = {}) => ({
  slug: 'ssd-firmware-rescue',
  title: 'SSD firmware rescue walkthrough',
  tag: 'Firmware',
  category: 'firmware',
  level: 'advanced',
  description: 'Recovering a bricked SSD by repairing its firmware modules.',
  tags: ['SSD', 'Firmware'],
  durationSeconds: 754,
  status: 'draft',
  ...over,
});

describe.skipIf(!dbAvailable)('admin demo videos API (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;

  beforeAll(() => {
    ctx = createTestContext();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetTables(ctx.db);
    await seedDemoVideos(ctx.db);
  });

  const featuredSlugs = async () =>
    (await ctx.db.select({ slug: demoVideos.slug }).from(demoVideos).where(eq(demoVideos.isFeatured, true))).map((r) => r.slug);

  it('lists every status with counts and filters; finance and support have no access', async () => {
    const { jar } = await loginAs(ctx, 'content_manager');
    await postJson(ctx.app, '/admin/demo-videos', newVideo(), jar);
    const all = await readJson(await getJson(ctx.app, '/admin/demo-videos', jar));
    expect(all.data).toHaveLength(7);
    expect(all.meta.counts).toEqual({ draft: 1, published: 6, archived: 0 });
    expect(all.data[0].isFeatured).toBe(true);
    expect((await readJson(await getJson(ctx.app, '/admin/demo-videos?status=draft', jar))).data.map((v: { slug: string }) => v.slug)).toEqual(['ssd-firmware-rescue']);
    expect((await readJson(await getJson(ctx.app, '/admin/demo-videos?category=firmware&q=rescue', jar))).data).toHaveLength(1);
    expect((await getJson(ctx.app, '/admin/demo-videos', (await loginAs(ctx, 'finance_manager')).jar)).status).toBe(403);
    expect((await getJson(ctx.app, '/admin/demo-videos', (await loginAs(ctx, 'support_manager')).jar)).status).toBe(403);
  });

  it('creates drafts (hidden from the site) and validates input', async () => {
    const { jar } = await loginAs(ctx, 'content_manager');
    const res = await postJson(ctx.app, '/admin/demo-videos', newVideo({ thumbnailUrl: '/assets/demo/ssd.webp' }), jar);
    expect(res.status).toBe(201);
    const { id } = (await readJson(res)).data;
    const [row] = await ctx.db.select().from(demoVideos).where(eq(demoVideos.id, id));
    expect(row).toMatchObject({ status: 'draft', publishedAt: null, thumbnailUrl: '/assets/demo/ssd.webp' });
    expect((await getJson(ctx.app, '/demo-videos/ssd-firmware-rescue')).status).toBe(404);
    expect(await ctx.db.$count(activityLogs, eq(activityLogs.action, 'demos.create'))).toBe(1);

    expect((await postJson(ctx.app, '/admin/demo-videos', newVideo(), jar)).status).toBe(409);
    expect((await postJson(ctx.app, '/admin/demo-videos', newVideo({ slug: 'x-1', thumbnailUrl: 'javascript:alert(1)' }), jar)).status).toBe(400);
    expect((await postJson(ctx.app, '/admin/demo-videos', newVideo({ slug: 'x-2', thumbnailUrl: 'http://insecure.example/a.jpg' }), jar)).status).toBe(400);
    expect((await postJson(ctx.app, '/admin/demo-videos', newVideo({ slug: 'x-3', category: 'cooking' }), jar)).status).toBe(400);
    expect((await postJson(ctx.app, '/admin/demo-videos', newVideo({ slug: 'x-4', isFeatured: true }), jar)).status).toBe(400);
    expect((await postJson(ctx.app, '/admin/demo-videos', newVideo({ slug: 'x-5', viewCount: 99999 }), jar)).status).toBe(400);
  });

  it('publishes (stamping publishedAt), edits with an audit diff, and keeps the slug', async () => {
    const { jar } = await loginAs(ctx, 'admin');
    const { id } = (await readJson(await postJson(ctx.app, '/admin/demo-videos', newVideo(), jar))).data;
    const res = await sendJson(ctx, 'PATCH', `/admin/demo-videos/${id}`, { status: 'published', title: 'SSD firmware rescue' }, jar);
    expect((await readJson(res)).data.changed.sort()).toEqual(['status', 'title']);
    const pub = (await readJson(await getJson(ctx.app, '/demo-videos/ssd-firmware-rescue'))).data;
    expect(pub).toMatchObject({ title: 'SSD firmware rescue', category: 'firmware' });
    expect(pub.publishedAt).not.toBeNull();
    const [log] = await ctx.db.select().from(activityLogs).where(eq(activityLogs.action, 'demos.update'));
    expect(log.metadata).toMatchObject({ before: { status: 'draft' }, after: { status: 'published' } });
    expect((await sendJson(ctx, 'PATCH', `/admin/demo-videos/${id}`, { slug: 'other' }, jar)).status).toBe(400);
    expect((await readJson(await sendJson(ctx, 'PATCH', `/admin/demo-videos/${id}`, { title: 'SSD firmware rescue' }, jar))).data.changed).toEqual([]);
  });

  it('keeps exactly one featured video and clears it when unpublished', async () => {
    const { jar } = await loginAs(ctx, 'content_manager');
    const [before] = await featuredSlugs();
    const [other] = await ctx.db
      .select()
      .from(demoVideos)
      .where(and(eq(demoVideos.isFeatured, false), eq(demoVideos.status, 'published')))
      .limit(1);
    expect((await sendJson(ctx, 'PATCH', `/admin/demo-videos/${other.id}`, { isFeatured: true }, jar)).status).toBe(200);
    expect(await featuredSlugs()).toEqual([other.slug]);
    expect((await readJson(await getJson(ctx.app, '/demo-videos/featured'))).data.slug).toBe(other.slug);
    expect(before).not.toBe(other.slug);

    await sendJson(ctx, 'PATCH', `/admin/demo-videos/${other.id}`, { status: 'draft' }, jar);
    expect(await featuredSlugs()).toEqual([]);
    expect((await readJson(await getJson(ctx.app, '/demo-videos/featured'))).data).toBeNull();
    expect((await sendJson(ctx, 'PATCH', `/admin/demo-videos/${other.id}`, { isFeatured: true }, jar)).status).toBe(400);
  });

  it('soft-deletes (off the site, slug reserved); only roles with demos.delete', async () => {
    const [v] = await ctx.db.select().from(demoVideos).where(eq(demoVideos.isFeatured, true));
    const { jar } = await loginAs(ctx, 'content_manager');
    expect((await sendJson(ctx, 'DELETE', `/admin/demo-videos/${v.id}`, {}, jar)).status).toBe(200);
    expect((await getJson(ctx.app, `/demo-videos/${v.slug}`)).status).toBe(404);
    expect((await readJson(await getJson(ctx.app, '/demo-videos/featured'))).data).toBeNull();
    expect((await getJson(ctx.app, `/admin/demo-videos/${v.id}`, jar)).status).toBe(404);
    expect((await postJson(ctx.app, '/admin/demo-videos', newVideo({ slug: v.slug }), jar)).status).toBe(409);
    expect(await ctx.db.$count(activityLogs, eq(activityLogs.action, 'demos.delete'))).toBe(1);
  });
});

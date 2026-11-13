import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { demoVideos as staticVideos } from '../src/data/content';
import { demoVideos } from './db/schema';
import { parseAgo, parseDuration, seedDemoVideos } from './db/seed';
import { browserHeaders, createTestContext, readJson, resetTables } from './test/helpers';

const dbAvailable = inject('dbAvailable');

describe('seed parsing (pure)', () => {
  it('parses mm:ss durations and "N units ago"', () => {
    expect(parseDuration('18:24')).toBe(1104);
    expect(parseDuration('21:15')).toBe(1275);
    const now = new Date('2026-11-13T00:00:00Z');
    expect(parseAgo('2 months ago', now).toISOString()).toBe('2026-09-13T00:00:00.000Z');
    expect(parseAgo('5 weeks ago', now).toISOString()).toBe('2026-10-09T00:00:00.000Z');
    expect(parseAgo('whenever', now)).toEqual(now);
  });
});

describe.skipIf(!dbAvailable)('demo videos (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;
  const get = async (path: string) => readJson(await ctx.app.request(`/api/v1${path}`));

  beforeAll(() => {
    ctx = createTestContext();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetTables(ctx.db);
    await seedDemoVideos(ctx.db, new Date('2026-11-13T00:00:00Z'));
  });

  it('seeds the six static videos with real numbers and one featured video', async () => {
    const rows = await ctx.db.select().from(demoVideos);
    expect(rows).toHaveLength(staticVideos.length);
    const d1 = rows.find((r) => r.slug === 'd1')!;
    expect(d1).toMatchObject({ viewCount: 12480, durationSeconds: 1104, level: 'intermediate', isFeatured: true, featuredKey: 1 });
    expect(rows.filter((r) => r.isFeatured)).toHaveLength(1);
    expect(await seedDemoVideos(ctx.db)).toEqual({ demoVideos: 0 });
  });

  it('lets the database hold only one featured video', async () => {
    await expect(ctx.db.update(demoVideos).set({ isFeatured: true }).where(eq(demoVideos.slug, 'd2'))).rejects.toThrow();
    // Soft-deleting the featured video frees the slot.
    await ctx.db.update(demoVideos).set({ deletedAt: new Date() }).where(eq(demoVideos.slug, 'd1'));
    await ctx.db.update(demoVideos).set({ isFeatured: true }).where(eq(demoVideos.slug, 'd2'));
    expect((await get('/demo-videos/featured')).data.slug).toBe('d2');
  });

  it('lists non-featured videos with counts per category', async () => {
    const res = await get('/demo-videos');
    expect(res.data.map((v: { slug: string }) => v.slug)).toEqual(['d2', 'd3', 'd4', 'd5', 'd6']);
    expect(res.meta).toEqual({
      page: 1,
      pageSize: 12,
      total: 5,
      counts: { all: 5, logical: 2, electrical: 1, mechanical: 1, firmware: 1 },
    });
    expect(res.data[0]).toMatchObject({ slug: 'd2', tag: 'Logical', level: 'beginner', viewCount: 9240, hasVideo: false });
    expect(JSON.stringify(res)).not.toContain('videoId');
  });

  it('filters by category and searches title, tag and tags', async () => {
    expect((await get('/demo-videos?category=logical')).data.map((v: { slug: string }) => v.slug)).toEqual(['d2', 'd6']);
    expect((await get('/demo-videos?q=bitlocker')).data.map((v: { slug: string }) => v.slug)).toEqual(['d6']);
    expect((await get('/demo-videos?q=multimeter')).data.map((v: { slug: string }) => v.slug)).toEqual(['d3']);
    expect((await get('/demo-videos?q=%25')).meta.total).toBe(0);
    const res = await get('/demo-videos?category=firmware&q=partition');
    expect(res.meta.total).toBe(0);
    expect(res.meta.counts.all).toBe(5);
  });

  it('paginates', async () => {
    const p1 = await get('/demo-videos?pageSize=2');
    const p3 = await get('/demo-videos?pageSize=2&page=3');
    expect(p1.data).toHaveLength(2);
    expect(p3.data.map((v: { slug: string }) => v.slug)).toEqual(['d6']);
    expect((await ctx.app.request('/api/v1/demo-videos?pageSize=500')).status).toBe(400);
  });

  it('returns the featured video and a single video by slug', async () => {
    expect((await get('/demo-videos/featured')).data).toMatchObject({ slug: 'd1', isFeatured: true });
    expect((await get('/demo-videos/d4')).data).toMatchObject({ slug: 'd4', embedUrl: null });
    expect((await ctx.app.request('/api/v1/demo-videos/nope')).status).toBe(404);
  });

  it('hides drafts', async () => {
    await ctx.db.update(demoVideos).set({ status: 'draft' }).where(eq(demoVideos.slug, 'd3'));
    expect((await get('/demo-videos')).meta.total).toBe(4);
    expect((await ctx.app.request('/api/v1/demo-videos/d3')).status).toBe(404);
  });

  it('counts a view once per visitor per 30 minutes', async () => {
    const view = async () =>
      readJson(await ctx.app.request('/api/v1/demo-videos/d2/view', { method: 'POST', headers: browserHeaders }));
    expect((await view()).data).toEqual({ viewCount: 9241, counted: true });
    expect((await view()).data).toEqual({ viewCount: 9241, counted: false });
    const [row] = await ctx.db.select().from(demoVideos).where(eq(demoVideos.slug, 'd2'));
    expect(row.viewCount).toBe(9241);
  });
});

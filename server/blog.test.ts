import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { blogPosts as staticPosts } from '../src/data/content';
import { blogPosts } from './db/schema';
import { seedBlogPosts } from './db/seed';
import { createTestContext, readJson, resetTables } from './test/helpers';

const dbAvailable = inject('dbAvailable');

describe.skipIf(!dbAvailable)('blog (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;
  const get = async (path: string) => ctx.app.request(`/api/v1${path}`);

  beforeAll(() => {
    ctx = createTestContext();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetTables(ctx.db);
    await seedBlogPosts(ctx.db);
  });

  it('seeds the three posts (body = excerpt until written) and is insert-only', async () => {
    const rows = await ctx.db.select().from(blogPosts);
    expect(rows).toHaveLength(staticPosts.length);
    const first = rows.find((r) => r.slug === 'when-to-stop-diy-recovery')!;
    expect(first.bodyMarkdown).toBe(first.excerpt);
    expect(first.publishedAt?.toISOString()).toBe('2026-08-12T03:30:00.000Z');
    expect(await seedBlogPosts(ctx.db)).toEqual({ blogPosts: 0 });
  });

  it('lists posts newest first, without bodies', async () => {
    const res = await get('/blog');
    expect(res.headers.get('cache-control')).toContain('s-maxage=300');
    const body = await readJson(res);
    expect(body.data.map((p: { slug: string }) => p.slug)).toEqual(staticPosts.map((p) => p.slug));
    expect(body.data[0].bodyMarkdown).toBeUndefined();
    expect(body.meta).toEqual({ page: 1, pageSize: 10, total: 3 });
  });

  it('hides drafts, deleted posts and posts scheduled for the future', async () => {
    await ctx.db.update(blogPosts).set({ status: 'draft' }).where(eq(blogPosts.slug, 'pcb-swap-checklist'));
    await ctx.db.update(blogPosts).set({ publishedAt: new Date(Date.now() + 86_400_000) }).where(eq(blogPosts.slug, 'bitlocker-without-panic'));
    const body = await readJson(await get('/blog'));
    expect(body.data.map((p: { slug: string }) => p.slug)).toEqual(['when-to-stop-diy-recovery']);
    expect((await get('/blog/pcb-swap-checklist')).status).toBe(404);
    expect((await get('/blog/bitlocker-without-panic')).status).toBe(404);
    await ctx.db.update(blogPosts).set({ deletedAt: new Date() }).where(eq(blogPosts.slug, 'when-to-stop-diy-recovery'));
    expect((await get('/blog/when-to-stop-diy-recovery')).status).toBe(404);
  });

  it('returns a full post with markdown body and SEO fields', async () => {
    await ctx.db
      .update(blogPosts)
      .set({ bodyMarkdown: '## Step 1\n\nImage first.', seoTitle: 'Stop DIY recovery' })
      .where(eq(blogPosts.slug, 'when-to-stop-diy-recovery'));
    const { data } = await readJson(await get('/blog/when-to-stop-diy-recovery'));
    expect(data).toMatchObject({ slug: 'when-to-stop-diy-recovery', bodyMarkdown: '## Step 1\n\nImage first.', seoTitle: 'Stop DIY recovery', seoDescription: null });
  });

  it('paginates and validates', async () => {
    const p2 = await readJson(await get('/blog?pageSize=2&page=2'));
    expect(p2.data).toHaveLength(1);
    expect((await get('/blog?pageSize=500')).status).toBe(400);
    expect((await get('/blog/Not_A_Slug')).status).toBe(400);
  });
});

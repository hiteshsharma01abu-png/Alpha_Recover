import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { activityLogs, blogPosts } from './db/schema';
import { seedBlogPosts } from './db/seed';
import { createTestContext, getJson, loginAs, postJson, readJson, resetTables, sendJson } from './test/helpers';

const dbAvailable = inject('dbAvailable');

const draft = (over: Record<string, unknown> = {}) => ({
  title: 'How SSD TRIM affects recovery',
  slug: 'ssd-trim-recovery',
  excerpt: 'TRIM changes what can be recovered from an SSD. Here is what that means in practice.',
  bodyMarkdown: '## Why TRIM matters\n\nOnce TRIM runs, the controller may wipe freed blocks.',
  ...over,
});

/** "YYYY-MM-DDTHH:mm" in IST, `hours` from now. */
const ist = (hours: number) => new Date(Date.now() + hours * 3_600_000 + 5.5 * 3_600_000).toISOString().slice(0, 16);

describe.skipIf(!dbAvailable)('admin blog API (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;

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

  const site = async (slug: string) => ctx.app.request(`/api/v1/blog/${slug}`);

  it('creates drafts (off the site) with the author, and validates input', async () => {
    const { jar, id: me } = await loginAs(ctx, 'content_manager');
    const res = await postJson(ctx.app, '/admin/blog', draft(), jar);
    expect(res.status).toBe(201);
    const { id } = (await readJson(res)).data;
    const detail = (await readJson(await getJson(ctx.app, `/admin/blog/${id}`, jar))).data;
    expect(detail).toMatchObject({ state: 'draft', slugLocked: false, author: { id: me }, publishedAt: null });
    expect((await site('ssd-trim-recovery')).status).toBe(404);

    expect((await postJson(ctx.app, '/admin/blog', draft(), jar)).status).toBe(409);
    expect((await postJson(ctx.app, '/admin/blog', draft({ slug: 'a-1', excerpt: 'short' }), jar)).status).toBe(400);
    expect((await postJson(ctx.app, '/admin/blog', draft({ slug: 'a-2', coverImageUrl: 'javascript:alert(1)' }), jar)).status).toBe(400);
    expect((await postJson(ctx.app, '/admin/blog', draft({ slug: 'a-3', seoTitle: 'x'.repeat(71) }), jar)).status).toBe(400);
    expect((await postJson(ctx.app, '/admin/blog', draft({ slug: 'a-4', status: 'published' }), jar)).status).toBe(400);
  });

  it('lists with states, counts, word counts and search', async () => {
    const { jar } = await loginAs(ctx, 'admin');
    await postJson(ctx.app, '/admin/blog', draft(), jar);
    const all = await readJson(await getJson(ctx.app, '/admin/blog', jar));
    expect(all.meta.counts).toEqual({ draft: 1, scheduled: 0, published: 3 });
    const mine = all.data.find((p: { slug: string }) => p.slug === 'ssd-trim-recovery');
    expect(mine).toMatchObject({ state: 'draft', words: 12 });
    expect((await readJson(await getJson(ctx.app, '/admin/blog?state=draft', jar))).data).toHaveLength(1);
    expect((await readJson(await getJson(ctx.app, '/admin/blog?q=trim', jar))).data).toHaveLength(1);
    expect((await getJson(ctx.app, '/admin/blog', (await loginAs(ctx, 'support_manager')).jar)).status).toBe(403);
  });

  it('publishes now (site follows), locks the slug, unpublishes keeping the date, republishes', async () => {
    const { jar } = await loginAs(ctx, 'content_manager');
    const { id } = (await readJson(await postJson(ctx.app, '/admin/blog', draft(), jar))).data;
    const pub = await readJson(await postJson(ctx.app, `/admin/blog/${id}/publish`, {}, jar));
    expect(pub.data.state).toBe('published');
    expect((await site('ssd-trim-recovery')).status).toBe(200);

    const res = await sendJson(ctx, 'PATCH', `/admin/blog/${id}`, { slug: 'renamed' }, jar);
    expect(res.status).toBe(422);
    expect((await sendJson(ctx, 'PATCH', `/admin/blog/${id}`, { title: 'How TRIM affects SSD recovery' }, jar)).status).toBe(200);
    expect((await readJson(await site('ssd-trim-recovery'))).data.title).toBe('How TRIM affects SSD recovery');

    expect((await postJson(ctx.app, `/admin/blog/${id}/unpublish`, {}, jar)).status).toBe(200);
    expect((await site('ssd-trim-recovery')).status).toBe(404);
    const [row] = await ctx.db.select().from(blogPosts).where(eq(blogPosts.id, id));
    expect(row.publishedAt?.toISOString()).toBe(pub.data.publishedAt);
    const again = await readJson(await postJson(ctx.app, `/admin/blog/${id}/publish`, {}, jar));
    expect(again.data.publishedAt).toBe(pub.data.publishedAt);

    const actions = (await ctx.db.select({ a: activityLogs.action }).from(activityLogs)).map((r) => r.a);
    expect(actions).toEqual(expect.arrayContaining(['blog.create', 'blog.publish', 'blog.update', 'blog.unpublish']));
  });

  it('changes the slug of a never-published draft, refusing taken ones', async () => {
    const { jar } = await loginAs(ctx, 'admin');
    const { id } = (await readJson(await postJson(ctx.app, '/admin/blog', draft(), jar))).data;
    const [seeded] = await ctx.db.select({ slug: blogPosts.slug }).from(blogPosts).where(eq(blogPosts.status, 'published')).limit(1);
    expect((await sendJson(ctx, 'PATCH', `/admin/blog/${id}`, { slug: seeded.slug }, jar)).status).toBe(409);
    expect((await sendJson(ctx, 'PATCH', `/admin/blog/${id}`, { slug: 'trim-and-ssd-recovery' }, jar)).status).toBe(200);
  });

  it('schedules: hidden until the time, shown as scheduled; empty posts cannot be published', async () => {
    const { jar } = await loginAs(ctx, 'content_manager');
    const { id } = (await readJson(await postJson(ctx.app, '/admin/blog', draft(), jar))).data;
    const res = await readJson(await postJson(ctx.app, `/admin/blog/${id}/publish`, { publishAt: ist(48) }, jar));
    expect(res.data.state).toBe('scheduled');
    expect((await site('ssd-trim-recovery')).status).toBe(404);
    expect((await readJson(await getJson(ctx.app, '/admin/blog?state=scheduled', jar))).data.map((p: { id: string }) => p.id)).toEqual([id]);
    await ctx.db.update(blogPosts).set({ publishedAt: new Date(Date.now() - 1000) }).where(eq(blogPosts.id, id));
    expect((await site('ssd-trim-recovery')).status).toBe(200);

    const empty = (await readJson(await postJson(ctx.app, '/admin/blog', draft({ slug: 'empty-post', bodyMarkdown: '' }), jar))).data;
    expect((await postJson(ctx.app, `/admin/blog/${empty.id}/publish`, {}, jar)).status).toBe(422);
  });

  it('soft-deletes: off the site and the list, slug kept', async () => {
    const { jar } = await loginAs(ctx, 'admin');
    const [post] = await ctx.db.select().from(blogPosts).where(eq(blogPosts.status, 'published')).limit(1);
    expect((await sendJson(ctx, 'DELETE', `/admin/blog/${post.id}`, {}, jar)).status).toBe(200);
    expect((await site(post.slug)).status).toBe(404);
    expect((await getJson(ctx.app, `/admin/blog/${post.id}`, jar)).status).toBe(404);
    expect((await postJson(ctx.app, '/admin/blog', draft({ slug: post.slug }), jar)).status).toBe(409);
  });
});

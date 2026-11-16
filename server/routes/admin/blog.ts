import { and, count, desc, eq, gt, isNull, like, lte, or, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { logActivity } from '../../audit';
import { requireStaff } from '../../auth/middleware';
import type { Database } from '../../db';
import { blogPosts, users } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { istDateTime, siteImageUrl } from '../../lib/inputs';
import { validate } from '../../lib/validate';
import type { AppEnv } from '../../types';

const idParam = z.object({ id: z.uuid() });
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and dashes')
  .max(120);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((v) => v || null);

/** Content fields. Publishing is separate (blog.publish), so these never change what's live by themselves except the text. */
const fields = z.object({
  title: z.string().trim().min(3, 'Enter a title').max(200),
  slug,
  excerpt: z.string().trim().min(20, 'Write at least a sentence').max(400),
  bodyMarkdown: z.string().max(60_000, 'Too long (60,000 characters max)'),
  coverImageUrl: siteImageUrl.nullable(),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
});

const STATES = ['draft', 'scheduled', 'published'] as const;
type State = (typeof STATES)[number];

function stateCondition(s: State, now: Date): SQL {
  if (s === 'draft') return or(eq(blogPosts.status, 'draft'), eq(blogPosts.status, 'archived'))!;
  if (s === 'scheduled') return and(eq(blogPosts.status, 'published'), gt(blogPosts.publishedAt, now))!;
  return and(eq(blogPosts.status, 'published'), lte(blogPosts.publishedAt, now))!;
}

type Row = typeof blogPosts.$inferSelect;
const stateOf = (p: Row, now: Date): State => (p.status !== 'published' ? 'draft' : p.publishedAt && p.publishedAt > now ? 'scheduled' : 'published');

const words = (md: string) => (md.match(/[\p{L}\p{N}]+/gu) ?? []).length;

async function loadPost(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.id, id), isNull(blogPosts.deletedAt)));
  if (!row) throw new AppError('NOT_FOUND', 'Post not found');
  return row;
}

async function assertSlugFree(db: Database, value: string, exceptId?: string) {
  const [taken] = await db.select({ id: blogPosts.id }).from(blogPosts).where(eq(blogPosts.slug, value));
  if (taken && taken.id !== exceptId) throw new AppError('CONFLICT', 'Another post already uses this slug', { details: [{ path: 'slug', message: 'Already used' }] });
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

/** Blog admin module (docs/admin/NAVIGATION.md §3): write, schedule and publish posts. */
export const adminBlogRoutes = new Hono<AppEnv>()
  .get(
    '/blog',
    requireStaff('blog.view'),
    validate(
      'query',
      z.object({
        state: z.enum(STATES).optional(),
        q: z.string().trim().max(100).optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(25),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      const { db } = c.get('deps');
      const now = new Date();
      const base: SQL[] = [isNull(blogPosts.deletedAt)];
      if (q.q) {
        const term = `%${q.q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
        base.push(or(like(blogPosts.title, term), like(blogPosts.slug, term))!);
      }
      const where = and(...base, q.state ? stateCondition(q.state, now) : undefined);
      const [rows, [{ total }], ...counts] = await Promise.all([
        db
          .select({ post: blogPosts, authorName: users.firstName })
          .from(blogPosts)
          .leftJoin(users, eq(users.id, blogPosts.authorId))
          .where(where)
          .orderBy(desc(blogPosts.updatedAt))
          .limit(q.pageSize)
          .offset((q.page - 1) * q.pageSize),
        db.select({ total: count() }).from(blogPosts).where(where),
        ...STATES.map((s) =>
          db
            .select({ n: count() })
            .from(blogPosts)
            .where(and(...base, stateCondition(s, now)))
            .then(([r]) => Number(r.n)),
        ),
      ]);
      return c.json({
        data: rows.map(({ post: p, authorName }) => ({
          id: p.id,
          slug: p.slug,
          title: p.title,
          excerpt: p.excerpt,
          coverImageUrl: p.coverImageUrl,
          state: stateOf(p, now),
          words: words(p.bodyMarkdown),
          author: p.authorId ? { id: p.authorId, firstName: authorName } : null,
          publishedAt: iso(p.publishedAt),
          updatedAt: p.updatedAt.toISOString(),
        })),
        meta: { page: q.page, pageSize: q.pageSize, total: Number(total), counts: Object.fromEntries(STATES.map((s, i) => [s, counts[i]])) as Record<State, number> },
      });
    },
  )

  .get('/blog/:id', requireStaff('blog.view'), validate('param', idParam), async (c) => {
    const { db } = c.get('deps');
    const p = await loadPost(db, c.req.valid('param').id);
    const [author] = p.authorId ? await db.select({ firstName: users.firstName }).from(users).where(eq(users.id, p.authorId)) : [];
    return c.json({
      data: {
        id: p.id,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        bodyMarkdown: p.bodyMarkdown,
        coverImageUrl: p.coverImageUrl,
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        state: stateOf(p, new Date()),
        /** Once a post has been published its slug is fixed: links to it may exist. */
        slugLocked: p.publishedAt !== null,
        author: p.authorId ? { id: p.authorId, firstName: author?.firstName ?? null } : null,
        publishedAt: iso(p.publishedAt),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      },
    });
  })

  /** New posts always start as drafts. */
  .post(
    '/blog',
    requireStaff('blog.add'),
    validate('json', fields.partial({ bodyMarkdown: true, coverImageUrl: true, seoTitle: true, seoDescription: true }).strict()),
    async (c) => {
      const { db } = c.get('deps');
      const input = { bodyMarkdown: '', coverImageUrl: null, seoTitle: null, seoDescription: null, ...c.req.valid('json') };
      await assertSlugFree(db, input.slug);
      const [row] = await db
        .insert(blogPosts)
        .values({ ...input, status: 'draft', authorId: c.get('user')!.id })
        .$returningId();
      await logActivity(c, { action: 'blog.create', entityType: 'blog_post', entityId: row.id, metadata: { slug: input.slug, title: input.title } });
      return c.json({ data: { id: row.id } }, 201);
    },
  )

  /** Edit text and SEO. The slug can change only while the post has never been published. */
  .patch('/blog/:id', requireStaff('blog.edit'), validate('param', idParam), validate('json', fields.partial().strict()), async (c) => {
    const { db } = c.get('deps');
    const p = await loadPost(db, c.req.valid('param').id);
    const input = Object.fromEntries(Object.entries(c.req.valid('json')).filter(([, v]) => v !== undefined)) as Partial<z.infer<typeof fields>>;
    const changed = (Object.keys(input) as (keyof typeof input)[]).filter((k) => input[k] !== p[k]);
    if (!changed.length) return c.json({ data: { ok: true, changed } });
    if (changed.includes('slug')) {
      if (p.publishedAt) throw new AppError('BUSINESS_RULE', 'This post has been published, so its address is fixed (links to it may exist).');
      await assertSlugFree(db, input.slug!, p.id);
    }
    const next = Object.fromEntries(changed.map((k) => [k, input[k]]));
    await db.update(blogPosts).set(next).where(eq(blogPosts.id, p.id));
    // Body text can be long: the audit keeps which fields changed and small values, not whole articles.
    const brief = (o: Record<string, unknown>) => Object.fromEntries(changed.map((k) => [k, k === 'bodyMarkdown' ? `${words(String(o[k] ?? ''))} words` : o[k]]));
    await logActivity(c, { action: 'blog.update', entityType: 'blog_post', entityId: p.id, metadata: { before: brief(p), after: brief(next) } });
    return c.json({ data: { ok: true, changed } });
  })

  /**
   * Publish now, or schedule with `publishAt` (IST). Without `publishAt`, a post that was live before
   * keeps its original date.
   */
  .post(
    '/blog/:id/publish',
    requireStaff('blog.publish'),
    validate('param', idParam),
    validate('json', z.object({ publishAt: istDateTime.optional() }).strict()),
    async (c) => {
      const { db } = c.get('deps');
      const p = await loadPost(db, c.req.valid('param').id);
      const { publishAt } = c.req.valid('json');
      const now = new Date();
      if (!p.bodyMarkdown.trim()) throw new AppError('BUSINESS_RULE', 'Write the article before publishing it.');
      const publishedAt = publishAt ?? (p.publishedAt && p.publishedAt <= now ? p.publishedAt : now);
      await db.update(blogPosts).set({ status: 'published', publishedAt }).where(eq(blogPosts.id, p.id));
      const state: State = publishedAt > now ? 'scheduled' : 'published';
      await logActivity(c, { action: state === 'scheduled' ? 'blog.schedule' : 'blog.publish', entityType: 'blog_post', entityId: p.id, metadata: { slug: p.slug, publishedAt: publishedAt.toISOString() } });
      return c.json({ data: { state, publishedAt: publishedAt.toISOString() } });
    },
  )

  /** Back to draft (off the site). The publish date is kept, so the address stays fixed. */
  .post('/blog/:id/unpublish', requireStaff('blog.publish'), validate('param', idParam), async (c) => {
    const { db } = c.get('deps');
    const p = await loadPost(db, c.req.valid('param').id);
    if (p.status !== 'published') return c.json({ data: { state: 'draft' } });
    await db.update(blogPosts).set({ status: 'draft' }).where(eq(blogPosts.id, p.id));
    await logActivity(c, { action: 'blog.unpublish', entityType: 'blog_post', entityId: p.id, metadata: { slug: p.slug } });
    return c.json({ data: { state: 'draft' } });
  })

  .delete('/blog/:id', requireStaff('blog.delete'), validate('param', idParam), async (c) => {
    const { db } = c.get('deps');
    const p = await loadPost(db, c.req.valid('param').id);
    await db.update(blogPosts).set({ deletedAt: new Date(), status: 'archived' }).where(eq(blogPosts.id, p.id));
    await logActivity(c, { action: 'blog.delete', entityType: 'blog_post', entityId: p.id, metadata: { slug: p.slug, title: p.title } });
    return c.json({ data: { ok: true } });
  });

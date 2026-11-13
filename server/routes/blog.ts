import { and, count, desc, eq, isNull, lte } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { blogPosts } from '../db/schema';
import { AppError } from '../lib/errors';
import { validate } from '../lib/validate';
import type { AppEnv } from '../types';

export type BlogPostSummaryDto = {
  slug: string;
  title: string;
  excerpt: string;
  coverImageUrl: string | null;
  publishedAt: string;
};
export type BlogPostDto = BlogPostSummaryDto & {
  bodyMarkdown: string;
  seoTitle: string | null;
  seoDescription: string | null;
};

/** Published, not deleted, and publish time reached. */
const live = (now: Date) =>
  and(eq(blogPosts.status, 'published'), isNull(blogPosts.deletedAt), lte(blogPosts.publishedAt, now));

const summary = (p: typeof blogPosts.$inferSelect): BlogPostSummaryDto => ({
  slug: p.slug,
  title: p.title,
  excerpt: p.excerpt,
  coverImageUrl: p.coverImageUrl,
  publishedAt: (p.publishedAt ?? p.createdAt).toISOString(),
});

const PUBLIC_CACHE = 'public, max-age=60, s-maxage=300';

/** Blog (docs/API.md §2). */
export const blogRoutes = new Hono<AppEnv>()
  .get(
    '/blog',
    validate(
      'query',
      z.object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(50).default(10),
      }),
    ),
    async (c) => {
      const { page, pageSize } = c.req.valid('query');
      const { db } = c.get('deps');
      const where = live(new Date());
      const [rows, [{ total }]] = await Promise.all([
        db
          .select()
          .from(blogPosts)
          .where(where)
          .orderBy(desc(blogPosts.publishedAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ total: count() }).from(blogPosts).where(where),
      ]);
      c.header('Cache-Control', PUBLIC_CACHE);
      return c.json({ data: rows.map(summary), meta: { page, pageSize, total: Number(total) } });
    },
  )
  .get('/blog/:slug', validate('param', z.object({ slug: z.string().regex(/^[a-z0-9-]{1,120}$/) })), async (c) => {
    const [post] = await c
      .get('deps')
      .db.select()
      .from(blogPosts)
      .where(and(live(new Date()), eq(blogPosts.slug, c.req.valid('param').slug)));
    if (!post) throw new AppError('NOT_FOUND', 'Post not found');
    c.header('Cache-Control', PUBLIC_CACHE);
    const data: BlogPostDto = {
      ...summary(post),
      bodyMarkdown: post.bodyMarkdown,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
    };
    return c.json({ data });
  });

import { and, asc, count, desc, eq, isNull, like, or, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Database } from '../db';
import { DEMO_CATEGORIES, demoVideos } from '../db/schema';
import { AppError } from '../lib/errors';
import { hit } from '../lib/ratelimit';
import { clientIp, hashValue } from '../lib/request';
import { validate } from '../lib/validate';
import type { AppEnv } from '../types';

export type DemoVideoDto = {
  slug: string;
  title: string;
  tag: string;
  category: (typeof DEMO_CATEGORIES)[number];
  level: 'beginner' | 'intermediate' | 'advanced';
  description: string;
  tags: string[];
  durationSeconds: number;
  thumbnailUrl: string | null;
  viewCount: number;
  publishedAt: string | null;
  isFeatured: boolean;
  /** false until a video file is uploaded (the id itself is never exposed). */
  hasVideo: boolean;
};

const toDto = (v: typeof demoVideos.$inferSelect): DemoVideoDto => ({
  slug: v.slug,
  title: v.title,
  tag: v.tag,
  category: v.category,
  level: v.level,
  description: v.description,
  tags: v.tags,
  durationSeconds: v.durationSeconds,
  thumbnailUrl: v.thumbnailUrl,
  viewCount: v.viewCount,
  publishedAt: v.publishedAt?.toISOString() ?? null,
  isFeatured: v.isFeatured,
  hasVideo: Boolean(v.videoId),
});

const visible = () => and(eq(demoVideos.status, 'published'), isNull(demoVideos.deletedAt));
const slugParam = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,64}$/) });
const PUBLIC_CACHE = 'public, max-age=60, s-maxage=120';

async function findBySlug(db: Database, slug: string) {
  const [row] = await db.select().from(demoVideos).where(and(visible(), eq(demoVideos.slug, slug)));
  if (!row) throw new AppError('NOT_FOUND', 'Video not found');
  return row;
}

/** Demo video catalog (docs/API.md §9). */
export const demoVideoRoutes = new Hono<AppEnv>()
  .get(
    '/demo-videos',
    validate(
      'query',
      z.object({
        category: z.enum(DEMO_CATEGORIES).optional(),
        q: z.string().trim().max(100).optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(12),
      }),
    ),
    async (c) => {
      const { category, q, page, pageSize } = c.req.valid('query');
      const { db } = c.get('deps');
      // The featured video has its own slot on the page, so lists and counts leave it out.
      const base = and(visible(), eq(demoVideos.isFeatured, false));
      const term = q ? `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%` : undefined;
      const where = and(
        base,
        category ? eq(demoVideos.category, category) : undefined,
        term ? or(like(demoVideos.title, term), like(demoVideos.tag, term), like(sql`CAST(${demoVideos.tags} AS CHAR)`, term)) : undefined,
      );

      const [rows, [{ total }], byCategory] = await Promise.all([
        db
          .select()
          .from(demoVideos)
          .where(where)
          .orderBy(asc(demoVideos.sortOrder), desc(demoVideos.publishedAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db.select({ total: count() }).from(demoVideos).where(where),
        db.select({ category: demoVideos.category, n: count() }).from(demoVideos).where(base).groupBy(demoVideos.category),
      ]);

      const counts: Record<string, number> = { all: 0, ...Object.fromEntries(DEMO_CATEGORIES.map((k) => [k, 0])) };
      for (const r of byCategory) {
        counts[r.category] = Number(r.n);
        counts.all += Number(r.n);
      }
      c.header('Cache-Control', PUBLIC_CACHE);
      return c.json({ data: rows.map(toDto), meta: { page, pageSize, total: Number(total), counts } });
    },
  )
  .get('/demo-videos/featured', async (c) => {
    const [row] = await c.get('deps').db.select().from(demoVideos).where(and(visible(), eq(demoVideos.isFeatured, true)));
    c.header('Cache-Control', PUBLIC_CACHE);
    return c.json({ data: row ? toDto(row) : null });
  })
  .get('/demo-videos/:slug', validate('param', slugParam), async (c) => {
    const row = await findBySlug(c.get('deps').db, c.req.valid('param').slug);
    c.header('Cache-Control', PUBLIC_CACHE);
    // embedUrl arrives with video hosting (Bunny) in Phase 4.
    return c.json({ data: { ...toDto(row), embedUrl: null } });
  })
  /** Counts at most one view per IP per video every 30 minutes; repeats return the count unchanged. */
  .post('/demo-videos/:slug/view', validate('param', slugParam), async (c) => {
    const { db, env } = c.get('deps');
    const row = await findBySlug(db, c.req.valid('param').slug);
    const key = `view:${row.id}:${hashValue(clientIp(c), env.IP_HASH_SALT).slice(0, 32)}`;
    const { hits } = await hit(db, key, 30 * 60);
    if (hits === 1) {
      await db.update(demoVideos).set({ viewCount: sql`${demoVideos.viewCount} + 1` }).where(eq(demoVideos.id, row.id));
    }
    const [{ viewCount }] = await db.select({ viewCount: demoVideos.viewCount }).from(demoVideos).where(eq(demoVideos.id, row.id));
    return c.json({ data: { viewCount, counted: hits === 1 } });
  });

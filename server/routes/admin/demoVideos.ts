import { and, asc, count, desc, eq, isNull, like, ne, or, sql, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { logActivity } from '../../audit';
import { requireStaff } from '../../auth/middleware';
import type { Database } from '../../db';
import { DEMO_CATEGORIES, PUBLISH_STATUSES, SKILL_LEVELS, demoVideos } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { validate } from '../../lib/validate';
import type { AppEnv } from '../../types';

const idParam = z.object({ id: z.uuid() });

/** A bundled site image ("/assets/…") or an https URL (Bunny CDN once uploads exist). */
const imageUrl = z
  .string()
  .trim()
  .max(500)
  .regex(/^(\/assets\/[\w./-]+|https:\/\/[^\s"'<>]+)$/, 'Use a /assets/… path or an https:// URL');

const fields = z.object({
  title: z.string().trim().min(3, 'Enter a title').max(200),
  tag: z.string().trim().min(2, 'Enter a card label').max(40),
  category: z.enum(DEMO_CATEGORIES),
  level: z.enum(SKILL_LEVELS),
  description: z.string().trim().min(10, 'Write a short description').max(2000),
  tags: z.array(z.string().trim().min(1).max(40)).max(12),
  durationSeconds: z.number().int().min(1, 'Enter the length').max(6 * 3600),
  thumbnailUrl: imageUrl.nullable(),
  status: z.enum(PUBLISH_STATUSES),
  sortOrder: z.number().int().min(0).max(1000),
  /** Only one video is featured; featuring this one unfeatures the other. Published videos only. */
  isFeatured: z.boolean(),
});

type Row = typeof demoVideos.$inferSelect;

const dto = (v: Row) => ({
  id: v.id,
  slug: v.slug,
  title: v.title,
  tag: v.tag,
  category: v.category,
  level: v.level,
  description: v.description,
  tags: v.tags,
  durationSeconds: v.durationSeconds,
  thumbnailUrl: v.thumbnailUrl,
  hasVideo: Boolean(v.videoId),
  viewCount: v.viewCount,
  isFeatured: v.isFeatured,
  status: v.status,
  sortOrder: v.sortOrder,
  publishedAt: v.publishedAt?.toISOString() ?? null,
  updatedAt: v.updatedAt.toISOString(),
});

async function loadVideo(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(demoVideos)
    .where(and(eq(demoVideos.id, id), isNull(demoVideos.deletedAt)));
  if (!row) throw new AppError('NOT_FOUND', 'Video not found');
  return row;
}

const featureNeedsPublish = () =>
  new AppError('VALIDATION_ERROR', 'Only a published video can be featured', { details: [{ path: 'isFeatured', message: 'Publish the video first' }] });

/** Demo videos admin module (docs/admin/NAVIGATION.md §3). Uploads arrive with Bunny (Phase 4). */
export const adminDemoVideoRoutes = new Hono<AppEnv>()
  .get(
    '/demo-videos',
    requireStaff('demos.view'),
    validate(
      'query',
      z.object({
        status: z.enum(PUBLISH_STATUSES).optional(),
        category: z.enum(DEMO_CATEGORIES).optional(),
        q: z.string().trim().max(100).optional(),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      const { db } = c.get('deps');
      const base: SQL[] = [isNull(demoVideos.deletedAt)];
      if (q.category) base.push(eq(demoVideos.category, q.category));
      if (q.q) {
        const term = `%${q.q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
        base.push(or(like(demoVideos.title, term), like(demoVideos.tag, term), like(demoVideos.slug, term), like(sql`CAST(${demoVideos.tags} AS CHAR)`, term))!);
      }
      // The catalog is small (dozens), so the list isn't paginated.
      const [rows, byStatus] = await Promise.all([
        db
          .select()
          .from(demoVideos)
          .where(and(...base, q.status ? eq(demoVideos.status, q.status) : undefined))
          .orderBy(desc(demoVideos.isFeatured), asc(demoVideos.sortOrder), desc(demoVideos.publishedAt))
          .limit(500),
        db.select({ status: demoVideos.status, n: count() }).from(demoVideos).where(and(...base)).groupBy(demoVideos.status),
      ]);
      const counts = Object.fromEntries(PUBLISH_STATUSES.map((s) => [s, Number(byStatus.find((r) => r.status === s)?.n ?? 0)]));
      return c.json({ data: rows.map(dto), meta: { counts } });
    },
  )

  .get('/demo-videos/:id', requireStaff('demos.view'), validate('param', idParam), async (c) => {
    const row = await loadVideo(c.get('deps').db, c.req.valid('param').id);
    return c.json({ data: dto(row) });
  })

  .post(
    '/demo-videos',
    requireStaff('demos.add'),
    validate(
      'json',
      fields
        .partial({ tags: true, thumbnailUrl: true, sortOrder: true, isFeatured: true })
        .extend({ slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and dashes').max(64) })
        .strict(),
    ),
    async (c) => {
      const { db } = c.get('deps');
      const v = { tags: [], thumbnailUrl: null, sortOrder: 0, isFeatured: false, ...c.req.valid('json') };
      if (v.isFeatured && v.status !== 'published') throw featureNeedsPublish();
      const [taken] = await db.select({ id: demoVideos.id }).from(demoVideos).where(eq(demoVideos.slug, v.slug));
      if (taken) throw new AppError('CONFLICT', 'That slug is already used (slugs of deleted videos stay reserved)', { details: [{ path: 'slug', message: 'Already used' }] });

      const id = await db.transaction(async (tx) => {
        if (v.isFeatured) await tx.update(demoVideos).set({ isFeatured: false }).where(eq(demoVideos.isFeatured, true));
        const [row] = await tx
          .insert(demoVideos)
          .values({ ...v, publishedAt: v.status === 'published' ? new Date() : null })
          .$returningId();
        return row.id;
      });
      await logActivity(c, { action: 'demos.create', entityType: 'demo_video', entityId: id, metadata: { slug: v.slug, title: v.title, status: v.status } });
      return c.json({ data: { id } }, 201);
    },
  )

  /** Partial update; the slug is fixed (public links and bundled thumbnails use it). */
  .patch('/demo-videos/:id', requireStaff('demos.edit'), validate('param', idParam), validate('json', fields.partial().strict()), async (c) => {
    const { db } = c.get('deps');
    const v = await loadVideo(db, c.req.valid('param').id);
    const input = Object.fromEntries(Object.entries(c.req.valid('json')).filter(([, x]) => x !== undefined)) as Partial<z.infer<typeof fields>>;
    const status = input.status ?? v.status;
    // Unpublishing the featured video leaves the slot empty rather than featuring a hidden video.
    const isFeatured = status === 'published' ? (input.isFeatured ?? v.isFeatured) : false;
    if (input.isFeatured && status !== 'published') throw featureNeedsPublish();

    const next = { ...input, isFeatured };
    const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(v[k]));
    if (!changed.length) return c.json({ data: { ok: true, changed } });

    await db.transaction(async (tx) => {
      if (isFeatured && !v.isFeatured) await tx.update(demoVideos).set({ isFeatured: false }).where(and(eq(demoVideos.isFeatured, true), ne(demoVideos.id, v.id)));
      await tx
        .update(demoVideos)
        .set({ ...next, ...(status === 'published' && !v.publishedAt ? { publishedAt: new Date() } : {}) })
        .where(eq(demoVideos.id, v.id));
    });
    const pick = (o: Record<string, unknown>) => Object.fromEntries(changed.map((k) => [k, o[k]]));
    await logActivity(c, { action: 'demos.update', entityType: 'demo_video', entityId: v.id, metadata: { before: pick(v), after: pick(next) } });
    return c.json({ data: { ok: true, changed } });
  })

  .delete('/demo-videos/:id', requireStaff('demos.delete'), validate('param', idParam), async (c) => {
    const { db } = c.get('deps');
    const v = await loadVideo(db, c.req.valid('param').id);
    await db.update(demoVideos).set({ deletedAt: new Date(), isFeatured: false, status: 'archived' }).where(eq(demoVideos.id, v.id));
    await logActivity(c, { action: 'demos.delete', entityType: 'demo_video', entityId: v.id, metadata: { slug: v.slug, title: v.title } });
    return c.json({ data: { ok: true } });
  });

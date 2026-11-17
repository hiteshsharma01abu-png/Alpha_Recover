import { and, asc, eq, inArray, isNull, like, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { logActivity } from '../../audit';
import { requireStaff } from '../../auth/middleware';
import type { Database } from '../../db';
import { PUBLISH_STATUSES, courseModules, courses, lessons } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { siteImageUrl } from '../../lib/inputs';
import { validate } from '../../lib/validate';
import type { AppEnv } from '../../types';

const idParam = z.object({ id: z.uuid() });
const slugRule = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and dashes')
  .max(64);

const courseFields = z.object({
  title: z.string().trim().min(3, 'Enter a title').max(160),
  summary: z.string().trim().min(10, 'Write a short summary').max(2000),
  imageUrl: siteImageUrl.nullable(),
  status: z.enum(PUBLISH_STATUSES),
});
const moduleFields = z.object({ title: z.string().trim().min(2, 'Enter a title').max(160) });
const lessonFields = z.object({
  title: z.string().trim().min(2, 'Enter a title').max(200),
  description: z
    .string()
    .trim()
    .max(5000)
    .nullable()
    .transform((v) => v || null),
  durationSeconds: z.number().int().min(1).max(12 * 3600).nullable(),
  isPreview: z.boolean(),
  status: z.enum(PUBLISH_STATUSES),
});

/** "Hard Disk Firmware Basics!" → "hard-disk-firmware-basics" (max 64, never empty). */
function slugify(title: string) {
  const s = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56)
    .replace(/-+$/, '');
  return s || 'item';
}

/** First free slug among `base`, `base-2`, `base-3`… (deleted rows keep theirs: links may exist). */
async function freeSlug(taken: (prefix: string) => Promise<string[]>, base: string) {
  const used = new Set(await taken(base));
  if (!used.has(base)) return base;
  for (let i = 2; ; i += 1) if (!used.has(`${base}-${i}`)) return `${base}-${i}`;
}

const prefixed = (column: typeof courseModules.slug | typeof lessons.slug, base: string) => like(column, `${base.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`);

async function loadCourse(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, id), isNull(courses.deletedAt)));
  if (!row) throw new AppError('NOT_FOUND', 'Course not found');
  return row;
}

async function loadModule(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(courseModules)
    .where(and(eq(courseModules.id, id), isNull(courseModules.deletedAt)));
  if (!row) throw new AppError('NOT_FOUND', 'Module not found');
  await loadCourse(db, row.courseId);
  return row;
}

async function loadLesson(db: Database, id: string) {
  const [row] = await db
    .select()
    .from(lessons)
    .where(and(eq(lessons.id, id), isNull(lessons.deletedAt)));
  if (!row) throw new AppError('NOT_FOUND', 'Lesson not found');
  const mod = await loadModule(db, row.moduleId);
  return { ...row, courseId: mod.courseId };
}

const nextSort = (rows: { n: number | null }[]) => Number(rows[0]?.n ?? -1) + 1;

/** Changed keys between `input` (defined values only) and the current row. */
function diff<T extends Record<string, unknown>>(input: Partial<T>, row: T) {
  const keys = (Object.keys(input) as (keyof T)[]).filter((k) => input[k] !== undefined && input[k] !== row[k]);
  return {
    keys,
    before: Object.fromEntries(keys.map((k) => [k, row[k]])),
    after: Object.fromEntries(keys.map((k) => [k, input[k]])),
  };
}

/**
 * Courses admin module (docs/admin/NAVIGATION.md §3): tracks → modules → lessons. Slugs are made
 * from titles on create and never change (the site uses them in URLs). Videos attach in Phase 4.
 */
export const adminCourseRoutes = new Hono<AppEnv>()
  .get('/courses', requireStaff('courses.view'), async (c) => {
    const { db } = c.get('deps');
    const [courseRows, moduleCounts, lessonCounts] = await Promise.all([
      db.select().from(courses).where(isNull(courses.deletedAt)).orderBy(asc(courses.sortOrder), asc(courses.title)),
      db
        .select({ courseId: courseModules.courseId, n: sql<number>`count(*)` })
        .from(courseModules)
        .where(isNull(courseModules.deletedAt))
        .groupBy(courseModules.courseId),
      db
        .select({
          courseId: courseModules.courseId,
          total: sql<number>`count(*)`,
          published: sql<number>`sum(${lessons.status} = 'published')`,
          withVideo: sql<number>`sum(${lessons.videoId} is not null)`,
          preview: sql<number>`sum(${lessons.isPreview})`,
        })
        .from(lessons)
        .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
        .where(and(isNull(lessons.deletedAt), isNull(courseModules.deletedAt)))
        .groupBy(courseModules.courseId),
    ]);
    return c.json({
      data: courseRows.map((r) => {
        const l = lessonCounts.find((x) => x.courseId === r.id);
        return {
          id: r.id,
          slug: r.slug,
          title: r.title,
          status: r.status,
          sortOrder: r.sortOrder,
          modules: Number(moduleCounts.find((x) => x.courseId === r.id)?.n ?? 0),
          lessons: { total: Number(l?.total ?? 0), published: Number(l?.published ?? 0), withVideo: Number(l?.withVideo ?? 0), preview: Number(l?.preview ?? 0) },
          updatedAt: r.updatedAt.toISOString(),
        };
      }),
    });
  })

  /** Course display order on the site: the full list of course ids, first to last. */
  .put('/courses/order', requireStaff('courses.edit'), validate('json', z.object({ ids: z.array(z.uuid()).min(1).max(200) }).strict()), async (c) => {
    const { db } = c.get('deps');
    const { ids } = c.req.valid('json');
    const current = await db.select({ id: courses.id }).from(courses).where(isNull(courses.deletedAt));
    if (ids.length !== current.length || new Set(ids).size !== ids.length || !current.every((r) => ids.includes(r.id))) {
      throw new AppError('VALIDATION_ERROR', 'Send every course exactly once', { details: [{ path: 'ids', message: 'Must list every course exactly once' }] });
    }
    await db.transaction(async (tx) => {
      for (const [i, id] of ids.entries()) await tx.update(courses).set({ sortOrder: i }).where(eq(courses.id, id));
    });
    await logActivity(c, { action: 'courses.reorder', entityType: 'course', metadata: { ids } });
    return c.json({ data: { ok: true } });
  })

  .get('/courses/:id', requireStaff('courses.view'), validate('param', idParam), async (c) => {
    const { db } = c.get('deps');
    const course = await loadCourse(db, c.req.valid('param').id);
    const moduleRows = await db
      .select()
      .from(courseModules)
      .where(and(eq(courseModules.courseId, course.id), isNull(courseModules.deletedAt)))
      .orderBy(asc(courseModules.sortOrder), asc(courseModules.createdAt));
    const lessonRows = moduleRows.length
      ? await db
          .select()
          .from(lessons)
          .where(and(inArray(lessons.moduleId, moduleRows.map((m) => m.id)), isNull(lessons.deletedAt)))
          .orderBy(asc(lessons.sortOrder), asc(lessons.createdAt))
      : [];
    return c.json({
      data: {
        id: course.id,
        slug: course.slug,
        title: course.title,
        summary: course.summary,
        imageUrl: course.imageUrl,
        status: course.status,
        updatedAt: course.updatedAt.toISOString(),
        modules: moduleRows.map((m) => ({
          id: m.id,
          slug: m.slug,
          title: m.title,
          lessons: lessonRows
            .filter((l) => l.moduleId === m.id)
            .map((l) => ({
              id: l.id,
              slug: l.slug,
              title: l.title,
              description: l.description,
              durationSeconds: l.durationSeconds,
              isPreview: l.isPreview,
              status: l.status,
              // The video id itself stays server-side (docs/SECURITY.md §5).
              hasVideo: Boolean(l.videoId),
            })),
        })),
      },
    });
  })

  .post(
    '/courses',
    requireStaff('courses.add'),
    validate('json', courseFields.partial({ imageUrl: true }).extend({ slug: slugRule }).strict()),
    async (c) => {
      const { db } = c.get('deps');
      const input = { imageUrl: null, ...c.req.valid('json') };
      const [taken] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, input.slug));
      if (taken) throw new AppError('CONFLICT', 'That slug is already used (slugs of deleted courses stay reserved)', { details: [{ path: 'slug', message: 'Already used' }] });
      const [last] = await db.select({ n: sql<number>`max(${courses.sortOrder})` }).from(courses);
      const [row] = await db
        .insert(courses)
        .values({ ...input, sortOrder: nextSort([last]) })
        .$returningId();
      await logActivity(c, { action: 'courses.create', entityType: 'course', entityId: row.id, metadata: { slug: input.slug, title: input.title, status: input.status } });
      return c.json({ data: { id: row.id } }, 201);
    },
  )

  /** Title, summary, image, status. The slug is fixed. */
  .patch('/courses/:id', requireStaff('courses.edit'), validate('param', idParam), validate('json', courseFields.partial().strict()), async (c) => {
    const { db } = c.get('deps');
    const course = await loadCourse(db, c.req.valid('param').id);
    const d = diff(c.req.valid('json'), course);
    if (!d.keys.length) return c.json({ data: { ok: true, changed: [] } });
    await db.update(courses).set(d.after).where(eq(courses.id, course.id));
    await logActivity(c, { action: 'courses.update', entityType: 'course', entityId: course.id, metadata: { before: d.before, after: d.after } });
    return c.json({ data: { ok: true, changed: d.keys } });
  })

  /** Only an empty course can be deleted; otherwise archive it (keeps the history of what was sold). */
  .delete('/courses/:id', requireStaff('courses.delete'), validate('param', idParam), async (c) => {
    const { db } = c.get('deps');
    const course = await loadCourse(db, c.req.valid('param').id);
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(courseModules)
      .where(and(eq(courseModules.courseId, course.id), isNull(courseModules.deletedAt)));
    if (Number(n) > 0) throw new AppError('BUSINESS_RULE', 'This course still has modules. Archive it instead, or delete its modules first.');
    await db.update(courses).set({ deletedAt: new Date(), status: 'archived' }).where(eq(courses.id, course.id));
    await logActivity(c, { action: 'courses.delete', entityType: 'course', entityId: course.id, metadata: { slug: course.slug, title: course.title } });
    return c.json({ data: { ok: true } });
  })

  /**
   * Module and lesson order (and moves between modules) for one course, all at once:
   * `{ modules: [{ id, lessonIds }] }` must list every module and every lesson of the course exactly once.
   */
  .put(
    '/courses/:id/order',
    requireStaff('courses.edit'),
    validate('param', idParam),
    validate('json', z.object({ modules: z.array(z.object({ id: z.uuid(), lessonIds: z.array(z.uuid()).max(500) })).max(200) }).strict()),
    async (c) => {
      const { db } = c.get('deps');
      const course = await loadCourse(db, c.req.valid('param').id);
      const { modules } = c.req.valid('json');
      const moduleRows = await db
        .select({ id: courseModules.id })
        .from(courseModules)
        .where(and(eq(courseModules.courseId, course.id), isNull(courseModules.deletedAt)));
      const lessonRows = moduleRows.length
        ? await db
            .select({ id: lessons.id, moduleId: lessons.moduleId, slug: lessons.slug })
            .from(lessons)
            .where(and(inArray(lessons.moduleId, moduleRows.map((m) => m.id)), isNull(lessons.deletedAt)))
        : [];
      const sentModules = modules.map((m) => m.id);
      const sentLessons = modules.flatMap((m) => m.lessonIds);
      const same = (a: string[], b: { id: string }[]) => a.length === b.length && new Set(a).size === a.length && b.every((r) => a.includes(r.id));
      if (!same(sentModules, moduleRows) || !same(sentLessons, lessonRows)) {
        throw new AppError('CONFLICT', 'The outline changed since you loaded it. Reload and try again.');
      }
      // A lesson moved to another module keeps its slug unless that module already uses it (slugs are
      // unique per module, deleted lessons included); then it gets the next free "-2", "-3"… variant.
      const byId = new Map(lessonRows.map((l) => [l.id, l]));
      const moved = modules.flatMap((m) => m.lessonIds.filter((id) => byId.get(id)!.moduleId !== m.id).map((id) => ({ id, to: m.id })));
      const finalSlug = new Map<string, string>();
      if (moved.length) {
        const targetIds = [...new Set(moved.map((x) => x.to))];
        const all = await db.select({ id: lessons.id, moduleId: lessons.moduleId, slug: lessons.slug }).from(lessons).where(inArray(lessons.moduleId, targetIds));
        const movedIds = new Set(moved.map((x) => x.id));
        const used = new Map(targetIds.map((t) => [t, new Set(all.filter((r) => r.moduleId === t && !movedIds.has(r.id)).map((r) => r.slug))]));
        for (const { id, to } of moved) {
          const taken = used.get(to)!;
          const base = byId.get(id)!.slug;
          let slug = base;
          for (let i = 2; taken.has(slug); i += 1) slug = `${base.slice(0, 58)}-${i}`;
          taken.add(slug);
          finalSlug.set(id, slug);
        }
      }
      await db.transaction(async (tx) => {
        // Park moved lessons on unique temporary slugs first, so swaps between modules never collide mid-way.
        for (const { id } of moved) await tx.update(lessons).set({ slug: `moving-${id}` }).where(eq(lessons.id, id));
        for (const [mi, m] of modules.entries()) {
          await tx.update(courseModules).set({ sortOrder: mi }).where(eq(courseModules.id, m.id));
          for (const [li, lessonId] of m.lessonIds.entries()) {
            await tx
              .update(lessons)
              .set({ sortOrder: li, moduleId: m.id, ...(finalSlug.has(lessonId) ? { slug: finalSlug.get(lessonId) } : {}) })
              .where(eq(lessons.id, lessonId));
          }
        }
      });
      await logActivity(c, { action: 'courses.reorder', entityType: 'course', entityId: course.id, metadata: { modules } });
      return c.json({ data: { ok: true } });
    },
  )

  .post('/courses/:id/modules', requireStaff('courses.add'), validate('param', idParam), validate('json', moduleFields.strict()), async (c) => {
    const { db } = c.get('deps');
    const course = await loadCourse(db, c.req.valid('param').id);
    const { title } = c.req.valid('json');
    const slug = await freeSlug(
      async (base) => (await db.select({ s: courseModules.slug }).from(courseModules).where(and(eq(courseModules.courseId, course.id), prefixed(courseModules.slug, base)))).map((r) => r.s),
      slugify(title),
    );
    const [last] = await db
      .select({ n: sql<number>`max(${courseModules.sortOrder})` })
      .from(courseModules)
      .where(and(eq(courseModules.courseId, course.id), isNull(courseModules.deletedAt)));
    const [row] = await db
      .insert(courseModules)
      .values({ courseId: course.id, slug, title, sortOrder: nextSort([last]) })
      .$returningId();
    await logActivity(c, { action: 'courses.module_create', entityType: 'course_module', entityId: row.id, metadata: { courseId: course.id, slug, title } });
    return c.json({ data: { id: row.id, slug } }, 201);
  })

  .patch('/modules/:id', requireStaff('courses.edit'), validate('param', idParam), validate('json', moduleFields.strict()), async (c) => {
    const { db } = c.get('deps');
    const mod = await loadModule(db, c.req.valid('param').id);
    const d = diff(c.req.valid('json'), mod);
    if (!d.keys.length) return c.json({ data: { ok: true, changed: [] } });
    await db.update(courseModules).set(d.after).where(eq(courseModules.id, mod.id));
    await logActivity(c, { action: 'courses.module_update', entityType: 'course_module', entityId: mod.id, metadata: { courseId: mod.courseId, before: d.before, after: d.after } });
    return c.json({ data: { ok: true, changed: d.keys } });
  })

  /** Only empty modules: lessons are moved or deleted first, so nothing disappears by accident. */
  .delete('/modules/:id', requireStaff('courses.delete'), validate('param', idParam), async (c) => {
    const { db } = c.get('deps');
    const mod = await loadModule(db, c.req.valid('param').id);
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(lessons)
      .where(and(eq(lessons.moduleId, mod.id), isNull(lessons.deletedAt)));
    if (Number(n) > 0) throw new AppError('BUSINESS_RULE', 'This module still has lessons. Move or delete them first.');
    await db.update(courseModules).set({ deletedAt: new Date() }).where(eq(courseModules.id, mod.id));
    await logActivity(c, { action: 'courses.module_delete', entityType: 'course_module', entityId: mod.id, metadata: { courseId: mod.courseId, slug: mod.slug, title: mod.title } });
    return c.json({ data: { ok: true } });
  })

  .post(
    '/modules/:id/lessons',
    requireStaff('courses.add'),
    validate('param', idParam),
    validate('json', lessonFields.partial({ description: true, durationSeconds: true, isPreview: true }).strict()),
    async (c) => {
      const { db } = c.get('deps');
      const mod = await loadModule(db, c.req.valid('param').id);
      const input = { description: null, durationSeconds: null, isPreview: false, ...c.req.valid('json') };
      const slug = await freeSlug(
        async (base) => (await db.select({ s: lessons.slug }).from(lessons).where(and(eq(lessons.moduleId, mod.id), prefixed(lessons.slug, base)))).map((r) => r.s),
        slugify(input.title),
      );
      const [last] = await db
        .select({ n: sql<number>`max(${lessons.sortOrder})` })
        .from(lessons)
        .where(and(eq(lessons.moduleId, mod.id), isNull(lessons.deletedAt)));
      const [row] = await db
        .insert(lessons)
        .values({ ...input, moduleId: mod.id, slug, sortOrder: nextSort([last]) })
        .$returningId();
      await logActivity(c, { action: 'courses.lesson_create', entityType: 'lesson', entityId: row.id, metadata: { courseId: mod.courseId, moduleId: mod.id, slug, title: input.title } });
      return c.json({ data: { id: row.id, slug } }, 201);
    },
  )

  .patch('/lessons/:id', requireStaff('courses.edit'), validate('param', idParam), validate('json', lessonFields.partial().strict()), async (c) => {
    const { db } = c.get('deps');
    const lesson = await loadLesson(db, c.req.valid('param').id);
    const d = diff(c.req.valid('json'), lesson);
    if (!d.keys.length) return c.json({ data: { ok: true, changed: [] } });
    await db.update(lessons).set(d.after).where(eq(lessons.id, lesson.id));
    await logActivity(c, { action: 'courses.lesson_update', entityType: 'lesson', entityId: lesson.id, metadata: { courseId: lesson.courseId, before: d.before, after: d.after } });
    return c.json({ data: { ok: true, changed: d.keys } });
  })

  .delete('/lessons/:id', requireStaff('courses.delete'), validate('param', idParam), async (c) => {
    const { db } = c.get('deps');
    const lesson = await loadLesson(db, c.req.valid('param').id);
    await db.update(lessons).set({ deletedAt: new Date(), status: 'archived' }).where(eq(lessons.id, lesson.id));
    await logActivity(c, { action: 'courses.lesson_delete', entityType: 'lesson', entityId: lesson.id, metadata: { courseId: lesson.courseId, slug: lesson.slug, title: lesson.title } });
    return c.json({ data: { ok: true } });
  });

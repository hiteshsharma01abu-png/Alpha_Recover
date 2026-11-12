import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import type { Database } from '../db';
import { courseModules, courses, lessons } from '../db/schema';
import { AppError } from '../lib/errors';
import { validate } from '../lib/validate';
import type { AppEnv } from '../types';

export type LessonDto = {
  id: string;
  slug: string;
  title: string;
  durationSeconds: number | null;
  isPreview: boolean;
  /** false = no video uploaded yet ("coming soon"). The video id itself is never exposed. */
  hasVideo: boolean;
};
export type ModuleDto = { slug: string; title: string; lessons: LessonDto[] };
export type CourseDto = {
  slug: string;
  title: string;
  summary: string;
  imageUrl: string | null;
  moduleCount: number;
  lessonCount: number;
  totalDurationSeconds: number;
  modules?: ModuleDto[];
};

/** Published, non-deleted catalog in display order. Three queries regardless of size. */
export async function loadCatalog(db: Database, opts: { slug?: string } = {}): Promise<Required<CourseDto>[]> {
  const courseRows = await db
    .select()
    .from(courses)
    .where(and(eq(courses.status, 'published'), isNull(courses.deletedAt), opts.slug ? eq(courses.slug, opts.slug) : undefined))
    .orderBy(asc(courses.sortOrder), asc(courses.title));
  if (!courseRows.length) return [];

  const moduleRows = await db
    .select()
    .from(courseModules)
    .where(and(inArray(courseModules.courseId, courseRows.map((c) => c.id)), isNull(courseModules.deletedAt)))
    .orderBy(asc(courseModules.sortOrder));
  const lessonRows = moduleRows.length
    ? await db
        .select({
          id: lessons.id,
          moduleId: lessons.moduleId,
          slug: lessons.slug,
          title: lessons.title,
          durationSeconds: lessons.durationSeconds,
          isPreview: lessons.isPreview,
          videoId: lessons.videoId,
        })
        .from(lessons)
        .where(and(inArray(lessons.moduleId, moduleRows.map((m) => m.id)), eq(lessons.status, 'published'), isNull(lessons.deletedAt)))
        .orderBy(asc(lessons.sortOrder))
    : [];

  return courseRows.map((c) => {
    const modules: ModuleDto[] = moduleRows
      .filter((m) => m.courseId === c.id)
      .map((m) => ({
        slug: m.slug,
        title: m.title,
        lessons: lessonRows
          .filter((l) => l.moduleId === m.id)
          .map((l) => ({
            id: l.id,
            slug: l.slug,
            title: l.title,
            durationSeconds: l.durationSeconds,
            isPreview: l.isPreview,
            hasVideo: Boolean(l.videoId),
          })),
      }));
    const all = modules.flatMap((m) => m.lessons);
    return {
      slug: c.slug,
      title: c.title,
      summary: c.summary,
      imageUrl: c.imageUrl,
      moduleCount: modules.length,
      lessonCount: all.length,
      totalDurationSeconds: all.reduce((sum, l) => sum + (l.durationSeconds ?? 0), 0),
      modules,
    };
  });
}

const PUBLIC_CACHE = 'public, max-age=60, s-maxage=300, stale-while-revalidate=86400';

/** Course catalog (docs/API.md §4). Access/progress fields are added with auth in Phases 3–4. */
export const catalogRoutes = new Hono<AppEnv>()
  .get('/courses', validate('query', z.object({ include: z.enum(['outline']).optional() })), async (c) => {
    const { include } = c.req.valid('query');
    const catalog = await loadCatalog(c.get('deps').db);
    c.header('Cache-Control', PUBLIC_CACHE);
    const data: CourseDto[] = include === 'outline' ? catalog : catalog.map(({ modules: _modules, ...rest }) => rest);
    return c.json({ data });
  })
  .get('/courses/:slug', validate('param', z.object({ slug: z.string().regex(/^[a-z0-9-]{1,64}$/) })), async (c) => {
    const [course] = await loadCatalog(c.get('deps').db, { slug: c.req.valid('param').slug });
    if (!course) throw new AppError('NOT_FOUND', 'Course not found');
    c.header('Cache-Control', PUBLIC_CACHE);
    return c.json({ data: course });
  });

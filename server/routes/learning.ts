import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { getUser, requireUser } from '../auth/middleware';
import { certificates, courses, enrollments, lessonProgress } from '../db/schema';
import { AppError } from '../lib/errors';
import { validate } from '../lib/validate';
import { accessibleCourseIds, canAccessCourse, liveEnrollment } from '../services/enrollments';
import {
  bunnyEmbedUrl,
  COMPLETION_RATIO,
  courseProgress,
  findPublishedLesson,
  progressFor,
  publishedLessons,
  type OutlineLesson,
} from '../services/learning';
import type { AppEnv } from '../types';

const slugParam = z.string().regex(/^[a-z0-9-]{1,64}$/);
const seconds = z.number().int().min(0);

export const progressInput = z
  .object({ positionSeconds: seconds.optional(), watchedSeconds: seconds.optional(), completed: z.boolean().optional() })
  .strict()
  .refine((v) => v.positionSeconds !== undefined || v.watchedSeconds !== undefined || v.completed !== undefined, 'Nothing to save');

const lessonRef = (l: OutlineLesson) => ({ lessonId: l.id, moduleSlug: l.moduleSlug, lessonSlug: l.slug, lessonTitle: l.title });

/** Lesson playback, progress and the student dashboard (docs/API.md §3–4, Phase 4). */
export const learningRoutes = new Hono<AppEnv>()
  /** Signed video URL. Free previews play for anyone; other lessons need a live enrollment covering the course. */
  .post('/lessons/:id/playback', validate('param', z.object({ id: z.uuid() })), async (c) => {
    const { db, env } = c.get('deps');
    const lesson = await findPublishedLesson(db, c.req.valid('param').id);
    if (!lesson) throw new AppError('NOT_FOUND', 'Lesson not found');
    const user = await getUser(c);
    if (!lesson.isPreview) {
      if (!user) throw new AppError('UNAUTHENTICATED', 'Please log in to watch this lesson');
      if (user.status !== 'active') throw new AppError('FORBIDDEN', 'This account is suspended');
      if (!(await canAccessCourse(db, user.id, lesson.courseId))) throw new AppError('NOT_ENROLLED', 'This lesson is part of a plan you have not purchased');
    }
    if (!lesson.videoId) throw new AppError('CONFLICT', 'This lesson’s video is coming soon');
    const signed = bunnyEmbedUrl(env, lesson.videoId);
    if (!signed) throw new AppError('SERVICE_UNAVAILABLE', 'Video playback is not set up yet');
    const resumeAt = user ? ((await progressFor(db, user.id, [lesson.id])).get(lesson.id)?.positionSeconds ?? 0) : 0;
    c.header('Cache-Control', 'no-store');
    return c.json({ data: { embedUrl: signed.url, expiresAt: signed.expiresAt.toISOString(), resumeAt } });
  })

  /** Your progress in one course, plus whether you can open its lessons (the public course stays cacheable). */
  .get('/me/progress', requireUser(), validate('query', z.object({ course: slugParam })), async (c) => {
    c.header('Cache-Control', 'no-store');
    const { db } = c.get('deps');
    const user = (await getUser(c))!;
    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.slug, c.req.valid('query').course), eq(courses.status, 'published'), isNull(courses.deletedAt)));
    if (!course) throw new AppError('NOT_FOUND', 'Course not found');
    const outline = await publishedLessons(db, [course.id]);
    const progress = await progressFor(db, user.id, outline.map((l) => l.id));
    const lessonsMap = Object.fromEntries(
      [...progress.values()].map((p) => [p.lessonId, { positionSeconds: p.positionSeconds, completed: Boolean(p.completedAt) }]),
    );
    const completed = outline.filter((l) => progress.get(l.id)?.completedAt).length;
    return c.json({
      data: {
        enrolled: await canAccessCourse(db, user.id, course.id),
        lessons: lessonsMap,
        lessonsTotal: outline.length,
        lessonsCompleted: completed,
        progressPct: outline.length ? Math.round((completed / outline.length) * 100) : 0,
      },
    });
  })

  /** Saves the resume point / furthest watched; completes at 90% watched or when marked (and can be unmarked). */
  .put('/me/progress/:lessonId', requireUser(), validate('param', z.object({ lessonId: z.uuid() })), validate('json', progressInput), async (c) => {
    const { db } = c.get('deps');
    const user = (await getUser(c))!;
    const lesson = await findPublishedLesson(db, c.req.valid('param').lessonId);
    if (!lesson) throw new AppError('NOT_FOUND', 'Lesson not found');
    if (!lesson.isPreview && !(await canAccessCourse(db, user.id, lesson.courseId))) {
      throw new AppError('NOT_ENROLLED', 'This lesson is part of a plan you have not purchased');
    }
    const input = c.req.valid('json');
    const max = (lesson.durationSeconds ?? 24 * 60 * 60) + 60;
    for (const key of ['positionSeconds', 'watchedSeconds'] as const) {
      if ((input[key] ?? 0) > max) throw new AppError('VALIDATION_ERROR', 'Position is past the end of the lesson', { details: [{ path: key, message: `At most ${max}` }] });
    }

    const now = new Date();
    const watched = input.watchedSeconds ?? 0;
    const autoComplete = lesson.durationSeconds ? Math.ceil(lesson.durationSeconds * COMPLETION_RATIO) : null;
    // completedAt: explicit true/false wins; otherwise auto-complete once the furthest watched point passes 90%.
    const completedOnInsert = input.completed === true || (input.completed === undefined && autoComplete !== null && watched >= autoComplete) ? now : null;
    const completedOnUpdate =
      input.completed === true
        ? sql`coalesce(${lessonProgress.completedAt}, ${now})`
        : input.completed === false
          ? null
          : autoComplete !== null
            ? sql`case when greatest(${lessonProgress.watchedSeconds}, ${watched}) >= ${autoComplete} then coalesce(${lessonProgress.completedAt}, ${now}) else ${lessonProgress.completedAt} end`
            : sql`${lessonProgress.completedAt}`;

    await db
      .insert(lessonProgress)
      .values({ userId: user.id, lessonId: lesson.id, positionSeconds: input.positionSeconds ?? 0, watchedSeconds: watched, completedAt: completedOnInsert })
      .onDuplicateKeyUpdate({
        set: {
          // Two saves racing can't lower the furthest-watched value: it's computed in SQL.
          ...(input.positionSeconds !== undefined ? { positionSeconds: input.positionSeconds } : {}),
          watchedSeconds: sql`greatest(${lessonProgress.watchedSeconds}, ${watched})`,
          completedAt: completedOnUpdate,
          updatedAt: now,
        },
      });

    const [row] = await db
      .select({ completedAt: lessonProgress.completedAt })
      .from(lessonProgress)
      .where(and(eq(lessonProgress.userId, user.id), eq(lessonProgress.lessonId, lesson.id)));
    const course = await courseProgress(db, user.id, lesson.courseId);
    return c.json({ data: { completedAt: row.completedAt?.toISOString() ?? null, courseProgressPct: course.pct } });
  })

  /** Courses you can open with progress, where to continue, and your certificates. */
  .get('/me/dashboard', requireUser(), async (c) => {
    c.header('Cache-Control', 'no-store');
    const { db } = c.get('deps');
    const user = (await getUser(c))!;
    const accessible = [...(await accessibleCourseIds(db, user.id))];
    const courseRows = accessible.length
      ? await db
          .select({ id: courses.id, slug: courses.slug, title: courses.title })
          .from(courses)
          .where(and(inArray(courses.id, accessible), eq(courses.status, 'published'), isNull(courses.deletedAt)))
          .orderBy(asc(courses.sortOrder), asc(courses.title))
      : [];
    const outline = await publishedLessons(db, courseRows.map((r) => r.id));
    const progress = await progressFor(db, user.id, outline.map((l) => l.id));
    const done = (l: OutlineLesson) => Boolean(progress.get(l.id)?.completedAt);

    const dashboardCourses = courseRows.map((course) => {
      const list = outline.filter((l) => l.courseId === course.id);
      const completed = list.filter(done).length;
      const next = list.find((l) => !done(l));
      return {
        slug: course.slug,
        title: course.title,
        lessonsTotal: list.length,
        lessonsCompleted: completed,
        progressPct: list.length ? Math.round((completed / list.length) * 100) : 0,
        next: next ? lessonRef(next) : null,
      };
    });

    // Continue where you last were; if that lesson is finished, the next unfinished one in the same course.
    let cont: (ReturnType<typeof lessonRef> & { courseSlug: string; positionSeconds: number }) | null = null;
    const latest = [...progress.values()].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
    if (latest) {
      const lesson = outline.find((l) => l.id === latest.lessonId)!;
      const courseSlug = courseRows.find((r) => r.id === lesson.courseId)!.slug;
      if (!latest.completedAt) cont = { courseSlug, ...lessonRef(lesson), positionSeconds: latest.positionSeconds };
      else {
        const list = outline.filter((l) => l.courseId === lesson.courseId);
        const after = list.slice(list.indexOf(lesson) + 1).find((l) => !done(l)) ?? list.find((l) => !done(l));
        if (after) cont = { courseSlug, ...lessonRef(after), positionSeconds: progress.get(after.id)?.positionSeconds ?? 0 };
      }
    }
    if (!cont) {
      const first = dashboardCourses.find((d) => d.next);
      if (first?.next) cont = { courseSlug: first.slug, ...first.next, positionSeconds: 0 };
    }

    const certs = await db
      .select({ code: certificates.code, programTitle: certificates.programTitle, issuedAt: certificates.issuedAt })
      .from(certificates)
      .where(and(eq(certificates.userId, user.id), eq(certificates.status, 'valid')))
      .orderBy(desc(certificates.issuedAt));
    const live = await db.$count(enrollments, and(eq(enrollments.userId, user.id), liveEnrollment(new Date())));

    return c.json({
      data: {
        courses: dashboardCourses,
        continue: cont,
        certificates: certs.map((x) => ({ ...x, issuedAt: x.issuedAt.toISOString() })),
        hasActiveEnrollment: live > 0,
      },
    });
  });

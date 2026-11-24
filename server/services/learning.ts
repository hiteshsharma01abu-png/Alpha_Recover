import { createHash } from 'node:crypto';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { Database } from '../db';
import { courseModules, courses, lessonProgress, lessons } from '../db/schema';
import type { Env } from '../env';

export type OutlineLesson = {
  id: string;
  courseId: string;
  moduleSlug: string;
  slug: string;
  title: string;
  durationSeconds: number | null;
  isPreview: boolean;
};

/** Published, non-deleted lessons of the given courses, in site order (module order, then lesson order). */
export async function publishedLessons(db: Database, courseIds: string[]): Promise<OutlineLesson[]> {
  if (!courseIds.length) return [];
  return db
    .select({
      id: lessons.id,
      courseId: courseModules.courseId,
      moduleSlug: courseModules.slug,
      slug: lessons.slug,
      title: lessons.title,
      durationSeconds: lessons.durationSeconds,
      isPreview: lessons.isPreview,
    })
    .from(lessons)
    .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
    .where(
      and(inArray(courseModules.courseId, courseIds), isNull(courseModules.deletedAt), eq(lessons.status, 'published'), isNull(lessons.deletedAt)),
    )
    .orderBy(asc(courseModules.courseId), asc(courseModules.sortOrder), asc(lessons.sortOrder));
}

/** The lesson with its module and course, if all three are visible on the site. */
export async function findPublishedLesson(db: Database, lessonId: string) {
  const [row] = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      videoId: lessons.videoId,
      videoProvider: lessons.videoProvider,
      durationSeconds: lessons.durationSeconds,
      isPreview: lessons.isPreview,
      courseId: courses.id,
    })
    .from(lessons)
    .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
    .innerJoin(courses, eq(courses.id, courseModules.courseId))
    .where(
      and(
        eq(lessons.id, lessonId),
        eq(lessons.status, 'published'),
        isNull(lessons.deletedAt),
        isNull(courseModules.deletedAt),
        eq(courses.status, 'published'),
        isNull(courses.deletedAt),
      ),
    );
  return row;
}

export type ProgressRow = typeof lessonProgress.$inferSelect;

/** The user's progress rows for these lessons, keyed by lesson id. */
export async function progressFor(db: Database, userId: string, lessonIds: string[]) {
  if (!lessonIds.length) return new Map<string, ProgressRow>();
  const rows = await db
    .select()
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), inArray(lessonProgress.lessonId, lessonIds)));
  return new Map(rows.map((r) => [r.lessonId, r]));
}

/** Completed / total published lessons of a course, as a whole percentage. */
export async function courseProgress(db: Database, userId: string, courseId: string) {
  const outline = await publishedLessons(db, [courseId]);
  const progress = await progressFor(db, userId, outline.map((l) => l.id));
  const completed = outline.filter((l) => progress.get(l.id)?.completedAt).length;
  return { total: outline.length, completed, pct: outline.length ? Math.round((completed / outline.length) * 100) : 0 };
}

/** Watching this much of a lesson counts as completing it (docs/DATABASE.md §8). */
export const COMPLETION_RATIO = 0.9;

/** Lesson videos play from 2-hour signed Bunny Stream embed URLs (token = sha256(key + videoId + expires)). */
export const PLAYBACK_TTL_SECONDS = 2 * 60 * 60;

export function bunnyEmbedUrl(env: Pick<Env, 'BUNNY_STREAM_LIBRARY_ID' | 'BUNNY_STREAM_TOKEN_KEY'>, videoId: string, now = new Date()) {
  if (!env.BUNNY_STREAM_LIBRARY_ID || !env.BUNNY_STREAM_TOKEN_KEY) return null;
  const expires = Math.floor(now.getTime() / 1000) + PLAYBACK_TTL_SECONDS;
  const token = createHash('sha256').update(`${env.BUNNY_STREAM_TOKEN_KEY}${videoId}${expires}`).digest('hex');
  // Bunny's current embed host is player.mediadelivery.net (iframe.mediadelivery.net still resolves but can 403 with token auth).
  const url = `https://player.mediadelivery.net/embed/${encodeURIComponent(env.BUNNY_STREAM_LIBRARY_ID)}/${encodeURIComponent(videoId)}?token=${token}&expires=${expires}`;
  return { url, expiresAt: new Date(expires * 1000) };
}

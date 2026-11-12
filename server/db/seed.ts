/**
 * Seeds catalog data from the original static content (src/data/content.ts).
 * Insert-only: existing rows (matched by slug) are never updated, so admin edits survive re-runs.
 * Run: `npm run db:seed` (dev) or `node dist-server/seed.mjs` (production, after migrate).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq } from 'drizzle-orm';
import { trainingTracks, type TrainingTrack } from '../../src/data/content';
import { createDb, type Database } from './index';
import { courseModules, courses, lessons } from './schema';

export async function seedCatalog(db: Database, tracks: TrainingTrack[] = trainingTracks) {
  const counts = { courses: 0, modules: 0, lessons: 0 };
  for (const [ci, track] of tracks.entries()) {
    const inserted = await db
      .insert(courses)
      .ignore()
      .values({ slug: track.id, title: track.title, summary: track.summary, sortOrder: ci, status: 'published' });
    counts.courses += inserted[0].affectedRows;
    const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, track.id));

    for (const [mi, mod] of track.modules.entries()) {
      const m = await db
        .insert(courseModules)
        .ignore()
        .values({ courseId: course.id, slug: mod.id, title: mod.title, sortOrder: mi });
      counts.modules += m[0].affectedRows;
      const [row] = await db
        .select({ id: courseModules.id })
        .from(courseModules)
        .where(and(eq(courseModules.courseId, course.id), eq(courseModules.slug, mod.id)));

      if (mod.lessons.length) {
        const l = await db
          .insert(lessons)
          .ignore()
          .values(
            mod.lessons.map((lesson, li) => ({
              moduleId: row.id,
              slug: lesson.id,
              title: lesson.title,
              sortOrder: li,
              // Titles are public today; playback needs a video (Phase 4), shown as "coming soon" until then.
              status: 'published' as const,
            })),
          );
        counts.lessons += l[0].affectedRows;
      }
    }
  }
  return counts;
}

const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntry) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const { db, pool } = createDb(url);
  seedCatalog(db)
    .then((c) => console.log(`Seeded (new rows): ${c.courses} courses, ${c.modules} modules, ${c.lessons} lessons`))
    .catch((err: unknown) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

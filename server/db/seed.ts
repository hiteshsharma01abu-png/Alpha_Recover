/**
 * Seeds catalog, pricing and demo video data from the original static content (src/data/content.ts).
 * Insert-only: existing rows (matched by slug) are never updated, so admin edits survive re-runs.
 * Run: `npm run db:seed` (dev) or `node dist-server/seed.mjs` (production, after migrate).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq } from 'drizzle-orm';
import { demoVideos as staticDemoVideos, pricing, trainingTracks, type TrainingTrack } from '../../src/data/content';
import { createDb, type Database } from './index';
import { courseModules, courses, demoVideos, lessons, plans, promotions } from './schema';

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

/**
 * The Professional Plan at its regular price, plus the current sale as a promotion.
 * The promotion is created only together with a new plan, so re-runs never duplicate it.
 */
export async function seedPlans(db: Database) {
  const inserted = await db
    .insert(plans)
    .ignore()
    .values({
      slug: 'professional',
      name: pricing.name,
      pricePaise: pricing.was * 100,
      currency: pricing.currency,
      features: pricing.features,
      mobileFeatureOrder: pricing.mobileFeatureOrder,
      grantsAllCourses: true,
      accessDays: null,
      status: 'published',
    });
  const created = inserted[0].affectedRows === 1;
  if (created) {
    const [plan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.slug, 'professional'));
    await db.insert(promotions).values({
      planId: plan.id,
      label: pricing.saleLabel,
      salePricePaise: pricing.now * 100,
      startsAt: new Date(pricing.saleStartsAt),
      endsAt: new Date(pricing.saleEndsAt),
    });
  }
  return { plans: created ? 1 : 0, promotions: created ? 1 : 0 };
}

/** "18:24" → 1104 seconds. */
export function parseDuration(mmss: string): number {
  const [m, sec] = mmss.split(':').map(Number);
  return m * 60 + (sec || 0);
}

/** "2 months ago" / "5 weeks ago" → a Date that far before `now`. */
export function parseAgo(text: string, now = new Date()): Date {
  const match = /^(\d+)\s+(day|week|month|year)s?\s+ago$/.exec(text.trim());
  if (!match) return now;
  const n = Number(match[1]);
  const d = new Date(now);
  if (match[2] === 'day') d.setUTCDate(d.getUTCDate() - n);
  if (match[2] === 'week') d.setUTCDate(d.getUTCDate() - 7 * n);
  if (match[2] === 'month') d.setUTCMonth(d.getUTCMonth() - n);
  if (match[2] === 'year') d.setUTCFullYear(d.getUTCFullYear() - n);
  return d;
}

/** The six demo videos from content.ts (no video files yet: they show as "coming soon"). */
export async function seedDemoVideos(db: Database, now = new Date()) {
  const inserted = await db
    .insert(demoVideos)
    .ignore()
    .values(
      staticDemoVideos.map((v, i) => ({
        slug: v.id,
        title: v.title,
        tag: v.tag,
        category: v.category,
        description: v.description,
        tags: v.tags,
        level: v.level.toLowerCase() as 'beginner' | 'intermediate' | 'advanced',
        durationSeconds: parseDuration(v.durationLong),
        viewCount: Number(v.views.replace(/\D/g, '')),
        isFeatured: Boolean('featured' in v && v.featured),
        status: 'published' as const,
        publishedAt: parseAgo(v.uploaded, now),
        sortOrder: i,
      })),
    );
  return { demoVideos: inserted[0].affectedRows };
}

const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntry) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const { db, pool } = createDb(url);
  Promise.all([seedCatalog(db), seedPlans(db), seedDemoVideos(db)])
    .then(([c, p, v]) =>
      console.log(
        `Seeded (new rows): ${c.courses} courses, ${c.modules} modules, ${c.lessons} lessons, ${p.plans} plans, ${p.promotions} promotions, ${v.demoVideos} demo videos`,
      ),
    )
    .catch((err: unknown) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

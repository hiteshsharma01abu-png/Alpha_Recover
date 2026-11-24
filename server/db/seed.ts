/**
 * Seeds catalog, pricing, demo video, blog and settings data from the original static content (src/data/content.ts).
 * Insert-only: existing rows (matched by slug) are never updated, so admin edits survive re-runs.
 * Run: `npm run db:seed` (dev) or `node dist-server/seed.mjs` (production, after migrate).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { and, eq } from 'drizzle-orm';
import {
  blogPosts as staticBlogPosts,
  company,
  demoVideos as staticDemoVideos,
  pricing,
  pricingPlans,
  socialLinks,
  trainingTracks,
  type TrainingTrack,
} from '../../src/data/content';
import { createDb, type Database } from './index';
import {
  blogPosts,
  courseModules,
  courses,
  demoVideos,
  lessons,
  planCourses,
  plans,
  promotions,
  siteSettings,
} from './schema';

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
 * Essential / Professional / Expert plans. Insert-only by slug (admin edits survive re-runs).
 * Professional sale promotion is created only when the Professional plan row is newly inserted.
 * Essential links plan_courses to logical / basics / electronics when that plan is created.
 */
export async function seedPlans(db: Database) {
  let plansCreated = 0;
  let promotionsCreated = 0;
  let planCourseLinks = 0;

  for (const def of pricingPlans) {
    const inserted = await db
      .insert(plans)
      .ignore()
      .values({
        slug: def.slug,
        name: def.name,
        description: def.audience,
        pricePaise: def.priceInr * 100,
        compareAtPaise: def.compareInr && def.compareInr > def.priceInr ? def.compareInr * 100 : null,
        currency: pricing.currency,
        features: def.features,
        mobileFeatureOrder: def.mobileFeatureOrder,
        grantsAllCourses: def.grantsAllCourses,
        accessDays: null,
        status: 'published',
        sortOrder: def.sortOrder,
      });
    const created = inserted[0].affectedRows === 1;
    if (created) plansCreated += 1;

    const [plan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.slug, def.slug));
    if (!plan) continue;

    if (created && def.slug === 'professional') {
      await db.insert(promotions).values({
        planId: plan.id,
        label: pricing.saleLabel,
        salePricePaise: pricing.now * 100,
        startsAt: new Date(pricing.saleStartsAt),
        endsAt: new Date(pricing.saleEndsAt),
      });
      promotionsCreated += 1;
    }

    if (created && def.courseSlugs?.length) {
      for (const courseSlug of def.courseSlugs) {
        const [course] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, courseSlug));
        if (!course) continue;
        const link = await db.insert(planCourses).ignore().values({ planId: plan.id, courseId: course.id });
        planCourseLinks += link[0].affectedRows;
      }
    }
  }

  return { plans: plansCreated, promotions: promotionsCreated, planCourses: planCourseLinks };
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

/** The three posts from content.ts. Only excerpts exist, so each body starts as its excerpt until written. */
export async function seedBlogPosts(db: Database) {
  const inserted = await db
    .insert(blogPosts)
    .ignore()
    .values(
      staticBlogPosts.map((p) => ({
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        bodyMarkdown: p.excerpt,
        status: 'published' as const,
        publishedAt: new Date(`${p.date}T09:00:00+05:30`),
      })),
    );
  return { blogPosts: inserted[0].affectedRows };
}

/** Public contact details and social links (insert-only: admin edits are never overwritten). */
export async function seedSettings(db: Database) {
  const inserted = await db
    .insert(siteSettings)
    .ignore()
    .values([
      { key: 'company', value: company, isPublic: true },
      { key: 'social_links', value: socialLinks, isPublic: true },
    ]);
  return { settings: inserted[0].affectedRows };
}

const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntry) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  const { db, pool } = createDb(url);
  // Catalog before plans so Essential plan_courses can resolve course slugs.
  seedCatalog(db)
    .then(async (c) => {
      const [p, v, b, s] = await Promise.all([
        seedPlans(db),
        seedDemoVideos(db),
        seedBlogPosts(db),
        seedSettings(db),
      ]);
      console.log(
        `Seeded (new rows): ${c.courses} courses, ${c.modules} modules, ${c.lessons} lessons, ${p.plans} plans, ${p.promotions} promotions, ${p.planCourses} plan_courses, ${v.demoVideos} demo videos, ${b.blogPosts} blog posts, ${s.settings} settings`,
      );
    })
    .catch((err: unknown) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

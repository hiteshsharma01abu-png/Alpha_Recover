import { and, count, desc, eq, gte, isNotNull, isNull, sql, sum } from 'drizzle-orm';
import { Hono } from 'hono';
import { getUser } from '../../auth/middleware';
import { can } from '../../auth/permissions';
import { blogPosts, courses, demoVideos, leads, lessons, notificationJobs, users } from '../../db/schema';
import { loadPlans } from '../../services/pricing';
import type { AppEnv } from '../../types';

const n = (v: unknown) => Number(v ?? 0);

/**
 * GET /admin/dashboard — KPI widgets. Each block is included only if the role may open that module,
 * so a Content Manager never receives lead or revenue data (docs/admin/NAVIGATION.md §2).
 */
export const adminDashboardRoutes = new Hono<AppEnv>().get('/dashboard', async (c) => {
  c.header('Cache-Control', 'no-store');
  const { db } = c.get('deps');
  const { role } = (await getUser(c))!;
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const data: Record<string, unknown> = {};

  if (can(role, 'leads.view')) {
    const live = isNull(leads.deletedAt);
    const [[{ total }], [{ fresh }], [{ week }], recent] = await Promise.all([
      db.select({ total: count() }).from(leads).where(and(live, sql`${leads.status} <> 'spam'`)),
      db.select({ fresh: count() }).from(leads).where(and(live, eq(leads.status, 'new'))),
      db.select({ week: count() }).from(leads).where(and(live, gte(leads.createdAt, weekAgo), sql`${leads.status} <> 'spam'`)),
      db
        .select({ id: leads.id, name: leads.name, phone: leads.phone, source: leads.source, reason: leads.reason, status: leads.status, createdAt: leads.createdAt })
        .from(leads)
        .where(and(live, sql`${leads.status} <> 'spam'`))
        .orderBy(desc(leads.createdAt))
        .limit(5),
    ]);
    data.leads = { total: n(total), new: n(fresh), last7Days: n(week), recent: recent.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) };
  }

  if (can(role, 'students.view')) {
    const students = eq(users.role, 'student');
    const [[{ total }], [{ week }]] = await Promise.all([
      db.select({ total: count() }).from(users).where(and(students, isNull(users.deletedAt))),
      db.select({ week: count() }).from(users).where(and(students, gte(users.createdAt, weekAgo))),
    ]);
    data.students = { total: n(total), last7Days: n(week) };
  }

  if (can(role, 'courses.view')) {
    const published = eq(lessons.status, 'published');
    const [[{ tracks }], [{ total }], [{ withVideo }], [{ posts }], [{ excerptOnly }]] = await Promise.all([
      db.select({ tracks: count() }).from(courses).where(and(eq(courses.status, 'published'), isNull(courses.deletedAt))),
      db.select({ total: count() }).from(lessons).where(and(published, isNull(lessons.deletedAt))),
      db.select({ withVideo: count() }).from(lessons).where(and(published, isNull(lessons.deletedAt), isNotNull(lessons.videoId))),
      db.select({ posts: count() }).from(blogPosts).where(and(eq(blogPosts.status, 'published'), isNull(blogPosts.deletedAt))),
      db
        .select({ excerptOnly: count() })
        .from(blogPosts)
        .where(and(isNull(blogPosts.deletedAt), sql`${blogPosts.bodyMarkdown} = ${blogPosts.excerpt}`)),
    ]);
    data.content = { tracks: n(tracks), lessons: n(total), lessonsWithVideo: n(withVideo), blogPosts: n(posts), blogPostsExcerptOnly: n(excerptOnly) };
  }

  if (can(role, 'demos.view')) {
    const [{ videos, views }] = await db
      .select({ videos: count(), views: sum(demoVideos.viewCount) })
      .from(demoVideos)
      .where(and(eq(demoVideos.status, 'published'), isNull(demoVideos.deletedAt)));
    data.demoVideos = { published: n(videos), totalViews: n(views) };
  }

  if (can(role, 'plans.view')) {
    const [plan] = await loadPlans(db, { slug: 'professional' });
    data.pricing = plan
      ? { plan: plan.name, effectivePricePaise: plan.effectivePricePaise, pricePaise: plan.pricePaise, promotion: plan.promotion }
      : null;
  }

  if (can(role, 'notifications.view')) {
    const [[{ dead }], [{ pending }]] = await Promise.all([
      db.select({ dead: count() }).from(notificationJobs).where(eq(notificationJobs.status, 'dead')),
      db.select({ pending: count() }).from(notificationJobs).where(eq(notificationJobs.status, 'pending')),
    ]);
    data.email = { failed: n(dead), queued: n(pending) };
  }

  return c.json({ data });
});

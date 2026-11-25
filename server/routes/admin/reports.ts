import { and, count, countDistinct, desc, eq, gte, isNull, lt, ne, sql, type Column, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { can } from '../../../shared/permissions';
import { REPORT_ACCESS, REPORT_INTERVALS, REPORT_TYPES, type ReportInterval, type ReportType } from '../../../shared/reports';
import { logActivity } from '../../audit';
import { requireStaff } from '../../auth/middleware';
import type { Database } from '../../db';
import { certificates, courseModules, courses, demoVideos, enrollments, leads, lessonProgress, lessons, orders, payments, plans, users } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { csvCell } from '../../lib/mask';
import { validate } from '../../lib/validate';
import { liveEnrollment } from '../../services/enrollments';
import type { AppEnv } from '../../types';

const DAY = 86_400_000;
const MAX_DAYS = 731;
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const typeParam = z.object({ type: z.enum(REPORT_TYPES) });
const rangeQuery = z.object({ from: ymd.optional(), to: ymd.optional(), interval: z.enum(REPORT_INTERVALS).default('day') });
type RangeInput = z.infer<typeof rangeQuery>;

const istToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const istMidnight = (d: string) => new Date(`${d}T00:00:00+05:30`);

type Range = { from: string; to: string; interval: ReportInterval; start: Date; end: Date; buckets: string[] };

/** Defaults to the last 30 India days; at most two years. */
function resolveRange(q: RangeInput): Range {
  const to = q.to ?? istToday();
  const from = q.from ?? addDays(to, -29);
  const days = (Date.parse(to) - Date.parse(from)) / DAY + 1;
  if (days < 1) throw new AppError('VALIDATION_ERROR', '“From” must be on or before “To”', { details: [{ path: 'from', message: 'After “To”' }] });
  if (days > MAX_DAYS) throw new AppError('VALIDATION_ERROR', 'Choose at most two years', { details: [{ path: 'from', message: 'Range too long' }] });
  const keys: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const k = bucketOf(d, q.interval);
    if (keys[keys.length - 1] !== k) keys.push(k);
  }
  return { from, to, interval: q.interval, start: istMidnight(from), end: new Date(istMidnight(to).getTime() + DAY), buckets: keys };
}

/** The bucket key (first day of the day/week/month, YYYY-MM-DD) for an India date. Weeks start on Monday. */
function bucketOf(day: string, interval: ReportInterval) {
  if (interval === 'month') return `${day.slice(0, 7)}-01`;
  if (interval === 'week') {
    const dow = (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
    return addDays(day, -dow);
  }
  return day;
}

/** Same bucket key computed in SQL from a UTC column (IST = UTC+5:30, no daylight saving). */
function bucketSql(col: Column, interval: ReportInterval): SQL<string> {
  const local = sql`date_add(${col}, interval 330 minute)`;
  if (interval === 'month') return sql<string>`date_format(${local}, '%Y-%m-01')`;
  if (interval === 'week') return sql<string>`date_format(date_sub(date(${local}), interval weekday(${local}) day), '%Y-%m-%d')`;
  return sql<string>`date_format(${local}, '%Y-%m-%d')`;
}

const inRange = (col: Column, r: Range) => and(gte(col, r.start), lt(col, r.end))!;
const fill = (r: Range, rows: { bucket: string; n: number | string }[]) => r.buckets.map((bucket) => ({ bucket, count: Number(rows.find((x) => x.bucket === bucket)?.n ?? 0) }));
const tally = (rows: { key: string | null; n: number | string }[]) =>
  rows.map((r) => ({ key: r.key ?? 'unknown', count: Number(r.n) })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

/** `of` = out of how many (e.g. lessons with video out of all lessons in a track). */
type Breakdown = { key: string; count: number; of?: number }[];
type Report = {
  range?: { from: string; to: string; interval: ReportInterval };
  /** Headline numbers for the stat tiles. */
  totals: Record<string, number>;
  series?: { label: string; points: { bucket: string; count: number }[] };
  breakdowns: Record<string, Breakdown>;
  note?: string;
};

/**
 * Revenue in rupees (whole rupees; paise are rounded): paid orders by payment date, refunds by refund
 * date, net per bucket = paid − refunded. Breakdowns count paid orders by plan and payment method.
 */
async function revenueReport(db: Database, r: Range): Promise<Report> {
  const paid = and(sql`${orders.paidAt} is not null`, inRange(orders.paidAt, r));
  const refunded = and(sql`${payments.refundedAt} is not null`, inRange(payments.refundedAt, r));
  const pb = bucketSql(orders.paidAt, r.interval);
  const rb = bucketSql(payments.refundedAt, r.interval);
  const [inSeries, outSeries, [inTot], [outTot], byPlan, byMethod] = await Promise.all([
    db.select({ bucket: pb, n: sql<number>`sum(${orders.amountPaise})` }).from(orders).where(paid).groupBy(pb),
    db.select({ bucket: rb, n: sql<number>`sum(${payments.refundedPaise})` }).from(payments).where(refunded).groupBy(rb),
    db.select({ n: count(), sum: sql<number>`coalesce(sum(${orders.amountPaise}), 0)` }).from(orders).where(paid),
    db.select({ n: count(), sum: sql<number>`coalesce(sum(${payments.refundedPaise}), 0)` }).from(payments).where(refunded),
    db.select({ key: plans.name, n: count() }).from(orders).innerJoin(plans, eq(plans.id, orders.planId)).where(paid).groupBy(plans.name),
    // The successful payment of each paid order (failed attempts don't count)
    db
      .select({ key: payments.method, n: countDistinct(orders.id) })
      .from(orders)
      .innerJoin(payments, and(eq(payments.orderId, orders.id), ne(payments.status, 'failed')))
      .where(paid)
      .groupBy(payments.method),
  ]);
  const rupees = (paise: number | string | null) => Math.round(Number(paise ?? 0) / 100);
  const gross = rupees(inTot.sum);
  const refunds = rupees(outTot.sum);
  const paidOrders = Number(inTot.n);
  return {
    totals: { netInr: gross - refunds, grossInr: gross, refundsInr: refunds, paidOrders, refundCount: Number(outTot.n), averageOrderInr: paidOrders ? Math.round(gross / paidOrders) : 0 },
    series: {
      label: 'Net revenue (₹, paid minus refunds)',
      points: r.buckets.map((bucket) => ({
        bucket,
        count: rupees(inSeries.find((x) => x.bucket === bucket)?.n ?? 0) - rupees(outSeries.find((x) => x.bucket === bucket)?.n ?? 0),
      })),
    },
    breakdowns: { plan: tally(byPlan), method: tally(byMethod) },
  };
}

async function leadsReport(db: Database, r: Range): Promise<Report> {
  const base = and(isNull(leads.deletedAt), inRange(leads.createdAt, r));
  const real = and(base, ne(leads.status, 'spam'));
  const b = bucketSql(leads.createdAt, r.interval);
  const [series, bySource, byReason, byStatus] = await Promise.all([
    db.select({ bucket: b, n: count() }).from(leads).where(real).groupBy(b),
    db.select({ key: leads.source, n: count() }).from(leads).where(real).groupBy(leads.source),
    db.select({ key: leads.reason, n: count() }).from(leads).where(real).groupBy(leads.reason),
    db.select({ key: leads.status, n: count() }).from(leads).where(base).groupBy(leads.status),
  ]);
  const status = tally(byStatus);
  const total = status.filter((s) => s.key !== 'spam').reduce((n, s) => n + s.count, 0);
  const converted = status.find((s) => s.key === 'converted')?.count ?? 0;
  return {
    totals: { leads: total, converted, conversionPct: total ? Math.round((converted / total) * 1000) / 10 : 0, spam: status.find((s) => s.key === 'spam')?.count ?? 0 },
    series: { label: 'New leads (spam excluded)', points: fill(r, series) },
    breakdowns: { source: tally(bySource), reason: tally(byReason), status },
  };
}

async function studentsReport(db: Database, r: Range): Promise<Report> {
  const where = and(eq(users.role, 'student'), isNull(users.deletedAt), inRange(users.createdAt, r));
  const b = bucketSql(users.createdAt, r.interval);
  const [series, byCountry, [verified]] = await Promise.all([
    db.select({ bucket: b, n: count() }).from(users).where(where).groupBy(b),
    db.select({ key: users.country, n: count() }).from(users).where(where).groupBy(users.country),
    db.select({ n: count() }).from(users).where(and(where, eq(users.emailVerified, true))),
  ]);
  const countries = tally(byCountry);
  const top = countries.slice(0, 8);
  const rest = countries.slice(8).reduce((n, c) => n + c.count, 0);
  const signups = countries.reduce((n, c) => n + c.count, 0);
  return {
    totals: { signups, verified: Number(verified.n), verifiedPct: signups ? Math.round((Number(verified.n) / signups) * 1000) / 10 : 0 },
    series: { label: 'New student accounts', points: fill(r, series) },
    breakdowns: { country: rest ? [...top, { key: 'other', count: rest }] : top },
  };
}

async function enrollmentsReport(db: Database, r: Range): Promise<Report> {
  const granted = inRange(enrollments.createdAt, r);
  const b = bucketSql(enrollments.createdAt, r.interval);
  const [series, bySource, [revoked], [active]] = await Promise.all([
    db.select({ bucket: b, n: count() }).from(enrollments).where(granted).groupBy(b),
    db.select({ key: enrollments.source, n: count() }).from(enrollments).where(granted).groupBy(enrollments.source),
    db.select({ n: count() }).from(enrollments).where(inRange(enrollments.revokedAt, r)),
    db.select({ n: count() }).from(enrollments).where(liveEnrollment(new Date())),
  ]);
  const sources = tally(bySource);
  return {
    totals: { granted: sources.reduce((n, s) => n + s.count, 0), revoked: Number(revoked.n), activeNow: Number(active.n) },
    series: { label: 'Course access granted', points: fill(r, series) },
    breakdowns: { source: sources },
  };
}

/** Published lessons of published courses, joined to their course; progress rows of students only. */
const visibleLessons = and(isNull(lessons.deletedAt), eq(lessons.status, 'published'), isNull(courseModules.deletedAt), isNull(courses.deletedAt), eq(courses.status, 'published'))!;

/**
 * Lessons completed per day/week/month, active learners and certificates in the range; plus all-time
 * completion per course (finished ÷ started), the most-completed lessons in the range, and the lessons
 * most often started but not finished (where learners stop).
 */
async function learningReport(db: Database, r: Range): Promise<Report> {
  // Every progress query joins to the lesson and course (visibility) and keeps students only.
  const studentRows = and(eq(users.id, lessonProgress.userId), eq(users.role, 'student'));
  const b = bucketSql(lessonProgress.completedAt, r.interval);
  const lessonKey = sql<string>`concat(${lessons.title}, ' · ', ${courses.title})`;
  const completedInRange = and(visibleLessons, inRange(lessonProgress.completedAt, r));

  const [seriesRows, [active], [certs], perLearner, totals, top, stuck] = await Promise.all([
    db
      .select({ bucket: b, n: count() })
      .from(lessonProgress)
      .innerJoin(users, studentRows)
      .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
      .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
      .innerJoin(courses, eq(courses.id, courseModules.courseId))
      .where(completedInRange)
      .groupBy(b),
    db
      .select({ n: countDistinct(lessonProgress.userId) })
      .from(lessonProgress)
      .innerJoin(users, studentRows)
      .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
      .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
      .innerJoin(courses, eq(courses.id, courseModules.courseId))
      .where(and(visibleLessons, inRange(lessonProgress.updatedAt, r))),
    db.select({ n: count() }).from(certificates).where(inRange(certificates.issuedAt, r)),
    db
      .select({ courseId: courses.id, title: courses.title, sort: courses.sortOrder, userId: lessonProgress.userId, done: sql<number>`sum(${lessonProgress.completedAt} is not null)` })
      .from(lessonProgress)
      .innerJoin(users, studentRows)
      .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
      .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
      .innerJoin(courses, eq(courses.id, courseModules.courseId))
      .where(visibleLessons)
      .groupBy(courses.id, courses.title, courses.sortOrder, lessonProgress.userId),
    db
      .select({ courseId: courses.id, n: count() })
      .from(lessons)
      .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
      .innerJoin(courses, eq(courses.id, courseModules.courseId))
      .where(visibleLessons)
      .groupBy(courses.id),
    db
      .select({ key: lessonKey, n: count() })
      .from(lessonProgress)
      .innerJoin(users, studentRows)
      .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
      .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
      .innerJoin(courses, eq(courses.id, courseModules.courseId))
      .where(completedInRange)
      .groupBy(lessons.id, lessons.title, courses.title)
      .orderBy(desc(count()))
      .limit(10),
    db
      .select({ key: lessonKey, n: count() })
      .from(lessonProgress)
      .innerJoin(users, studentRows)
      .innerJoin(lessons, eq(lessons.id, lessonProgress.lessonId))
      .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
      .innerJoin(courses, eq(courses.id, courseModules.courseId))
      .where(and(visibleLessons, isNull(lessonProgress.completedAt)))
      .groupBy(lessons.id, lessons.title, courses.title)
      .orderBy(desc(count()))
      .limit(10),
  ]);

  const lessonsPerCourse = new Map(totals.map((t) => [t.courseId, Number(t.n)]));
  const byCourse = new Map<string, { key: string; sort: number; started: number; finished: number }>();
  for (const row of perLearner) {
    const entry = byCourse.get(row.courseId) ?? { key: row.title, sort: row.sort, started: 0, finished: 0 };
    entry.started += 1;
    if (Number(row.done) >= (lessonsPerCourse.get(row.courseId) ?? Infinity)) entry.finished += 1;
    byCourse.set(row.courseId, entry);
  }
  const points = fill(r, seriesRows);

  return {
    totals: { lessonsCompleted: points.reduce((n, p) => n + p.count, 0), activeLearners: Number(active.n), certificatesIssued: Number(certs.n) },
    series: { label: 'Lessons completed', points },
    breakdowns: {
      courseCompletion: [...byCourse.values()].sort((x, y) => x.sort - y.sort).map((x) => ({ key: x.key, count: x.finished, of: x.started })),
      topLessons: tally(top),
      stuckLessons: tally(stuck),
    },
    note: 'Course completion and “where learners stop” are all time; the other numbers follow the date range.',
  };
}

/** Not date-based: view counts are running totals (no per-day history) and coverage is "now". */
async function contentReport(db: Database, user: { role: Parameters<typeof can>[0] }): Promise<Report> {
  const out: Report = { totals: {}, breakdowns: {}, note: 'Demo views are running totals since launch; the date range doesn’t apply here.' };
  if (can(user.role, 'demos.view')) {
    const [top, byCategory] = await Promise.all([
      db
        .select({ key: demoVideos.title, n: demoVideos.viewCount })
        .from(demoVideos)
        .where(and(isNull(demoVideos.deletedAt), eq(demoVideos.status, 'published')))
        .orderBy(desc(demoVideos.viewCount))
        .limit(10),
      db
        .select({ key: demoVideos.category, n: sql<number>`sum(${demoVideos.viewCount})` })
        .from(demoVideos)
        .where(and(isNull(demoVideos.deletedAt), eq(demoVideos.status, 'published')))
        .groupBy(demoVideos.category),
    ]);
    out.breakdowns.demoViews = top.map((t) => ({ key: t.key, count: Number(t.n) }));
    out.breakdowns.demoViewsByCategory = tally(byCategory);
    out.totals.demoViews = out.breakdowns.demoViewsByCategory.reduce((n, c) => n + c.count, 0);
  }
  if (can(user.role, 'courses.view')) {
    const rows = await db
      .select({
        key: courses.title,
        total: count(),
        withVideo: sql<number>`sum(${lessons.videoId} is not null)`,
        preview: sql<number>`sum(${lessons.isPreview})`,
      })
      .from(lessons)
      .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
      .innerJoin(courses, eq(courses.id, courseModules.courseId))
      .where(and(isNull(lessons.deletedAt), isNull(courseModules.deletedAt), isNull(courses.deletedAt), eq(lessons.status, 'published'), eq(courses.status, 'published')))
      .groupBy(courses.id, courses.title, courses.sortOrder)
      .orderBy(courses.sortOrder);
    out.breakdowns.lessonsWithVideo = rows.map((x) => ({ key: x.key, count: Number(x.withVideo), of: Number(x.total) }));
    out.totals.publishedLessons = rows.reduce((n, x) => n + Number(x.total), 0);
    out.totals.lessonsWithVideo = rows.reduce((n, x) => n + Number(x.withVideo), 0);
    out.totals.freePreviews = rows.reduce((n, x) => n + Number(x.preview), 0);
  }
  return out;
}

/** reports.view plus view access to what the report summarises (shared/reports.ts). */
function assertTab(c: Context<AppEnv>, type: ReportType) {
  if (!REPORT_ACCESS[type].anyOf.some((p) => can(c.get('user')!.role, p))) throw new AppError('FORBIDDEN', 'You don’t have access to this report');
}

async function build(c: Context<AppEnv>, type: ReportType, q: RangeInput): Promise<Report> {
  const { db } = c.get('deps');
  if (type === 'content') return contentReport(db, c.get('user')!);
  const r = resolveRange(q);
  const report =
    type === 'revenue' ? await revenueReport(db, r) : type === 'leads' ? await leadsReport(db, r) : type === 'students' ? await studentsReport(db, r) : type === 'learning' ? await learningReport(db, r) : await enrollmentsReport(db, r);
  return { ...report, range: { from: r.from, to: r.to, interval: r.interval } };
}

/** Reports (docs/admin/NAVIGATION.md §3): read-only aggregates. */
export const adminReportRoutes = new Hono<AppEnv>()
  .get('/reports/:type', requireStaff('reports.view'), validate('param', typeParam), validate('query', rangeQuery), async (c) => {
    const { type } = c.req.valid('param');
    assertTab(c, type);
    return c.json({ data: await build(c, type, c.req.valid('query')) });
  })

  /** The same report as CSV: the time series, then each breakdown as "section,key,count" rows. */
  .get('/reports/:type/export.csv', requireStaff('reports.export'), validate('param', typeParam), validate('query', rangeQuery), async (c) => {
    const { type } = c.req.valid('param');
    assertTab(c, type);
    const q = c.req.valid('query');
    const report = await build(c, type, q);
    const lines: string[] = [];
    const row = (...cells: unknown[]) => lines.push(cells.map(csvCell).join(','));
    row('Report', REPORT_ACCESS[type].label);
    if (report.range) row('Range (IST)', `${report.range.from} to ${report.range.to}`, `per ${report.range.interval}`);
    for (const [k, v] of Object.entries(report.totals)) row('Total', k, v);
    if (report.series) {
      lines.push('');
      row(report.range?.interval === 'month' ? 'Month' : report.range?.interval === 'week' ? 'Week starting' : 'Day', report.series.label);
      for (const p of report.series.points) row(p.bucket, p.count);
    }
    for (const [section, items] of Object.entries(report.breakdowns)) {
      lines.push('');
      row(section, 'key', 'count');
      for (const i of items) row(section, i.key, i.of !== undefined ? `${i.count} of ${i.of}` : i.count);
    }
    await logActivity(c, { action: 'reports.export', metadata: { type, ...q } });
    const stamp = new Date().toISOString().slice(0, 10);
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="alpharecover-report-${type}-${stamp}.csv"`);
    return c.body(`﻿${lines.join('\r\n')}\r\n`);
  });

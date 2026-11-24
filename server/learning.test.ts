import { createHash } from 'node:crypto';
import { asc, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { activityLogs, certificates, courseModules, courses, lessonProgress, lessons, notificationJobs, plans, siteSettings, users } from './db/schema';
import { renderCertificatePdf } from './services/certificatePdf';
import { seedCatalog, seedPlans } from './db/seed';
import { grantEnrollment } from './services/enrollments';
import { CookieJar, createTestContext, getJson, postJson, readJson, resetTables, sendJson } from './test/helpers';

const dbAvailable = inject('dbAvailable');

describe.skipIf(!dbAvailable)('learning: playback, progress, dashboard (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;
  let jar: CookieJar;
  let userId: string;
  let planId: string;

  /** Lessons of a course in site order. */
  const lessonsOf = async (slug: string) =>
    ctx.db
      .select({ id: lessons.id, slug: lessons.slug, moduleSlug: courseModules.slug, title: lessons.title })
      .from(lessons)
      .innerJoin(courseModules, eq(courseModules.id, lessons.moduleId))
      .innerJoin(courses, eq(courses.id, courseModules.courseId))
      .where(eq(courses.slug, slug))
      .orderBy(asc(courseModules.sortOrder), asc(lessons.sortOrder));
  const setLesson = (id: string, set: Partial<typeof lessons.$inferInsert>) => ctx.db.update(lessons).set(set).where(eq(lessons.id, id));
  const put = (lessonId: string, body: unknown, as = jar) => sendJson(ctx, 'PUT', `/me/progress/${lessonId}`, body, as);
  const enroll = () => grantEnrollment(ctx.db, { userId, planId, source: 'manual' });

  beforeAll(() => {
    ctx = createTestContext();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetTables(ctx.db);
    await seedCatalog(ctx.db);
    await seedPlans(ctx.db);
    await ctx.db.update(lessons).set({ isPreview: false, durationSeconds: null, videoId: null });
    jar = new CookieJar();
    await postJson(
      ctx.app,
      '/auth/register',
      { firstName: 'Ravi', email: 'ravi@example.com', country: 'IN', password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery', acceptTerms: true },
      jar,
    );
    userId = (await ctx.db.select().from(users))[0].id;
    planId = (await ctx.db.select().from(plans))[0].id;
  });

  describe('progress', () => {
    it('needs a session, and 404s for an unknown course', async () => {
      expect((await getJson(ctx.app, '/me/progress?course=logical')).status).toBe(401);
      expect((await getJson(ctx.app, '/me/progress?course=nope', jar)).status).toBe(404);
    });

    it('refuses to save progress on a paid lesson without access, but allows free previews', async () => {
      const [first, second] = await lessonsOf('logical');
      const denied = await put(first.id, { completed: true });
      expect(denied.status).toBe(403);
      expect((await readJson(denied)).error.code).toBe('NOT_ENROLLED');
      await setLesson(second.id, { isPreview: true });
      expect((await put(second.id, { positionSeconds: 30 })).status).toBe(200);
      const body = await readJson(await getJson(ctx.app, '/me/progress?course=logical', jar));
      expect(body.data).toMatchObject({ enrolled: false, lessons: { [second.id]: { positionSeconds: 30, completed: false } } });
    });

    it('saves the resume point, keeps the furthest watched, and auto-completes at 90%', async () => {
      await enroll();
      const [lesson] = await lessonsOf('logical');
      await setLesson(lesson.id, { durationSeconds: 600 });
      expect((await readJson(await put(lesson.id, { positionSeconds: 120, watchedSeconds: 120 }))).data).toMatchObject({ completedAt: null, courseProgressPct: 0 });
      // Rewinding moves the resume point but never lowers the furthest watched.
      await put(lesson.id, { positionSeconds: 30, watchedSeconds: 30 });
      let [row] = await ctx.db.select().from(lessonProgress).where(eq(lessonProgress.lessonId, lesson.id));
      expect(row).toMatchObject({ positionSeconds: 30, watchedSeconds: 120, completedAt: null });
      const done = await readJson(await put(lesson.id, { positionSeconds: 545, watchedSeconds: 540 }));
      expect(done.data.completedAt).not.toBeNull();
      expect(done.data.courseProgressPct).toBe(4); // 1 of 26 lessons
      [row] = await ctx.db.select().from(lessonProgress).where(eq(lessonProgress.lessonId, lesson.id));
      expect(row.watchedSeconds).toBe(540);
    });

    it('can be marked complete and unmarked by hand', async () => {
      await enroll();
      const [lesson] = await lessonsOf('logical');
      expect((await readJson(await put(lesson.id, { completed: true }))).data.completedAt).not.toBeNull();
      const first = (await ctx.db.select().from(lessonProgress))[0].completedAt;
      await put(lesson.id, { completed: true }); // keeps the original completion time
      expect((await ctx.db.select().from(lessonProgress))[0].completedAt).toEqual(first);
      expect((await readJson(await put(lesson.id, { completed: false }))).data).toMatchObject({ completedAt: null, courseProgressPct: 0 });
    });

    it('validates input', async () => {
      await enroll();
      const [lesson] = await lessonsOf('logical');
      await setLesson(lesson.id, { durationSeconds: 100 });
      expect((await put(lesson.id, {})).status).toBe(400);
      expect((await put(lesson.id, { positionSeconds: -1 })).status).toBe(400);
      expect((await put(lesson.id, { positionSeconds: 161 })).status).toBe(400); // duration + 60
      expect((await put(lesson.id, { positionSeconds: 10, extra: 1 })).status).toBe(400);
      expect((await put('01a1d000-0000-7000-8000-00000000abcd', { completed: true })).status).toBe(404);
    });

    it('reports per-course totals and only your own progress', async () => {
      await enroll();
      const [a, b] = await lessonsOf('logical');
      await put(a.id, { completed: true });
      await put(b.id, { positionSeconds: 42 });
      const mine = (await readJson(await getJson(ctx.app, '/me/progress?course=logical', jar))).data;
      expect(mine).toMatchObject({ enrolled: true, lessonsTotal: 26, lessonsCompleted: 1, progressPct: 4 });
      expect(mine.lessons[b.id]).toEqual({ positionSeconds: 42, completed: false });

      const other = new CookieJar();
      await postJson(
        ctx.app,
        '/auth/register',
        { firstName: 'Asha', email: 'asha@example.com', country: 'IN', password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery', acceptTerms: true },
        other,
      );
      const theirs = (await readJson(await getJson(ctx.app, '/me/progress?course=logical', other))).data;
      expect(theirs).toMatchObject({ enrolled: false, lessons: {}, lessonsCompleted: 0 });
    });
  });

  describe('playback', () => {
    const play = (id: string, as?: CookieJar) => postJson(ctx.app, `/lessons/${id}/playback`, {}, as);

    it('asks for a login, then an enrollment, for paid lessons', async () => {
      const [lesson] = await lessonsOf('logical');
      await setLesson(lesson.id, { videoId: 'vid-1' });
      expect((await play(lesson.id)).status).toBe(401);
      const res = await play(lesson.id, jar);
      expect(res.status).toBe(403);
      expect((await readJson(res)).error.code).toBe('NOT_ENROLLED');
    });

    it('says "coming soon" without a video and "not set up" without Bunny settings', async () => {
      await enroll();
      const [lesson] = await lessonsOf('logical');
      expect((await play(lesson.id, jar)).status).toBe(409);
      await setLesson(lesson.id, { videoId: 'vid-1' });
      expect((await play(lesson.id, jar)).status).toBe(503);
    });

    it('returns a signed Bunny embed URL with the resume point; previews play for anyone', async () => {
      const bunny = createTestContext({ BUNNY_STREAM_LIBRARY_ID: '12345', BUNNY_STREAM_TOKEN_KEY: 'secret-key' });
      try {
        const [lesson, preview] = await lessonsOf('logical');
        await setLesson(lesson.id, { videoId: 'vid-1', durationSeconds: 600 });
        await setLesson(preview.id, { videoId: 'vid-2', isPreview: true });
        await enroll();
        await put(lesson.id, { positionSeconds: 312 });
        const res = await postJson(bunny.app, `/lessons/${lesson.id}/playback`, {}, jar);
        expect(res.status).toBe(200);
        const { data } = await readJson(res);
        const url = new URL(data.embedUrl);
        expect(url.origin + url.pathname).toBe('https://player.mediadelivery.net/embed/12345/vid-1');
        const expires = url.searchParams.get('expires')!;
        expect(url.searchParams.get('token')).toBe(createHash('sha256').update(`secret-keyvid-1${expires}`).digest('hex'));
        expect(data.resumeAt).toBe(312);
        expect(new Date(data.expiresAt).getTime()).toBe(Number(expires) * 1000);
        expect(res.headers.get('cache-control')).toBe('no-store');
        const anon = await postJson(bunny.app, `/lessons/${preview.id}/playback`, {});
        expect(anon.status).toBe(200);
        expect((await readJson(anon)).data.resumeAt).toBe(0);
      } finally {
        await bunny.close();
      }
    });

    it('hides unpublished lessons', async () => {
      const [lesson] = await lessonsOf('logical');
      await setLesson(lesson.id, { status: 'draft', isPreview: true });
      expect((await play(lesson.id)).status).toBe(404);
    });
  });

  describe('dashboard', () => {
    it('is empty without an enrollment', async () => {
      expect((await getJson(ctx.app, '/me/dashboard')).status).toBe(401);
      const { data } = await readJson(await getJson(ctx.app, '/me/dashboard', jar));
      expect(data).toEqual({ courses: [], continue: null, certificates: [], hasActiveEnrollment: false });
    });

    it('lists courses with progress and where to continue', async () => {
      await enroll();
      const logical = await lessonsOf('logical');
      let { data } = await readJson(await getJson(ctx.app, '/me/dashboard', jar));
      expect(data.hasActiveEnrollment).toBe(true);
      expect(data.courses.length).toBe(9);
      expect(data.courses[0]).toMatchObject({ slug: 'logical', lessonsTotal: 26, lessonsCompleted: 0, progressPct: 0 });
      expect(data.continue).toMatchObject({ courseSlug: 'logical', lessonId: logical[0].id, moduleSlug: logical[0].moduleSlug, lessonSlug: logical[0].slug, positionSeconds: 0 });

      // In progress → continue that lesson at its position
      await put(logical[3].id, { positionSeconds: 99 });
      ({ data } = await readJson(await getJson(ctx.app, '/me/dashboard', jar)));
      expect(data.continue).toMatchObject({ lessonId: logical[3].id, positionSeconds: 99 });

      // Finished → the next unfinished lesson after it
      await put(logical[3].id, { completed: true });
      ({ data } = await readJson(await getJson(ctx.app, '/me/dashboard', jar)));
      expect(data.continue).toMatchObject({ lessonId: logical[4].id, positionSeconds: 0 });
      expect(data.courses[0]).toMatchObject({ lessonsCompleted: 1, progressPct: 4, next: { lessonId: logical[0].id } });
    });

    it('includes your valid certificates', async () => {
      await enroll();
      const [course] = await ctx.db.select().from(courses).where(eq(courses.slug, 'logical'));
      const base = { userId, courseId: course.id, recipientName: 'Ravi', programTitle: course.title, issuedAt: new Date() };
      await ctx.db.insert(certificates).values([
        { ...base, code: 'AR-2026-00001' },
        { ...base, code: 'AR-2026-00002', status: 'revoked', revokedAt: new Date() },
      ]);
      const { data } = await readJson(await getJson(ctx.app, '/me/dashboard', jar));
      expect(data.certificates).toEqual([expect.objectContaining({ code: 'AR-2026-00001', programTitle: course.title })]);
    });
  });

  describe('certificates', () => {
    /** The course with the fewest published lessons, and its lessons in order. */
    const smallest = async () => {
      const all = await ctx.db.select({ id: courses.id, slug: courses.slug, title: courses.title }).from(courses);
      const sized = await Promise.all(all.map(async (c) => ({ ...c, lessons: await lessonsOf(c.slug) })));
      return sized.sort((a, b) => a.lessons.length - b.lessons.length)[0];
    };
    const completeAll = async (list: { id: string }[]) => {
      let last: any;
      for (const l of list) last = await readJson(await put(l.id, { completed: true }));
      return last;
    };
    const download = (code: string, as?: CookieJar) => getJson(ctx.app, `/me/certificates/${code}/download`, as);

    it('issues the course certificate once the last lesson is complete, emails it, and logs it', async () => {
      await enroll();
      await ctx.db.update(users).set({ certificateName: 'Ravi Kumar Shah' }).where(eq(users.id, userId));
      const course = await smallest();
      const before = await completeAll(course.lessons.slice(0, -1));
      expect(before.data.certificate).toBeNull();
      const last = await readJson(await put(course.lessons.at(-1)!.id, { completed: true }));
      expect(last.data).toMatchObject({ courseProgressPct: 100, certificate: { code: expect.stringMatching(/^AR-\d{4}-\d{5}$/), programTitle: course.title } });

      const [cert] = await ctx.db.select().from(certificates);
      expect(cert).toMatchObject({ userId, courseId: course.id, recipientName: 'Ravi Kumar Shah', programTitle: course.title, status: 'valid', issuedBy: null });
      const [job] = await ctx.db.select().from(notificationJobs).where(eq(notificationJobs.template, 'certificate_issued'));
      expect(job).toMatchObject({ toAddress: 'ravi@example.com', payload: expect.objectContaining({ code: cert.code, verifyUrl: `http://localhost:5173/verify-certificate?code=${cert.code}` }) });
      expect(await ctx.db.$count(activityLogs, eq(activityLogs.action, 'certificates.auto_issue'))).toBe(1);

      // Un-marking and re-marking, or a concurrent double save, never issues a second one.
      await put(course.lessons[0].id, { completed: false });
      expect((await readJson(await put(course.lessons[0].id, { completed: true }))).data.certificate).toBeNull();
      await Promise.all([put(course.lessons[1].id, { completed: true }), put(course.lessons[1].id, { completed: true })]);
      expect(await ctx.db.$count(certificates)).toBe(1);
      const dash = (await readJson(await getJson(ctx.app, '/me/dashboard', jar))).data;
      expect(dash.certificates).toEqual([expect.objectContaining({ code: cert.code })]);
    });

    it('issues exactly one under concurrent completion of the last two lessons', async () => {
      await enroll();
      const course = await smallest();
      await completeAll(course.lessons.slice(0, -2));
      await Promise.all(course.lessons.slice(-2).map((l) => put(l.id, { completed: true })));
      expect(await ctx.db.$count(certificates)).toBe(1);
    });

    it('issues nothing when the setting is "manual"', async () => {
      await ctx.db.insert(siteSettings).values({ key: 'certificate_criteria', value: { type: 'manual' } });
      await enroll();
      const course = await smallest();
      expect((await completeAll(course.lessons)).data).toMatchObject({ courseProgressPct: 100, certificate: null });
      expect(await ctx.db.$count(certificates)).toBe(0);
    });

    it('downloads your own valid certificate as a PDF, and nobody else\'s', async () => {
      await enroll();
      const course = await smallest();
      const { data } = await completeAll(course.lessons);
      const code = data.certificate.code;
      expect((await download(code)).status).toBe(401);
      const res = await download(code, jar);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/pdf');
      expect(res.headers.get('content-disposition')).toBe(`attachment; filename="Alpha-Recovery-Certificate-${code}.pdf"`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
      expect((await readJson(await getJson(ctx.app, '/me/certificates', jar))).data).toEqual([expect.objectContaining({ code, programTitle: course.title })]);

      const other = new CookieJar();
      await postJson(
        ctx.app,
        '/auth/register',
        { firstName: 'Asha', email: 'asha@example.com', country: 'IN', password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery', acceptTerms: true },
        other,
      );
      expect((await download(code, other)).status).toBe(404);
      expect((await download('not-a-code', jar)).status).toBe(400);
      await ctx.db.update(certificates).set({ status: 'revoked', revokedAt: new Date() });
      expect((await download(code, jar)).status).toBe(404);
    });

    it('renders names the standard PDF fonts can\'t print without failing', async () => {
      const pdf = await renderCertificatePdf({ code: 'AR-2026-00001', recipientName: 'रवि Kumar — Ōno', programTitle: 'Logical Failure Data Recovery', issuedAt: new Date(), verifyUrl: 'https://example.com/verify-certificate?code=AR-2026-00001' });
      expect(pdf.byteLength).toBeGreaterThan(1000);
    });
  });
});

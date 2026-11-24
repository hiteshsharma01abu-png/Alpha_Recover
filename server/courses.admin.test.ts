import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it, vi } from 'vitest';
import { activityLogs, courseModules, courses, lessons } from './db/schema';
import { seedCatalog } from './db/seed';
import { createTestContext, getJson, loginAs, postJson, readJson, resetTables, sendJson } from './test/helpers';

const dbAvailable = inject('dbAvailable');

describe.skipIf(!dbAvailable)('admin courses API (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;

  beforeAll(() => {
    ctx = createTestContext();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetTables(ctx.db);
    await seedCatalog(ctx.db);
  });

  const outline = async (jar: Parameters<typeof getJson>[2], id: string) => (await readJson(await getJson(ctx.app, `/admin/courses/${id}`, jar))).data;
  const publicCourse = async (slug: string) => ctx.app.request(`/api/v1/courses/${slug}`);

  it('lists courses with module and lesson counts; support and finance have no access', async () => {
    const { jar } = await loginAs(ctx, 'content_manager');
    const { data } = await readJson(await getJson(ctx.app, '/admin/courses', jar));
    expect(data).toHaveLength(9);
    const total = data.reduce((s: number, c: { lessons: { total: number } }) => s + c.lessons.total, 0);
    expect(total).toBe(117);
    expect(data[0]).toMatchObject({ status: 'published', lessons: { withVideo: 0 } });
    expect((await getJson(ctx.app, '/admin/courses', (await loginAs(ctx, 'support_manager')).jar)).status).toBe(403);
    expect((await getJson(ctx.app, '/admin/courses', (await loginAs(ctx, 'finance_manager')).jar)).status).toBe(403);
  });

  it('builds a course: create (draft, off the site), add modules and lessons with generated slugs, publish', async () => {
    const { jar } = await loginAs(ctx, 'content_manager');
    const res = await postJson(ctx.app, '/admin/courses', { slug: 'ssd-recovery', title: 'SSD Recovery', summary: 'Recovering data from solid-state drives.', status: 'draft' }, jar);
    expect(res.status).toBe(201);
    const { id } = (await readJson(res)).data;
    expect((await publicCourse('ssd-recovery')).status).toBe(404);

    const mod = (await readJson(await postJson(ctx.app, `/admin/courses/${id}/modules`, { title: 'SSD Basics!' }, jar))).data;
    expect(mod.slug).toBe('ssd-basics');
    const dupMod = (await readJson(await postJson(ctx.app, `/admin/courses/${id}/modules`, { title: 'SSD basics' }, jar))).data;
    expect(dupMod.slug).toBe('ssd-basics-2');
    const l1 = (await readJson(await postJson(ctx.app, `/admin/modules/${mod.id}/lessons`, { title: 'What is TRIM?', status: 'published', isPreview: true, durationSeconds: 600 }, jar))).data;
    expect(l1.slug).toBe('what-is-trim');
    await postJson(ctx.app, `/admin/modules/${mod.id}/lessons`, { title: 'Draft lesson', status: 'draft' }, jar);

    expect((await sendJson(ctx, 'PATCH', `/admin/courses/${id}`, { status: 'published' }, jar)).status).toBe(200);
    const pub = (await readJson(await publicCourse('ssd-recovery'))).data;
    expect(pub.lessonCount).toBe(1); // drafts stay hidden
    expect(pub.modules[0].lessons[0]).toMatchObject({ slug: 'what-is-trim', isPreview: true, hasVideo: false });

    expect((await postJson(ctx.app, '/admin/courses', { slug: 'ssd-recovery', title: 'Again', summary: 'Duplicate slug here.', status: 'draft' }, jar)).status).toBe(409);
    expect((await postJson(ctx.app, '/admin/courses', { slug: 'x', title: 'Bad image', summary: 'Image must be safe.', status: 'draft', imageUrl: 'javascript:alert(1)' }, jar)).status).toBe(400);
    expect((await sendJson(ctx, 'PATCH', `/admin/courses/${id}`, { slug: 'renamed' }, jar)).status).toBe(400);
    const actions = (await ctx.db.select({ a: activityLogs.action }).from(activityLogs)).map((r) => r.a);
    expect(actions).toEqual(expect.arrayContaining(['courses.create', 'courses.module_create', 'courses.lesson_create', 'courses.update']));
  });

  it('edits lessons and modules, never exposing video ids', async () => {
    const { jar } = await loginAs(ctx, 'admin');
    const [course] = await ctx.db.select().from(courses).limit(1);
    const o = await outline(jar, course.id);
    const lesson = o.modules[0].lessons[0];
    await ctx.db.update(lessons).set({ videoId: 'secret-bunny-guid' }).where(eq(lessons.id, lesson.id));
    const text = await (await getJson(ctx.app, `/admin/courses/${course.id}`, jar)).text();
    expect(text).not.toContain('secret-bunny-guid');
    expect(text).toContain('"hasVideo":true');

    expect((await sendJson(ctx, 'PATCH', `/admin/lessons/${lesson.id}`, { title: 'Renamed lesson', isPreview: true, durationSeconds: 754, description: 'Now with notes.' }, jar)).status).toBe(200);
    const [row] = await ctx.db.select().from(lessons).where(eq(lessons.id, lesson.id));
    expect(row).toMatchObject({ title: 'Renamed lesson', isPreview: true, durationSeconds: 754, slug: lesson.slug });
    expect((await sendJson(ctx, 'PATCH', `/admin/lessons/${lesson.id}`, { slug: 'new-slug' }, jar)).status).toBe(400);
    expect((await sendJson(ctx, 'PATCH', `/admin/lessons/${lesson.id}`, { videoId: 'x' }, jar)).status).toBe(400);
    expect((await sendJson(ctx, 'PATCH', `/admin/modules/${o.modules[0].id}`, { title: 'Renamed module' }, jar)).status).toBe(200);
  });

  it('reorders modules and lessons and moves a lesson across modules, renaming only on a slug clash', async () => {
    const { jar } = await loginAs(ctx, 'content_manager');
    const [course] = await ctx.db.select().from(courses).where(eq(courses.slug, 'logical'));
    const o = await outline(jar, course.id);
    expect(o.modules.length).toBeGreaterThanOrEqual(2);
    const [m1, m2] = o.modules;
    const movedLesson = m1.lessons[0];
    // Give module 2 a deleted lesson with the same slug: the moved one must not collide with it.
    await ctx.db.insert(lessons).values({ moduleId: m2.id, slug: movedLesson.slug, title: 'Old deleted', deletedAt: new Date() });

    const order = {
      modules: [
        { id: m2.id, lessonIds: [movedLesson.id, ...m2.lessons.map((l: { id: string }) => l.id).reverse()] },
        { id: m1.id, lessonIds: m1.lessons.slice(1).map((l: { id: string }) => l.id) },
        ...o.modules.slice(2).map((m: { id: string; lessons: { id: string }[] }) => ({ id: m.id, lessonIds: m.lessons.map((l) => l.id) })),
      ],
    };
    expect((await sendJson(ctx, 'PUT', `/admin/courses/${course.id}/order`, order, jar)).status).toBe(200);
    const after = await outline(jar, course.id);
    expect(after.modules[0].id).toBe(m2.id);
    expect(after.modules[0].lessons[0]).toMatchObject({ id: movedLesson.id, slug: `${movedLesson.slug}-2` });
    expect(after.modules[0].lessons.slice(1).map((l: { id: string }) => l.id)).toEqual(m2.lessons.map((l: { id: string }) => l.id).reverse());
    // The public outline follows.
    const pub = (await readJson(await publicCourse('logical'))).data;
    expect(pub.modules[0].slug).toBe(m2.slug);

    // A stale or partial order is refused.
    expect((await sendJson(ctx, 'PUT', `/admin/courses/${course.id}/order`, { modules: order.modules.slice(1) }, jar)).status).toBe(409);
  });

  it('creates a Bunny upload URL, attaches and clears a lesson video without leaking the id', async () => {
    const { jar } = await loginAs(ctx, 'content_manager');
    const [course] = await ctx.db.select().from(courses).limit(1);
    const o = await outline(jar, course.id);
    const lesson = o.modules[0].lessons[0];

    expect((await postJson(ctx.app, '/admin/videos/upload-url', { title: 'Intro' }, jar)).status).toBe(503);

    const bunny = createTestContext({
      BUNNY_STREAM_LIBRARY_ID: '12345',
      BUNNY_STREAM_API_KEY: 'library-api-key-secret',
      BUNNY_STREAM_TOKEN_KEY: 'token-key',
    });
    await resetTables(bunny.db);
    await seedCatalog(bunny.db);
    const { jar: bunnyJar } = await loginAs(bunny, 'content_manager');
    const [bunnyCourse] = await bunny.db.select().from(courses).limit(1);
    const bunnyOutline = (await readJson(await getJson(bunny.app, `/admin/courses/${bunnyCourse.id}`, bunnyJar))).data;
    const bunnyLesson = bunnyOutline.modules[0].lessons[0];

    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('video.bunnycdn.com/library/') && url.endsWith('/videos')) {
        return new Response(JSON.stringify({ guid: 'vid-guid-abc123' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('unexpected', { status: 500 });
    });
    try {
      const up = await postJson(bunny.app, '/admin/videos/upload-url', { title: 'Intro lesson' }, bunnyJar);
      expect(up.status).toBe(200);
      const body = await readJson(up);
      expect(body.data.videoId).toBe('vid-guid-abc123');
      expect(body.data.upload.endpoint).toBe('https://video.bunnycdn.com/tusupload');
      expect(body.data.upload.headers.LibraryId).toBe('12345');
      expect(body.data.upload.headers.VideoId).toBe('vid-guid-abc123');
      expect(JSON.stringify(body)).not.toContain('library-api-key-secret');
      expect(spy).toHaveBeenCalled();

      const attach = await sendJson(bunny, 'PUT', `/admin/lessons/${bunnyLesson.id}/video`, { videoId: 'vid-guid-abc123' }, bunnyJar);
      expect(attach.status).toBe(200);
      const detailText = await (await getJson(bunny.app, `/admin/courses/${bunnyCourse.id}`, bunnyJar)).text();
      expect(detailText).toContain('"hasVideo":true');
      expect(detailText).not.toContain('vid-guid-abc123');

      expect((await sendJson(bunny, 'DELETE', `/admin/lessons/${bunnyLesson.id}/video`, {}, bunnyJar)).status).toBe(200);
      const after = (await readJson(await getJson(bunny.app, `/admin/courses/${bunnyCourse.id}`, bunnyJar))).data;
      expect(after.modules[0].lessons[0].hasVideo).toBe(false);

      const actions = (await bunny.db.select({ a: activityLogs.action }).from(activityLogs)).map((r) => r.a);
      expect(actions).toEqual(
        expect.arrayContaining(['videos.upload_url', 'courses.lesson_video_attach', 'courses.lesson_video_clear']),
      );

      // Finance cannot upload or attach.
      const { jar: finance } = await loginAs(bunny, 'finance_manager');
      expect((await postJson(bunny.app, '/admin/videos/upload-url', { title: 'Nope' }, finance)).status).toBe(403);
      expect((await sendJson(bunny, 'PUT', `/admin/lessons/${bunnyLesson.id}/video`, { videoId: 'vid-guid-abc123' }, finance)).status).toBe(403);
    } finally {
      spy.mockRestore();
      await bunny.close();
    }

    // Baseline ctx lesson untouched by the bunny context.
    expect(lesson.hasVideo).toBe(false);
  });

  it('reorders courses; deletes only empty modules and courses', async () => {
    const { jar } = await loginAs(ctx, 'admin');
    const list = (await readJson(await getJson(ctx.app, '/admin/courses', jar))).data as { id: string }[];
    const ids = list.map((c) => c.id).reverse();
    expect((await sendJson(ctx, 'PUT', '/admin/courses/order', { ids }, jar)).status).toBe(200);
    expect(((await readJson(await getJson(ctx.app, '/admin/courses', jar))).data as { id: string }[]).map((c) => c.id)).toEqual(ids);
    expect((await sendJson(ctx, 'PUT', '/admin/courses/order', { ids: ids.slice(1) }, jar)).status).toBe(400);

    const course = await outline(jar, ids[0]);
    expect((await sendJson(ctx, 'DELETE', `/admin/courses/${course.id}`, {}, jar)).status).toBe(422);
    const mod = course.modules[0];
    expect((await sendJson(ctx, 'DELETE', `/admin/modules/${mod.id}`, {}, jar)).status).toBe(422);
    for (const l of mod.lessons) expect((await sendJson(ctx, 'DELETE', `/admin/lessons/${l.id}`, {}, jar)).status).toBe(200);
    expect((await sendJson(ctx, 'DELETE', `/admin/modules/${mod.id}`, {}, jar)).status).toBe(200);
    expect(await ctx.db.$count(courseModules, and(eq(courseModules.id, mod.id), isNull(courseModules.deletedAt)))).toBe(0);
  });
});

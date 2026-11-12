import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { trainingTracks } from '../src/data/content';
import { courseModules, courses, lessons } from './db/schema';
import { seedCatalog } from './db/seed';
import { createTestContext, readJson, resetTables } from './test/helpers';

const dbAvailable = inject('dbAvailable');
const totalLessons = trainingTracks.reduce((n, t) => n + t.modules.reduce((m, mod) => m + mod.lessons.length, 0), 0);
const totalModules = trainingTracks.reduce((n, t) => n + t.modules.length, 0);

describe.skipIf(!dbAvailable)('catalog', () => {
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

  describe('seed', () => {
    it('imports every track, module and lesson from the static content', async () => {
      expect(await ctx.db.$count(courses)).toBe(trainingTracks.length);
      expect(await ctx.db.$count(courseModules)).toBe(totalModules);
      expect(await ctx.db.$count(lessons)).toBe(totalLessons);
      expect(totalLessons).toBe(117);
    });

    it('is insert-only: a re-run adds nothing and keeps admin edits', async () => {
      await ctx.db.update(courses).set({ title: 'Edited by admin' }).where(eq(courses.slug, 'logical'));
      const again = await seedCatalog(ctx.db);
      expect(again).toEqual({ courses: 0, modules: 0, lessons: 0 });
      const [c] = await ctx.db.select().from(courses).where(eq(courses.slug, 'logical'));
      expect(c.title).toBe('Edited by admin');
    });
  });

  describe('GET /courses', () => {
    it('lists published tracks in order with counts, without the outline by default', async () => {
      const res = await ctx.app.request('/api/v1/courses');
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toContain('s-maxage=300');
      const { data } = await readJson(res);
      expect(data.map((c: { slug: string }) => c.slug)).toEqual(trainingTracks.map((t) => t.id));
      expect(data[0]).toMatchObject({ slug: 'logical', moduleCount: 2, lessonCount: 26 });
      expect(data[0].modules).toBeUndefined();
    });

    it('includes modules and lessons with ?include=outline', async () => {
      const { data } = await readJson(await ctx.app.request('/api/v1/courses?include=outline'));
      const logical = data[0];
      expect(logical.modules.map((m: { slug: string }) => m.slug)).toEqual(['logical-core', 'expert']);
      expect(logical.modules[0].lessons[0]).toMatchObject({ slug: 'l1', title: 'Introduction', isPreview: false, hasVideo: false });
    });

    it('rejects unknown include values', async () => {
      expect((await ctx.app.request('/api/v1/courses?include=everything')).status).toBe(400);
    });
  });

  describe('GET /courses/:slug', () => {
    it('returns one track with its outline', async () => {
      const res = await ctx.app.request('/api/v1/courses/mrt');
      const { data } = await readJson(res);
      expect(data).toMatchObject({ slug: 'mrt', moduleCount: 4, lessonCount: 27 });
      expect(data.modules).toHaveLength(4);
    });

    it('404s for unknown, draft or deleted tracks', async () => {
      expect((await ctx.app.request('/api/v1/courses/nope')).status).toBe(404);
      await ctx.db.update(courses).set({ status: 'draft' }).where(eq(courses.slug, 'media'));
      expect((await ctx.app.request('/api/v1/courses/media')).status).toBe(404);
      await ctx.db.update(courses).set({ deletedAt: new Date() }).where(eq(courses.slug, 'basics'));
      expect((await ctx.app.request('/api/v1/courses/basics')).status).toBe(404);
      const { data } = await readJson(await ctx.app.request('/api/v1/courses'));
      expect(data).toHaveLength(trainingTracks.length - 2);
    });

    it('hides draft lessons and never exposes video ids', async () => {
      const [l1] = await ctx.db.select().from(lessons).where(eq(lessons.slug, 'l1'));
      await ctx.db.update(lessons).set({ videoId: 'secret-bunny-guid', durationSeconds: 420 }).where(eq(lessons.id, l1.id));
      await ctx.db.update(lessons).set({ status: 'draft' }).where(eq(lessons.slug, 'l2'));

      const res = await ctx.app.request('/api/v1/courses/logical');
      const raw = await res.clone().text();
      expect(raw).not.toContain('secret-bunny-guid');
      expect(raw).not.toContain('videoId');
      const { data } = await readJson(res);
      const first = data.modules[0].lessons;
      expect(first[0]).toMatchObject({ slug: 'l1', hasVideo: true, durationSeconds: 420 });
      expect(first.map((l: { slug: string }) => l.slug)).not.toContain('l2');
      expect(data.totalDurationSeconds).toBe(420);
    });

    it('validates the slug format', async () => {
      expect((await ctx.app.request('/api/v1/courses/Bad_Slug')).status).toBe(400);
    });
  });
});

import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { permissionsFor, type StaffRole, type UserRole } from '../shared/permissions';
import { activityLogs, leads, users } from './db/schema';
import { seedBlogPosts, seedCatalog, seedDemoVideos, seedPlans } from './db/seed';
import { createOrPromoteAdmin } from './scripts/create-admin';
import { CookieJar, createTestContext, getJson, postJson, readJson, resetTables } from './test/helpers';

const dbAvailable = inject('dbAvailable');
const STAFF: StaffRole[] = ['super_admin', 'admin', 'finance_manager', 'content_manager', 'support_manager'];

describe.skipIf(!dbAvailable)('admin API (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;
  let counter = 0;

  /** A signed-in account with the given role (role set in the DB; sessions read it live). */
  async function asRole(role: UserRole) {
    const jar = new CookieJar();
    const email = `${role}-${(counter += 1)}@example.com`;
    await ctx.db.execute(sql`DELETE FROM rate_limit_buckets`); // tests create more accounts than the 5/hour sign-up limit
    await postJson(
      ctx.app,
      '/auth/register',
      { firstName: 'Staff', email, country: 'IN', password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery', acceptTerms: true },
      jar,
    );
    await ctx.db.update(users).set({ role }).where(eq(users.email, email));
    return jar;
  }

  beforeAll(() => {
    ctx = createTestContext();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetTables(ctx.db);
    await ctx.db.execute(sql`DELETE FROM rate_limit_buckets`);
  });

  describe('GET /admin/me', () => {
    it('401 when anonymous, 403 for students', async () => {
      expect((await getJson(ctx.app, '/admin/me', new CookieJar())).status).toBe(401);
      const res = await getJson(ctx.app, '/admin/me', await asRole('student'));
      expect(res.status).toBe(403);
      expect((await readJson(res)).error.message).toMatch(/admin access/);
    });

    it.each(STAFF)('returns the role and its exact permissions for %s', async (role) => {
      const { data } = await readJson(await getJson(ctx.app, '/admin/me', await asRole(role)));
      expect(data.role).toBe(role);
      expect(data.permissions).toEqual(permissionsFor(role));
      expect(data.user.firstName).toBe('Staff');
    });

    it('refuses suspended staff', async () => {
      const jar = await asRole('admin');
      await ctx.db.update(users).set({ status: 'suspended' }).where(eq(users.role, 'admin'));
      expect((await getJson(ctx.app, '/admin/me', jar)).status).toBe(403);
    });
  });

  describe('GET /admin/dashboard', () => {
    beforeEach(async () => {
      await Promise.all([seedCatalog(ctx.db), seedPlans(ctx.db), seedDemoVideos(ctx.db), seedBlogPosts(ctx.db)]);
      await ctx.db.insert(leads).values([
        { source: 'contact_form', name: 'A', phone: '+911111111111', status: 'new' },
        { source: 'callback', phone: '+912222222222', status: 'contacted' },
        { source: 'contact_form', name: 'Bot', status: 'spam' },
      ]);
    });

    const widgets = async (role: UserRole) => Object.keys((await readJson(await getJson(ctx.app, '/admin/dashboard', await asRole(role)))).data).sort();

    it('gives each role only the widgets it may see', async () => {
      expect(await widgets('super_admin')).toEqual(['content', 'demoVideos', 'email', 'leads', 'pricing', 'students']);
      expect(await widgets('admin')).toEqual(['content', 'demoVideos', 'email', 'leads', 'pricing', 'students']);
      expect(await widgets('finance_manager')).toEqual(['pricing', 'students']);
      expect(await widgets('content_manager')).toEqual(['content', 'demoVideos', 'pricing']);
      expect(await widgets('support_manager')).toEqual(['email', 'leads', 'students']);
      expect((await getJson(ctx.app, '/admin/dashboard', await asRole('student'))).status).toBe(403);
    });

    it('reports correct numbers', async () => {
      const { data } = await readJson(await getJson(ctx.app, '/admin/dashboard', await asRole('super_admin')));
      expect(data.leads).toMatchObject({ total: 2, new: 1, last7Days: 2 });
      expect(data.leads.recent).toHaveLength(2);
      expect(data.content).toEqual({ tracks: 9, lessons: 117, lessonsWithVideo: 0, blogPosts: 3, blogPostsExcerptOnly: 3 });
      expect(data.demoVideos.published).toBe(6);
      expect(data.pricing.plan).toBe('Professional Plan');
      expect(data.email).toEqual({ failed: 0, queued: expect.any(Number) });
    });
  });

  describe('create-admin CLI', () => {
    it('creates a verified super admin who can log in and open the admin API', async () => {
      const result = await createOrPromoteAdmin(ctx.db, ctx.auth, { email: 'Owner@AlphaRecover.com', name: 'Hitesh', role: 'super_admin' });
      expect(result.action).toBe('created');
      expect(result.generatedPassword).toMatch(/^[A-Za-z0-9_-]{24}$/);
      const [u] = await ctx.db.select().from(users).where(eq(users.email, 'owner@alpharecover.com'));
      expect(u).toMatchObject({ role: 'super_admin', emailVerified: true });

      const jar = new CookieJar();
      expect((await postJson(ctx.app, '/auth/login', { email: 'owner@alpharecover.com', password: result.generatedPassword }, jar)).status).toBe(200);
      expect((await readJson(await getJson(ctx.app, '/admin/me', jar))).data.role).toBe('super_admin');
      expect((await ctx.db.select().from(activityLogs)).map((l) => l.action)).toContain('team.create');
    });

    it('promotes an existing account and reports when nothing changes', async () => {
      await asRole('student');
      const [student] = await ctx.db.select().from(users);
      const promoted = await createOrPromoteAdmin(ctx.db, ctx.auth, { email: student.email, name: 'x', role: 'admin' });
      expect(promoted).toEqual({ userId: student.id, action: 'promoted' });
      expect((await ctx.db.select().from(users))[0].role).toBe('admin');
      expect((await createOrPromoteAdmin(ctx.db, ctx.auth, { email: student.email, name: 'x', role: 'admin' })).action).toBe('unchanged');
    });

    it('rejects a weak password', async () => {
      await expect(createOrPromoteAdmin(ctx.db, ctx.auth, { email: 'a@b.com', name: 'A', role: 'admin', password: 'password123' })).rejects.toThrow(/too common/);
    });
  });

  it('role migration left no legacy "support" values', async () => {
    const [rows] = (await ctx.db.execute(
      sql`SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`,
    )) as unknown as [{ t: string }[]];
    expect(rows[0].t).toBe("enum('student','support_manager','content_manager','finance_manager','admin','super_admin')");
  });
});

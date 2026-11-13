import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import type { UserRole } from '../shared/permissions';
import { activityLogs, leadNotes, leads, users } from './db/schema';
import { csvCell, maskEmail, maskPhone } from './lib/mask';
import { browserHeaders, CookieJar, createTestContext, getJson, postJson, readJson, resetTables } from './test/helpers';

const dbAvailable = inject('dbAvailable');

describe('masking and CSV helpers', () => {
  it('masks emails and phones', () => {
    expect(maskEmail('ravi.patel@gmail.com')).toBe('ra***@gmail.com');
    expect(maskPhone('+916355197917')).toBe('+91 ••••• 97917');
    expect(maskPhone('+14155550100')).toBe('+1 ••••• 50100');
    expect(maskEmail(null)).toBeNull();
  });

  it('quotes CSV cells and neutralises formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+91 63551')).toBe("'+91 63551");
    expect(csvCell(null)).toBe('');
  });
});

describe.skipIf(!dbAvailable)('admin leads API (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;
  let counter = 0;
  const ids: Record<string, string> = {};

  async function asRole(role: UserRole, name = 'Staff') {
    const jar = new CookieJar();
    const email = `${role}-${(counter += 1)}@example.com`;
    await ctx.db.execute(sql`DELETE FROM rate_limit_buckets`);
    await postJson(ctx.app, '/auth/register', { firstName: name, email, country: 'IN', password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery', acceptTerms: true }, jar);
    await ctx.db.update(users).set({ role }).where(eq(users.email, email));
    const [u] = await ctx.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    return { jar, id: u.id };
  }
  const patch = (jar: CookieJar, id: string, body: unknown) =>
    ctx.app.request(`/api/v1/admin/leads/${id}`, { method: 'PATCH', headers: { ...browserHeaders, 'Content-Type': 'application/json', Cookie: jar.header() }, body: JSON.stringify(body) });

  beforeAll(() => {
    ctx = createTestContext();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetTables(ctx.db);
    const at = (iso: string) => new Date(iso);
    const rows = [
      { key: 'meera', source: 'contact_form' as const, name: 'Meera Shah', email: 'meera.shah@gmail.com', phone: '+919812345678', reason: 'training' as const, status: 'new' as const, message: 'Hindi batch?', createdAt: at('2026-11-10T06:00:00Z') },
      { key: 'callback', source: 'callback' as const, name: null, email: null, phone: '+919898989898', reason: null, status: 'new' as const, message: null, createdAt: at('2026-11-12T06:00:00Z') },
      { key: 'arjun', source: 'contact_form' as const, name: 'Arjun', email: 'arjun@corp.in', phone: '+919000011111', reason: 'data_recovery_service' as const, status: 'contacted' as const, message: 'RAID 5 failure', createdAt: at('2026-11-01T06:00:00Z') },
      { key: 'spam', source: 'contact_form' as const, name: 'Bot', email: 'bot@spam.test', phone: null, reason: 'other' as const, status: 'spam' as const, message: 'buy now', createdAt: at('2026-11-11T06:00:00Z') },
      { key: 'formula', source: 'contact_form' as const, name: '=HYPERLINK("http://evil")', email: 'x@y.test', phone: '+911234567890', reason: 'other' as const, status: 'closed' as const, message: 'x', createdAt: at('2026-10-20T06:00:00Z') },
    ];
    for (const { key, ...r } of rows) {
      await ctx.db.insert(leads).values(r);
      const [row] = await ctx.db.select({ id: leads.id }).from(leads).orderBy(sql`created_at DESC`).where(eq(leads.createdAt, r.createdAt));
      ids[key] = row.id;
    }
  });

  it('is limited to roles with leads permissions', async () => {
    for (const role of ['content_manager', 'finance_manager'] as const) {
      expect((await getJson(ctx.app, '/admin/leads', (await asRole(role)).jar)).status).toBe(403);
    }
    expect((await getJson(ctx.app, '/admin/leads', (await asRole('support_manager')).jar)).status).toBe(200);
    expect((await getJson(ctx.app, '/admin/leads', (await asRole('student')).jar)).status).toBe(403);
  });

  it('lists open leads newest first, masked, with status counts (spam hidden)', async () => {
    const { jar } = await asRole('support_manager');
    const body = await readJson(await getJson(ctx.app, '/admin/leads', jar));
    expect(body.data.map((l: { id: string }) => l.id)).toEqual([ids.callback, ids.meera, ids.arjun, ids.formula]);
    expect(body.data[1]).toMatchObject({ name: 'Meera Shah', email: 'me***@gmail.com', phone: '+91 ••••• 45678', status: 'new', assignee: null });
    expect(body.meta).toMatchObject({ total: 4, counts: { open: 4, new: 2, contacted: 1, closed: 1, spam: 1, qualified: 0, converted: 0 } });
  });

  it('filters by status, reason, source, date range (IST) and search', async () => {
    const { jar } = await asRole('admin');
    const list = async (qs: string) => (await readJson(await getJson(ctx.app, `/admin/leads?${qs}`, jar))).data.map((l: { id: string }) => l.id);
    expect(await list('status=spam')).toEqual([ids.spam]);
    expect(await list('reason=training')).toEqual([ids.meera]);
    expect(await list('source=callback')).toEqual([ids.callback]);
    expect(await list('from=2026-11-10&to=2026-11-10')).toEqual([ids.meera]);
    expect(await list('q=raid')).toEqual([ids.arjun]);
    expect(await list('q=98989')).toEqual([ids.callback]);
    expect(await list('q=%25')).toEqual([]);
    expect((await getJson(ctx.app, '/admin/leads?from=10-11-2026', jar)).status).toBe(400);
  });

  it('paginates', async () => {
    const { jar } = await asRole('admin');
    const p2 = await readJson(await getJson(ctx.app, '/admin/leads?pageSize=3&page=2', jar));
    expect(p2.data.map((l: { id: string }) => l.id)).toEqual([ids.formula]);
    expect(p2.meta).toMatchObject({ page: 2, pageSize: 3, total: 4 });
  });

  it('shows full details with the notes timeline', async () => {
    const { jar } = await asRole('support_manager');
    const { data } = await readJson(await getJson(ctx.app, `/admin/leads/${ids.meera}`, jar));
    expect(data).toMatchObject({ email: 'meera.shah@gmail.com', phone: '+919812345678', message: 'Hindi batch?', notes: [] });
    expect(data.ipHash).toBeUndefined();
    expect((await getJson(ctx.app, '/admin/leads/01a1d000-0000-7000-8000-0000000000ff', jar)).status).toBe(404);
  });

  it('changes status and assignment, writing timeline notes and an audit entry', async () => {
    const { jar, id: supportId } = await asRole('support_manager', 'Neha');
    const res = await patch(jar, ids.meera, { status: 'contacted', assignedTo: supportId });
    expect(res.status).toBe(200);
    expect((await readJson(res)).data).toEqual({ id: ids.meera, status: 'contacted', assignee: { id: supportId, firstName: 'Neha' } });

    const notes = await ctx.db.select().from(leadNotes).where(eq(leadNotes.leadId, ids.meera));
    expect(notes.map((n) => n.type).sort()).toEqual(['assignment', 'status_change']);
    expect(notes.find((n) => n.type === 'status_change')).toMatchObject({ fromStatus: 'new', toStatus: 'contacted', authorId: supportId });
    expect(await ctx.db.$count(activityLogs, eq(activityLogs.action, 'leads.update'))).toBe(1);

    const mine = await readJson(await getJson(ctx.app, '/admin/leads?assignee=me', jar));
    expect(mine.data.map((l: { id: string }) => l.id)).toEqual([ids.meera]);
    // No-op update writes nothing.
    await patch(jar, ids.meera, { status: 'contacted' });
    expect(await ctx.db.$count(leadNotes, eq(leadNotes.leadId, ids.meera))).toBe(2);
  });

  it('only assigns to active staff who can see leads', async () => {
    const { jar } = await asRole('admin');
    const content = await asRole('content_manager');
    const res = await patch(jar, ids.meera, { assignedTo: content.id });
    expect(res.status).toBe(400);
    expect((await readJson(res)).error.details[0].path).toBe('assignedTo');
    const assignees = (await readJson(await getJson(ctx.app, '/admin/leads/assignees', jar))).data.map((s: { role: string }) => s.role);
    expect(assignees).not.toContain('content_manager');
    expect(assignees).toContain('admin');
  });

  it('adds staff notes; unknown fields and roles without edit are refused', async () => {
    const support = await asRole('support_manager');
    const ok = await postJson(ctx.app, `/admin/leads/${ids.arjun}/notes`, { type: 'call', body: 'Called, wants a quote' }, support.jar);
    expect(ok.status).toBe(201);
    const { data } = await readJson(await getJson(ctx.app, `/admin/leads/${ids.arjun}`, support.jar));
    expect(data.notes[0]).toMatchObject({ type: 'call', body: 'Called, wants a quote', author: { firstName: 'Staff' } });
    expect((await patch(support.jar, ids.arjun, { name: 'Hacked' })).status).toBe(400);
    expect((await postJson(ctx.app, `/admin/leads/${ids.arjun}/notes`, { body: '' }, support.jar)).status).toBe(400);
  });

  it('exports CSV with formulas neutralised, and logs the export', async () => {
    const { jar } = await asRole('support_manager');
    const res = await getJson(ctx.app, '/admin/leads/export.csv', jar);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toMatch(/attachment; filename="alpharecover-leads-\d+\.csv"/);
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM so Excel reads ₹ and Hindi names
    const csv = new TextDecoder().decode(bytes); // strips the BOM
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('Received (UTC),Source,Name,Email,Phone,Reason,Status,Assigned to,WhatsApp consent,Message,Page');
    expect(lines).toHaveLength(5); // header + 4 open leads (spam excluded)
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv).toContain('meera.shah@gmail.com'); // exports are full data, gated by leads.export
    const [log] = await ctx.db.select().from(activityLogs).where(eq(activityLogs.action, 'leads.export'));
    expect(log.metadata).toMatchObject({ rows: 4 });
    expect((await getJson(ctx.app, '/admin/leads/export.csv', (await asRole('finance_manager')).jar)).status).toBe(403);
  });
});

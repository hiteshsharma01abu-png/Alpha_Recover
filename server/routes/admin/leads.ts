import { and, asc, count, desc, eq, gte, isNull, like, lt, ne, or, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { Hono } from 'hono';
import { z } from 'zod';
import { LEAD_REASONS } from '../../../shared/leads';
import { can, type UserRole } from '../../../shared/permissions';
import { logActivity } from '../../audit';
import { getUser, requireStaff } from '../../auth/middleware';
import type { Database } from '../../db';
import { LEAD_STATUSES, leadNotes, leads, users } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { csvCell, maskEmail, maskPhone } from '../../lib/mask';
import { validate } from '../../lib/validate';
import type { AppEnv } from '../../types';

const reasonValues = LEAD_REASONS.map((r) => r.value) as [string, ...string[]];
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const leadFilters = z.object({
  status: z.enum(LEAD_STATUSES).optional(),
  reason: z.enum(reasonValues).optional(),
  source: z.enum(['contact_form', 'callback', 'whatsapp', 'manual']).optional(),
  /** 'me', 'unassigned' or a staff user id */
  assignee: z.union([z.literal('me'), z.literal('unassigned'), z.uuid()]).optional(),
  q: z.string().trim().max(100).optional(),
  /** Inclusive dates in India time */
  from: ymd.optional(),
  to: ymd.optional(),
});
type LeadFilters = z.infer<typeof leadFilters>;

const listQuery = leadFilters.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(['-createdAt', 'createdAt', 'status']).default('-createdAt'),
});

/** YYYY-MM-DD at 00:00 IST as a UTC Date. */
const istMidnight = (d: string) => new Date(`${d}T00:00:00+05:30`);

function filterConditions(f: LeadFilters, currentUserId: string, opts: { ignoreStatus?: boolean } = {}): SQL[] {
  const where: SQL[] = [isNull(leads.deletedAt)];
  if (!opts.ignoreStatus) {
    // Spam is only shown when asked for explicitly.
    where.push(f.status ? eq(leads.status, f.status) : ne(leads.status, 'spam'));
  }
  if (f.reason) where.push(eq(leads.reason, f.reason as NonNullable<(typeof leads.$inferSelect)['reason']>));
  if (f.source) where.push(eq(leads.source, f.source));
  if (f.assignee === 'me') where.push(eq(leads.assignedTo, currentUserId));
  else if (f.assignee === 'unassigned') where.push(isNull(leads.assignedTo));
  else if (f.assignee) where.push(eq(leads.assignedTo, f.assignee));
  if (f.from) where.push(gte(leads.createdAt, istMidnight(f.from)));
  if (f.to) where.push(lt(leads.createdAt, new Date(istMidnight(f.to).getTime() + 86_400_000)));
  if (f.q) {
    const term = `%${f.q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    const digits = f.q.replace(/\D/g, '');
    const parts = [like(leads.name, term), like(leads.email, term), like(leads.message, term)];
    if (digits.length >= 4) parts.push(like(leads.phone, `%${digits}%`));
    where.push(or(...parts)!);
  }
  return where;
}

const assignee = alias(users, 'assignee');
const author = alias(users, 'author');

async function loadLead(db: Database, id: string) {
  const [row] = await db
    .select({ lead: leads, assigneeName: assignee.firstName })
    .from(leads)
    .leftJoin(assignee, eq(assignee.id, leads.assignedTo))
    .where(and(eq(leads.id, id), isNull(leads.deletedAt)));
  if (!row) throw new AppError('NOT_FOUND', 'Lead not found');
  return row;
}

/** Leads & Inquiries admin module (docs/admin/NAVIGATION.md §3). */
export const adminLeadRoutes = new Hono<AppEnv>()
  .get('/leads', requireStaff('leads.view'), validate('query', listQuery), async (c) => {
    const q = c.req.valid('query');
    const { db } = c.get('deps');
    const me = (await getUser(c))!;
    const where = and(...filterConditions(q, me.id));
    const order = q.sort === 'createdAt' ? asc(leads.createdAt) : q.sort === 'status' ? asc(leads.status) : desc(leads.createdAt);

    const [rows, [{ total }], byStatus] = await Promise.all([
      db
        .select({
          id: leads.id,
          source: leads.source,
          name: leads.name,
          email: leads.email,
          phone: leads.phone,
          reason: leads.reason,
          status: leads.status,
          assignedTo: leads.assignedTo,
          assigneeName: assignee.firstName,
          createdAt: leads.createdAt,
        })
        .from(leads)
        .leftJoin(assignee, eq(assignee.id, leads.assignedTo))
        .where(where)
        .orderBy(order, desc(leads.id))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      db.select({ total: count() }).from(leads).where(where),
      // Tab counts use every filter except status itself.
      db
        .select({ status: leads.status, n: count() })
        .from(leads)
        .where(and(...filterConditions(q, me.id, { ignoreStatus: true })))
        .groupBy(leads.status),
    ]);

    const counts: Record<string, number> = { open: 0, ...Object.fromEntries(LEAD_STATUSES.map((s) => [s, 0])) };
    for (const r of byStatus) {
      counts[r.status] = Number(r.n);
      if (r.status !== 'spam') counts.open += Number(r.n);
    }
    return c.json({
      data: rows.map((r) => ({
        ...r,
        email: maskEmail(r.email),
        phone: maskPhone(r.phone),
        assignee: r.assignedTo ? { id: r.assignedTo, firstName: r.assigneeName } : null,
        assignedTo: undefined,
        assigneeName: undefined,
        createdAt: r.createdAt.toISOString(),
      })),
      meta: { page: q.page, pageSize: q.pageSize, total: Number(total), counts },
    });
  })

  /** Staff who can be assigned leads (they must be able to see them). */
  .get('/leads/assignees', requireStaff('leads.view'), async (c) => {
    const staff = await c
      .get('deps')
      .db.select({ id: users.id, firstName: users.firstName, role: users.role })
      .from(users)
      .where(and(ne(users.role, 'student'), eq(users.status, 'active'), isNull(users.deletedAt)))
      .orderBy(asc(users.firstName));
    return c.json({ data: staff.filter((s) => can(s.role as UserRole, 'leads.view')) });
  })

  .get('/leads/export.csv', requireStaff('leads.export'), validate('query', leadFilters), async (c) => {
    const f = c.req.valid('query');
    const { db } = c.get('deps');
    const me = (await getUser(c))!;
    const MAX = 50_000;
    const rows = await db
      .select({ lead: leads, assigneeName: assignee.firstName })
      .from(leads)
      .leftJoin(assignee, eq(assignee.id, leads.assignedTo))
      .where(and(...filterConditions(f, me.id)))
      .orderBy(desc(leads.createdAt))
      .limit(MAX);
    const header = ['Received (UTC)', 'Source', 'Name', 'Email', 'Phone', 'Reason', 'Status', 'Assigned to', 'WhatsApp consent', 'Message', 'Page'];
    const reasonLabel = (v: string | null) => LEAD_REASONS.find((r) => r.value === v)?.label ?? '';
    const lines = [
      header.map(csvCell).join(','),
      ...rows.map(({ lead: l, assigneeName }) =>
        [l.createdAt, l.source, l.name, l.email, l.phone, reasonLabel(l.reason), l.status, assigneeName, l.whatsappConsent ? 'yes' : 'no', l.message, l.pagePath]
          .map(csvCell)
          .join(','),
      ),
    ];
    await logActivity(c, { action: 'leads.export', metadata: { rows: rows.length, filters: f } });
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="alpharecover-leads-${stamp}.csv"`);
    return c.body(`﻿${lines.join('\r\n')}\r\n`);
  })

  .get('/leads/:id', requireStaff('leads.view'), validate('param', z.object({ id: z.uuid() })), async (c) => {
    const { db } = c.get('deps');
    const { lead, assigneeName } = await loadLead(db, c.req.valid('param').id);
    const notes = await db
      .select({ note: leadNotes, authorName: author.firstName })
      .from(leadNotes)
      .leftJoin(author, eq(author.id, leadNotes.authorId))
      .where(eq(leadNotes.leadId, lead.id))
      .orderBy(desc(leadNotes.createdAt), desc(leadNotes.id));
    return c.json({
      data: {
        ...lead,
        ipHash: undefined,
        deletedAt: undefined,
        assignee: lead.assignedTo ? { id: lead.assignedTo, firstName: assigneeName } : null,
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
        notes: notes.map(({ note, authorName }) => ({
          id: note.id,
          type: note.type,
          body: note.body,
          fromStatus: note.fromStatus,
          toStatus: note.toStatus,
          author: note.authorId ? { id: note.authorId, firstName: authorName } : null,
          createdAt: note.createdAt.toISOString(),
        })),
      },
    });
  })

  .patch(
    '/leads/:id',
    requireStaff('leads.edit'),
    validate('param', z.object({ id: z.uuid() })),
    validate('json', z.object({ status: z.enum(LEAD_STATUSES).optional(), assignedTo: z.uuid().nullable().optional() }).strict()),
    async (c) => {
      const { db } = c.get('deps');
      const me = (await getUser(c))!;
      const input = c.req.valid('json');
      const { lead } = await loadLead(db, c.req.valid('param').id);
      const set: Partial<typeof leads.$inferInsert> = {};
      const notes: (typeof leadNotes.$inferInsert)[] = [];

      if (input.status && input.status !== lead.status) {
        set.status = input.status;
        notes.push({ leadId: lead.id, authorId: me.id, type: 'status_change', fromStatus: lead.status, toStatus: input.status });
      }
      if (input.assignedTo !== undefined && input.assignedTo !== lead.assignedTo) {
        if (input.assignedTo) {
          const [target] = await db
            .select({ role: users.role, status: users.status, firstName: users.firstName })
            .from(users)
            .where(eq(users.id, input.assignedTo));
          if (!target || target.status !== 'active' || !can(target.role as UserRole, 'leads.view')) {
            throw new AppError('VALIDATION_ERROR', 'Leads can only be assigned to active staff who can see leads', {
              details: [{ path: 'assignedTo', message: 'Not an eligible staff member' }],
            });
          }
          notes.push({ leadId: lead.id, authorId: me.id, type: 'assignment', body: `Assigned to ${target.firstName}` });
        } else {
          notes.push({ leadId: lead.id, authorId: me.id, type: 'assignment', body: 'Unassigned' });
        }
        set.assignedTo = input.assignedTo;
      }

      if (Object.keys(set).length) {
        await db.transaction(async (tx) => {
          await tx.update(leads).set(set).where(eq(leads.id, lead.id));
          if (notes.length) await tx.insert(leadNotes).values(notes);
        });
        await logActivity(c, {
          action: 'leads.update',
          entityType: 'lead',
          entityId: lead.id,
          metadata: { before: { status: lead.status, assignedTo: lead.assignedTo }, after: set },
        });
      }
      const fresh = await loadLead(db, lead.id);
      return c.json({ data: { id: lead.id, status: fresh.lead.status, assignee: fresh.lead.assignedTo ? { id: fresh.lead.assignedTo, firstName: fresh.assigneeName } : null } });
    },
  )

  .post(
    '/leads/:id/notes',
    requireStaff('leads.edit'),
    validate('param', z.object({ id: z.uuid() })),
    validate('json', z.object({ type: z.enum(['note', 'call', 'email', 'whatsapp']).default('note'), body: z.string().trim().min(1, 'Write something').max(5000) })),
    async (c) => {
      const { db } = c.get('deps');
      const me = (await getUser(c))!;
      const { lead } = await loadLead(db, c.req.valid('param').id);
      const input = c.req.valid('json');
      await db.insert(leadNotes).values({ leadId: lead.id, authorId: me.id, type: input.type, body: input.body });
      await logActivity(c, { action: 'leads.note', entityType: 'lead', entityId: lead.id, metadata: { type: input.type } });
      return c.json({ data: { ok: true } }, 201);
    },
  );


import { and, asc, count, desc, eq, gte, like, lt, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { Hono } from 'hono';
import { z } from 'zod';
import { logActivity } from '../../audit';
import { requireStaff } from '../../auth/middleware';
import { activityLogs, users } from '../../db/schema';
import { csvCell } from '../../lib/mask';
import { validate } from '../../lib/validate';
import type { AppEnv } from '../../types';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const filters = z.object({
  actor: z.uuid().optional(),
  /** Exact action ("leads.update") or a module prefix ending in a dot ("leads."). */
  action: z
    .string()
    .trim()
    .max(64)
    .regex(/^[a-z_.]+$/, 'Letters, dots and underscores only')
    .optional(),
  entityType: z.string().trim().max(32).optional(),
  entityId: z.string().trim().max(64).optional(),
  from: ymd.optional(),
  to: ymd.optional(),
});
type Filters = z.infer<typeof filters>;

const istMidnight = (d: string) => new Date(`${d}T00:00:00+05:30`);

function conditions(f: Filters): SQL[] {
  const where: SQL[] = [];
  if (f.actor) where.push(eq(activityLogs.actorId, f.actor));
  if (f.action) where.push(f.action.endsWith('.') ? like(activityLogs.action, `${f.action.replace(/_/g, '\\_')}%`) : eq(activityLogs.action, f.action));
  if (f.entityType) where.push(eq(activityLogs.entityType, f.entityType));
  if (f.entityId) where.push(eq(activityLogs.entityId, f.entityId));
  if (f.from) where.push(gte(activityLogs.createdAt, istMidnight(f.from)));
  if (f.to) where.push(lt(activityLogs.createdAt, new Date(istMidnight(f.to).getTime() + 86_400_000)));
  return where;
}

const actor = alias(users, 'actor');
const columns = {
  id: activityLogs.id,
  action: activityLogs.action,
  actorId: activityLogs.actorId,
  actorRole: activityLogs.actorRole,
  actorName: actor.firstName,
  actorEmail: actor.email,
  entityType: activityLogs.entityType,
  entityId: activityLogs.entityId,
  metadata: activityLogs.metadata,
  requestId: activityLogs.requestId,
  createdAt: activityLogs.createdAt,
};

/** Activity log (audit trail): read-only. The IP hash never leaves the server. */
export const adminActivityRoutes = new Hono<AppEnv>()
  .get(
    '/activity',
    requireStaff('audit.view'),
    validate('query', filters.extend({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(50) })),
    async (c) => {
      const q = c.req.valid('query');
      const { db } = c.get('deps');
      const where = and(...conditions(q));
      const [rows, [{ total }]] = await Promise.all([
        db
          .select(columns)
          .from(activityLogs)
          .leftJoin(actor, eq(actor.id, activityLogs.actorId))
          .where(where)
          .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
          .limit(q.pageSize)
          .offset((q.page - 1) * q.pageSize),
        db.select({ total: count() }).from(activityLogs).where(where),
      ]);
      return c.json({
        data: rows.map(({ actorName, actorEmail, actorId, ...r }) => ({
          ...r,
          actor: actorId ? { id: actorId, firstName: actorName, email: actorEmail } : null,
          createdAt: r.createdAt.toISOString(),
        })),
        meta: { page: q.page, pageSize: q.pageSize, total: Number(total) },
      });
    },
  )

  /** Values for the filter dropdowns. */
  .get('/activity/facets', requireStaff('audit.view'), async (c) => {
    const { db } = c.get('deps');
    const [actions, actors] = await Promise.all([
      db.selectDistinct({ action: activityLogs.action }).from(activityLogs).orderBy(asc(activityLogs.action)),
      db
        .selectDistinct({ id: actor.id, firstName: actor.firstName, role: actor.role })
        .from(activityLogs)
        .innerJoin(actor, eq(actor.id, activityLogs.actorId))
        .orderBy(asc(actor.firstName)),
    ]);
    return c.json({ data: { actions: actions.map((a) => a.action), actors } });
  })

  .get('/activity/export.csv', requireStaff('audit.export'), validate('query', filters), async (c) => {
    const f = c.req.valid('query');
    const { db } = c.get('deps');
    const MAX = 50_000;
    const rows = await db
      .select(columns)
      .from(activityLogs)
      .leftJoin(actor, eq(actor.id, activityLogs.actorId))
      .where(and(...conditions(f)))
      .orderBy(desc(activityLogs.createdAt), desc(activityLogs.id))
      .limit(MAX);
    const header = ['Time (UTC)', 'Action', 'Actor', 'Actor email', 'Actor role', 'Entity type', 'Entity id', 'Details', 'Request id'];
    const lines = [
      header.map(csvCell).join(','),
      ...rows.map((r) =>
        [r.createdAt, r.action, r.actorName, r.actorEmail, r.actorRole, r.entityType, r.entityId, r.metadata ? JSON.stringify(r.metadata) : '', r.requestId].map(csvCell).join(','),
      ),
    ];
    await logActivity(c, { action: 'audit.export', metadata: { rows: rows.length, filters: f } });
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="alpharecover-activity-${stamp}.csv"`);
    return c.body(`﻿${lines.join('\r\n')}\r\n`);
  });

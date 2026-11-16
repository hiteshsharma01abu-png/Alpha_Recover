import { and, count, desc, eq, gt, gte, inArray, like, lt, lte, min, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { logActivity } from '../../audit';
import { requireStaff } from '../../auth/middleware';
import { notificationJobs } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { validate } from '../../lib/validate';
import { templates, type TemplateName } from '../../notifications/templates';
import type { AppEnv } from '../../types';
import { INVITE_TTL_MS } from './team';

const HOUR = 3_600_000;
/** Emails due longer than this mean the sending cron has probably stopped (the UI shows a warning). */
const STALL_MS = 30 * 60_000;
/**
 * Templates whose email carries a sign-in link, and how long that link works (server/auth/auth.ts,
 * team invites). Resending after that would deliver a dead link, so retry is refused.
 */
export const LINK_LIFETIME_MS: Partial<Record<TemplateName, number>> = {
  verify_email: 24 * HOUR,
  password_reset: HOUR,
  staff_invite: INVITE_TTL_MS,
};

/** What staff see: queued (waiting or being sent), retrying (failed at least once, will try again), sent, failed (gave up). */
const STATES = ['queued', 'retrying', 'sent', 'failed'] as const;
type State = (typeof STATES)[number];

function stateCondition(s: State): SQL {
  if (s === 'sent') return eq(notificationJobs.status, 'sent');
  if (s === 'failed') return inArray(notificationJobs.status, ['dead', 'failed']);
  if (s === 'retrying') return and(eq(notificationJobs.status, 'pending'), gt(notificationJobs.attempts, 0))!;
  return and(inArray(notificationJobs.status, ['pending', 'sending']), eq(notificationJobs.attempts, 0))!;
}

type Row = typeof notificationJobs.$inferSelect;

const stateOf = (r: Row): State =>
  r.status === 'sent' ? 'sent' : r.status === 'dead' || r.status === 'failed' ? 'failed' : r.status === 'pending' && r.attempts > 0 ? 'retrying' : 'queued';

/** Why this job can't be retried now, or null if it can. */
function retryBlock(r: Row, now: number): string | null {
  const state = stateOf(r);
  if (state === 'sent') return 'Already sent.';
  if (state === 'queued') return 'Already queued: it goes out with the next run (every few minutes).';
  const life = LINK_LIFETIME_MS[r.template as TemplateName];
  if (life && now - r.createdAt.getTime() >= life) return 'The link in this email has expired. Ask the person to request a new one (or resend the invite from Team & Access).';
  return null;
}

/** Subject line only. The payload itself never leaves the server: some carry live sign-in links. */
function subjectOf(r: Row): string | null {
  const render = templates[r.template as TemplateName] as ((p: unknown) => { subject: string }) | undefined;
  try {
    return render ? render(r.payload).subject : null;
  } catch {
    return null;
  }
}

const dto = (r: Row, now: number) => ({
  id: r.id,
  channel: r.channel,
  template: r.template,
  to: r.toAddress,
  subject: subjectOf(r),
  state: stateOf(r),
  attempts: r.attempts,
  lastError: r.lastError,
  providerMessageId: r.providerMessageId,
  createdAt: r.createdAt.toISOString(),
  sentAt: r.sentAt?.toISOString() ?? null,
  nextAttemptAt: r.status === 'pending' ? r.nextAttemptAt.toISOString() : null,
  retryBlockedReason: retryBlock(r, now),
});

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const istMidnight = (d: string) => new Date(`${d}T00:00:00+05:30`);

/** Email log (docs/admin/NAVIGATION.md §3): the outbox, newest first, with retry for failures. */
export const adminNotificationRoutes = new Hono<AppEnv>()
  .get(
    '/notifications',
    requireStaff('notifications.view'),
    validate(
      'query',
      z.object({
        state: z.enum(STATES).optional(),
        template: z.enum(Object.keys(templates) as [TemplateName, ...TemplateName[]]).optional(),
        q: z.string().trim().max(254).optional(),
        from: ymd.optional(),
        to: ymd.optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(50),
      }),
    ),
    async (c) => {
      const q = c.req.valid('query');
      const { db } = c.get('deps');
      const base: SQL[] = [];
      if (q.template) base.push(eq(notificationJobs.template, q.template));
      if (q.q) base.push(like(notificationJobs.toAddress, `%${q.q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`));
      if (q.from) base.push(gte(notificationJobs.createdAt, istMidnight(q.from)));
      if (q.to) base.push(lt(notificationJobs.createdAt, new Date(istMidnight(q.to).getTime() + 86_400_000)));
      const where = and(...base, q.state ? stateCondition(q.state) : undefined);

      const [[{ oldestDue }], rows, [{ total }], ...counts] = await Promise.all([
        // Oldest email that should already have gone out: if it's old, the sending cron isn't running.
        db
          .select({ oldestDue: min(notificationJobs.nextAttemptAt) })
          .from(notificationJobs)
          .where(and(eq(notificationJobs.status, 'pending'), lte(notificationJobs.nextAttemptAt, new Date()))),
        db
          .select()
          .from(notificationJobs)
          .where(where)
          .orderBy(desc(notificationJobs.createdAt), desc(notificationJobs.id))
          .limit(q.pageSize)
          .offset((q.page - 1) * q.pageSize),
        db.select({ total: count() }).from(notificationJobs).where(where),
        ...STATES.map((s) =>
          db
            .select({ n: count() })
            .from(notificationJobs)
            .where(and(...base, stateCondition(s)))
            .then(([r]) => Number(r.n)),
        ),
      ]);
      const now = Date.now();
      return c.json({
        data: rows.map((r) => dto(r, now)),
        meta: {
          page: q.page,
          pageSize: q.pageSize,
          total: Number(total),
          counts: Object.fromEntries(STATES.map((s, i) => [s, counts[i]])) as Record<State, number>,
          stalledSince: oldestDue && now - new Date(oldestDue).getTime() > STALL_MS ? new Date(oldestDue).toISOString() : null,
        },
      });
    },
  )

  /** Send a failed (or retrying) email again on the next cron run, with a fresh set of attempts. */
  .post('/notifications/:id/retry', requireStaff('notifications.edit'), validate('param', z.object({ id: z.uuid() })), async (c) => {
    const { db } = c.get('deps');
    const [job] = await db.select().from(notificationJobs).where(eq(notificationJobs.id, c.req.valid('param').id));
    if (!job) throw new AppError('NOT_FOUND', 'Email not found');
    const blocked = retryBlock(job, Date.now());
    if (blocked) throw new AppError('BUSINESS_RULE', blocked);
    // Only rows still waiting or failed: if the cron claimed it meanwhile (status 'sending'), leave it alone.
    const [result] = await db
      .update(notificationJobs)
      .set({ status: 'pending', attempts: 0, nextAttemptAt: new Date() })
      .where(and(eq(notificationJobs.id, job.id), inArray(notificationJobs.status, ['pending', 'dead', 'failed'])));
    if (result.affectedRows !== 1) throw new AppError('CONFLICT', 'This email is being sent right now. Refresh in a minute.');
    await logActivity(c, { action: 'notifications.retry', entityType: 'notification', entityId: job.id, metadata: { template: job.template, to: job.toAddress, previousAttempts: job.attempts } });
    return c.json({ data: { ok: true } });
  });

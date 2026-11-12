import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import type { Database } from '../db';
import { notificationJobs } from '../db/schema';
import { logger } from '../lib/logger';
import type { Mailer } from './mailer';
import { templates, type TemplateName, type TemplatePayload } from './templates';

export const MAX_ATTEMPTS = 5;

/** Queues an email. The cron drain sends it (and retries with backoff); callers never block on delivery. */
export async function enqueueEmail<T extends TemplateName>(
  db: Database,
  template: T,
  to: string,
  payload: TemplatePayload<T>,
) {
  await db.insert(notificationJobs).values({ channel: 'email', template, toAddress: to, payload });
}

/** Backoff before attempt n+1: 1, 2, 4, 8 minutes. */
export function backoffMs(attempts: number) {
  return 2 ** Math.max(0, attempts - 1) * 60_000;
}

/**
 * Claims up to `limit` due jobs (row locks with SKIP LOCKED so parallel cron runs never double-send),
 * sends them, and records the outcome. Returns counts for the cron response.
 */
export async function drainOutbox(db: Database, mailer: Mailer, limit = 50) {
  const now = new Date();
  const claimed = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(notificationJobs)
      .where(and(eq(notificationJobs.status, 'pending'), lte(notificationJobs.nextAttemptAt, now)))
      .orderBy(notificationJobs.nextAttemptAt)
      .limit(limit)
      .for('update', { skipLocked: true });
    if (rows.length) {
      await tx
        .update(notificationJobs)
        .set({ status: 'sending' })
        .where(inArray(notificationJobs.id, rows.map((r) => r.id)));
    }
    return rows;
  });

  let sent = 0;
  let failed = 0;
  for (const job of claimed) {
    const attempts = job.attempts + 1;
    try {
      if (job.channel !== 'email') throw new Error(`Channel ${job.channel} is not configured yet`);
      const render = templates[job.template as TemplateName] as ((p: unknown) => ReturnType<(typeof templates)[TemplateName]>) | undefined;
      if (!render) throw new Error(`Unknown template ${job.template}`);
      const message = render(job.payload);
      const { messageId } = await mailer.send({ to: job.toAddress, ...message, tag: job.template });
      await db
        .update(notificationJobs)
        .set({ status: 'sent', attempts, providerMessageId: messageId, sentAt: new Date(), lastError: null })
        .where(eq(notificationJobs.id, job.id));
      sent += 1;
    } catch (err) {
      failed += 1;
      const dead = attempts >= MAX_ATTEMPTS;
      const error = err instanceof Error ? err.message : String(err);
      await db
        .update(notificationJobs)
        .set({
          status: dead ? 'dead' : 'pending',
          attempts,
          lastError: error.slice(0, 2000),
          nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
        })
        .where(eq(notificationJobs.id, job.id));
      logger[dead ? 'error' : 'warn']('notification send failed', { jobId: job.id, template: job.template, attempts, dead, error });
    }
  }
  return { claimed: claimed.length, sent, failed };
}

/** Jobs stuck in `sending` (process crashed mid-send) go back to pending after 10 minutes. */
export async function releaseStuckJobs(db: Database) {
  await db
    .update(notificationJobs)
    .set({ status: 'pending' })
    .where(and(eq(notificationJobs.status, 'sending'), lte(notificationJobs.updatedAt, sql`NOW(3) - INTERVAL 10 MINUTE`)));
}

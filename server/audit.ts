import type { Context } from 'hono';
import { activityLogs } from './db/schema';
import { clientIp, hashValue } from './lib/request';
import type { UserRole } from './db/schema';
import type { AppEnv } from './types';

export type ActivityEntry = {
  action: string; // e.g. 'enrollment.grant', 'auth.login_failed'
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>; // before/after diff; never secrets or password hashes
  /** Actor when it isn't the session user yet (e.g. right after login). */
  actor?: { id: string; role: UserRole } | null;
};

/** Append-only audit trail (docs/SECURITY.md §7). Call for every admin mutation and security event. */
export async function logActivity(c: Context<AppEnv>, entry: ActivityEntry) {
  const { db, env } = c.get('deps');
  const user = entry.actor !== undefined ? entry.actor : c.get('user');
  await db.insert(activityLogs).values({
    actorId: user?.id ?? null,
    actorRole: user?.role ?? null,
    action: entry.action,
    entityType: entry.entityType ?? null,
    entityId: entry.entityId ?? null,
    metadata: entry.metadata ?? null,
    ipHash: hashValue(clientIp(c), env.IP_HASH_SALT),
    requestId: c.get('requestId'),
  });
}

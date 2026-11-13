import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Database } from '../db';
import { sessions, type UserRole } from '../db/schema';
import { getSetting } from '../settings';

export const STAFF_MAX_SESSIONS = 3;

/**
 * Keeps at most N live sessions per user (students: site setting, default 2; staff: 3), signing out
 * the oldest. Limits account sharing on a lifetime-access product (docs/PRD.md FR-A6).
 * Returns how many sessions were removed.
 */
export async function enforceSessionLimit(db: Database, userId: string, role: UserRole): Promise<number> {
  const max = role === 'student' ? await getSetting(db, 'max_student_sessions', 2) : STAFF_MAX_SESSIONS;
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt), desc(sessions.id));
  const extra = rows.slice(max).map((r) => r.id);
  if (extra.length) await db.delete(sessions).where(and(eq(sessions.userId, userId), inArray(sessions.id, extra)));
  return extra.length;
}

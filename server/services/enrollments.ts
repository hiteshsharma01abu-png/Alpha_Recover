import { and, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { Database } from '../db';
import { courses, enrollments, planCourses, plans } from '../db/schema';

export type EnrollmentSource = 'purchase' | 'manual' | 'complimentary';

/** Active and not past its end date (null = lifetime). */
const live = (now: Date) => and(eq(enrollments.status, 'active'), or(isNull(enrollments.expiresAt), gt(enrollments.expiresAt, now)));

/**
 * Grants a plan to a user. Idempotent: an order activates at most once (unique order_id), and a user
 * holds at most one active enrollment per plan (unique active_flag + user + plan), so repeated calls return the
 * existing row instead of failing. Callers that need atomicity (payments) pass their transaction.
 */
export async function grantEnrollment(
  db: Database,
  input: { userId: string; planId: string; source: EnrollmentSource; orderId?: string; expiresAt?: Date | null; grantedBy?: string },
) {
  if (input.orderId) {
    const [byOrder] = await db.select().from(enrollments).where(eq(enrollments.orderId, input.orderId));
    if (byOrder) return { enrollment: byOrder, created: false };
  }
  const [active] = await db
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, input.userId), eq(enrollments.planId, input.planId), eq(enrollments.status, 'active')));
  if (active) return { enrollment: active, created: false };

  const inserted = await db
    .insert(enrollments)
    .values({
      userId: input.userId,
      planId: input.planId,
      source: input.source,
      orderId: input.orderId ?? null,
      startsAt: new Date(),
      expiresAt: input.expiresAt ?? null,
      grantedBy: input.grantedBy ?? null,
    })
    // A concurrent grant may win the race on either unique index; then we read the winner below.
    .onDuplicateKeyUpdate({ set: { id: sql`id` } });
  const [row] = await db
    .select()
    .from(enrollments)
    .where(
      input.orderId
        ? eq(enrollments.orderId, input.orderId)
        : and(eq(enrollments.userId, input.userId), eq(enrollments.planId, input.planId), eq(enrollments.status, 'active')),
    );
  // affectedRows: 1 = inserted, 0 = a concurrent grant already created it (no-op update).
  return { enrollment: row, created: inserted[0].affectedRows === 1 };
}

/** Ends access immediately (refunds, chargebacks, admin action). Returns false if it wasn't active. */
export async function revokeEnrollment(db: Database, enrollmentId: string, reason: string) {
  const result = await db
    .update(enrollments)
    .set({ status: 'revoked', revokedAt: new Date(), revokedReason: reason })
    .where(and(eq(enrollments.id, enrollmentId), eq(enrollments.status, 'active')));
  return result[0].affectedRows === 1;
}

/**
 * Courses a user can open now (docs/DATABASE.md §15 access rule): any live enrollment in a plan that
 * grants all courses, or the plan's listed courses. Returns course ids.
 */
export async function accessibleCourseIds(db: Database, userId: string, now = new Date()): Promise<Set<string>> {
  const rows = await db
    .select({ planId: enrollments.planId, grantsAll: plans.grantsAllCourses })
    .from(enrollments)
    .innerJoin(plans, eq(plans.id, enrollments.planId))
    .where(and(eq(enrollments.userId, userId), live(now)));
  if (!rows.length) return new Set();
  if (rows.some((r) => r.grantsAll)) {
    const all = await db.select({ id: courses.id }).from(courses).where(isNull(courses.deletedAt));
    return new Set(all.map((c) => c.id));
  }
  const listed = await db
    .select({ courseId: planCourses.courseId })
    .from(planCourses)
    .where(inArray(planCourses.planId, rows.map((r) => r.planId)));
  return new Set(listed.map((r) => r.courseId));
}

export async function canAccessCourse(db: Database, userId: string, courseId: string, now = new Date()) {
  return (await accessibleCourseIds(db, userId, now)).has(courseId);
}

/** Marks enrollments whose end date has passed as expired (cosmetic: access checks use expires_at). */
export async function expireEnrollments(db: Database, now = new Date()) {
  const result = await db
    .update(enrollments)
    .set({ status: 'expired' })
    .where(and(eq(enrollments.status, 'active'), lte(enrollments.expiresAt, now)));
  return result[0].affectedRows;
}

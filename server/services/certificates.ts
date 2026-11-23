import { and, eq, or, sql } from 'drizzle-orm';
import type { Database } from '../db';
import { certificates, courses, users } from '../db/schema';
import { DEFAULT_CERTIFICATE_CRITERIA, getSetting } from '../settings';
import { courseProgress } from './learning';

export const CERTIFICATE_CODE = /^AR-\d{4}-\d{5}$/;

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Next certificate code for `year`, gap-free and safe under concurrency (docs/DATABASE.md §20).
 * Must run inside the issuing transaction: LAST_INSERT_ID() is per-connection, and the row lock on
 * the year's counter serializes parallel issues until commit. (`year` is a keyword: keep it quoted.)
 */
export async function allocateCertificateCode(tx: Tx, year: number): Promise<string> {
  await tx.execute(sql`
    INSERT INTO certificate_sequences (\`year\`, last_number) VALUES (${year}, LAST_INSERT_ID(1))
    ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1)`);
  const [rows] = (await tx.execute(sql`SELECT LAST_INSERT_ID() AS n`)) as unknown as [{ n: number | string }[]];
  return `AR-${year}-${String(Number(rows[0].n)).padStart(5, '0')}`;
}

export type CertificateVerification = {
  code: string;
  status: 'valid' | 'revoked';
  recipientName: string;
  programTitle: string;
  /** YYYY-MM-DD in India time */
  issuedAt: string;
  revokedAt?: string;
};

const indiaDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/** Public verification: only what a third party needs. Never email, phone or the revocation reason. */
export async function verifyCertificate(db: Database, code: string): Promise<CertificateVerification | null> {
  const [c] = await db.select().from(certificates).where(eq(certificates.code, code));
  if (!c) return null;
  return {
    code: c.code,
    status: c.status,
    recipientName: c.recipientName,
    programTitle: c.programTitle,
    issuedAt: indiaDate(c.issuedAt),
    ...(c.status === 'revoked' && c.revokedAt ? { revokedAt: indiaDate(c.revokedAt) } : {}),
  };
}

const indiaYear = (d: Date) => Number(d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 4));

/** The name printed on a certificate: the student's "name on certificate", else first + last name. */
export const printedName = (u: { certificateName: string | null; firstName: string; lastName: string | null }) =>
  u.certificateName ?? [u.firstName, u.lastName].filter(Boolean).join(' ');

/**
 * Issues the course certificate when the student has completed every published lesson of it and the
 * `certificate_criteria` setting is automatic. At most one valid certificate per student and course
 * (or program title, matching the admin rule): the student's row is locked while checking, so two
 * lessons finished at the same moment can't issue twice. Returns the new certificate, or null.
 */
export async function issueCourseCertificateIfComplete(db: Database, userId: string, courseId: string) {
  const criteria = await getSetting(db, 'certificate_criteria', DEFAULT_CERTIFICATE_CRITERIA);
  if (criteria.type !== 'all_lessons_completed') return null;
  const progress = await courseProgress(db, userId, courseId);
  if (!progress.total || progress.completed < progress.total) return null;
  const [course] = await db.select({ title: courses.title }).from(courses).where(eq(courses.id, courseId));
  if (!course) return null;

  return db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
    if (!user || user.role !== 'student') return null;
    const [existing] = await tx
      .select({ id: certificates.id })
      .from(certificates)
      .where(
        and(eq(certificates.userId, userId), eq(certificates.status, 'valid'), or(eq(certificates.courseId, courseId), eq(certificates.programTitle, course.title))),
      );
    if (existing) return null;
    const issuedAt = new Date();
    const code = await allocateCertificateCode(tx, indiaYear(issuedAt));
    const recipientName = printedName(user);
    const [created] = await tx
      .insert(certificates)
      .values({ code, userId, courseId, recipientName, programTitle: course.title, issuedAt })
      .$returningId();
    return { id: created.id, code, recipientName, programTitle: course.title, email: user.email, firstName: user.firstName };
  });
}

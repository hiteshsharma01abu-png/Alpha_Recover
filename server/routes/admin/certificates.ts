import { and, asc, count, desc, eq, gte, isNull, like, lt, or, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/mysql-core';
import { Hono } from 'hono';
import { z } from 'zod';
import { logActivity } from '../../audit';
import { requireStaff } from '../../auth/middleware';
import type { Database } from '../../db';
import { certificates, courses, plans, users } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { csvCell, maskEmail } from '../../lib/mask';
import { validate } from '../../lib/validate';
import { allocateCertificateCode } from '../../services/certificates';
import type { AppEnv } from '../../types';

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const idParam = z.object({ id: z.uuid() });
const name = z.string().trim().min(2, 'Enter the name to print').max(160);
const filters = z.object({
  status: z.enum(['valid', 'revoked']).optional(),
  /** Code, recipient name or student email. */
  q: z.string().trim().max(100).optional(),
  userId: z.uuid().optional(),
  from: ymd.optional(),
  to: ymd.optional(),
});
type Filters = z.infer<typeof filters>;

const istMidnight = (d: string) => new Date(`${d}T00:00:00+05:30`);
const todayIst = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

function conditions(f: Filters): SQL[] {
  const where: SQL[] = [];
  if (f.status) where.push(eq(certificates.status, f.status));
  if (f.userId) where.push(eq(certificates.userId, f.userId));
  if (f.q) {
    const term = `%${f.q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    where.push(or(like(certificates.code, term), like(certificates.recipientName, term), like(users.email, term))!);
  }
  if (f.from) where.push(gte(certificates.issuedAt, istMidnight(f.from)));
  if (f.to) where.push(lt(certificates.issuedAt, new Date(istMidnight(f.to).getTime() + 86_400_000)));
  return where;
}

const issuer = alias(users, 'issuer');
const columns = {
  id: certificates.id,
  code: certificates.code,
  userId: certificates.userId,
  studentFirstName: users.firstName,
  studentLastName: users.lastName,
  studentEmail: users.email,
  recipientName: certificates.recipientName,
  programTitle: certificates.programTitle,
  planId: certificates.planId,
  courseId: certificates.courseId,
  issuedAt: certificates.issuedAt,
  status: certificates.status,
  revokedAt: certificates.revokedAt,
  revokedReason: certificates.revokedReason,
  issuedById: issuer.id,
  issuedByName: issuer.firstName,
};

async function loadCertificate(db: Database, id: string) {
  const [row] = await db.select().from(certificates).where(eq(certificates.id, id));
  if (!row) throw new AppError('NOT_FOUND', 'Certificate not found');
  return row;
}

const iso = (d: Date | null) => d?.toISOString() ?? null;

/**
 * Certificates admin module (docs/admin/NAVIGATION.md §3): look up, issue manually, correct the
 * printed name, revoke. PDFs and the "certificate issued" email arrive with Phase 4.
 */
export const adminCertificateRoutes = new Hono<AppEnv>()
  .get(
    '/certificates',
    requireStaff('certificates.view'),
    validate('query', filters.extend({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) })),
    async (c) => {
      const q = c.req.valid('query');
      const { db } = c.get('deps');
      // Counts ignore the status filter (they label the tabs); the list applies it.
      const base = conditions({ ...q, status: undefined });
      const where = and(...base, q.status ? eq(certificates.status, q.status) : undefined);
      const [rows, [{ total }], byStatus] = await Promise.all([
        db
          .select(columns)
          .from(certificates)
          .innerJoin(users, eq(users.id, certificates.userId))
          .leftJoin(issuer, eq(issuer.id, certificates.issuedBy))
          .where(where)
          .orderBy(desc(certificates.issuedAt), desc(certificates.code))
          .limit(q.pageSize)
          .offset((q.page - 1) * q.pageSize),
        db.select({ total: count() }).from(certificates).innerJoin(users, eq(users.id, certificates.userId)).where(where),
        db
          .select({ status: certificates.status, n: count() })
          .from(certificates)
          .innerJoin(users, eq(users.id, certificates.userId))
          .where(and(...base))
          .groupBy(certificates.status),
      ]);
      const n = (s: string) => Number(byStatus.find((r) => r.status === s)?.n ?? 0);
      return c.json({
        data: rows.map(({ studentFirstName, studentLastName, studentEmail, issuedById, issuedByName, ...r }) => ({
          ...r,
          student: { id: r.userId, firstName: studentFirstName, lastName: studentLastName, email: maskEmail(studentEmail) },
          issuedBy: issuedById ? { id: issuedById, firstName: issuedByName } : null,
          issuedAt: r.issuedAt.toISOString(),
          revokedAt: iso(r.revokedAt),
        })),
        meta: { page: q.page, pageSize: q.pageSize, total: Number(total), counts: { valid: n('valid'), revoked: n('revoked') } },
      });
    },
  )

  /** Plans and courses to pick a program title from (free text is allowed too, e.g. an offline batch). */
  .get('/certificates/programs', requireStaff('certificates.view'), async (c) => {
    const { db } = c.get('deps');
    const [planRows, courseRows] = await Promise.all([
      db.select({ id: plans.id, title: plans.name }).from(plans).where(isNull(plans.deletedAt)).orderBy(asc(plans.sortOrder)),
      db.select({ id: courses.id, title: courses.title }).from(courses).where(isNull(courses.deletedAt)).orderBy(asc(courses.sortOrder)),
    ]);
    return c.json({ data: { plans: planRows, courses: courseRows } });
  })

  .get('/certificates/export.csv', requireStaff('certificates.export'), validate('query', filters), async (c) => {
    const f = c.req.valid('query');
    const { db } = c.get('deps');
    const rows = await db
      .select(columns)
      .from(certificates)
      .innerJoin(users, eq(users.id, certificates.userId))
      .leftJoin(issuer, eq(issuer.id, certificates.issuedBy))
      .where(and(...conditions(f)))
      .orderBy(desc(certificates.issuedAt), desc(certificates.code))
      .limit(50_000);
    const header = ['Code', 'Status', 'Recipient name', 'Program', 'Issued (UTC)', 'Student email', 'Issued by', 'Revoked (UTC)', 'Revoke reason'];
    const lines = [
      header.map(csvCell).join(','),
      ...rows.map((r) => [r.code, r.status, r.recipientName, r.programTitle, r.issuedAt, r.studentEmail, r.issuedByName, r.revokedAt, r.revokedReason].map(csvCell).join(',')),
    ];
    await logActivity(c, { action: 'certificates.export', metadata: { rows: rows.length, filters: f } });
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    c.header('Content-Type', 'text/csv; charset=utf-8');
    c.header('Content-Disposition', `attachment; filename="alpharecover-certificates-${stamp}.csv"`);
    return c.body(`﻿${lines.join('\r\n')}\r\n`);
  })

  /**
   * Manual issue. `recipientName` defaults to the student's "name on certificate" (else first + last).
   * `issuedOn` (IST day, not in the future) allows recording an earlier offline batch; the code's year
   * follows it. One valid certificate per student and program.
   */
  .post(
    '/certificates',
    requireStaff('certificates.add'),
    validate(
      'json',
      z
        .object({
          userId: z.uuid(),
          programTitle: z.string().trim().min(3, 'Enter the program').max(200),
          planId: z.uuid().nullable().optional(),
          courseId: z.uuid().nullable().optional(),
          recipientName: name.optional(),
          issuedOn: ymd.optional(),
        })
        .strict(),
    ),
    async (c) => {
      const input = c.req.valid('json');
      const { db } = c.get('deps');
      const [student] = await db
        .select()
        .from(users)
        .where(and(eq(users.id, input.userId), eq(users.role, 'student'), isNull(users.deletedAt)));
      if (!student) throw new AppError('NOT_FOUND', 'Student not found');
      if (input.planId && !(await db.select({ id: plans.id }).from(plans).where(eq(plans.id, input.planId))).length) throw new AppError('NOT_FOUND', 'Plan not found');
      if (input.courseId && !(await db.select({ id: courses.id }).from(courses).where(eq(courses.id, input.courseId))).length) throw new AppError('NOT_FOUND', 'Course not found');

      const issuedOn = input.issuedOn ?? todayIst();
      if (issuedOn > todayIst()) throw new AppError('VALIDATION_ERROR', 'The issue date can’t be in the future', { details: [{ path: 'issuedOn', message: 'Not in the future' }] });
      // Midday IST keeps the stored instant on the chosen India date in every timezone view.
      const issuedAt = issuedOn === todayIst() ? new Date() : new Date(`${issuedOn}T12:00:00+05:30`);
      const recipientName = input.recipientName ?? student.certificateName ?? [student.firstName, student.lastName].filter(Boolean).join(' ');

      const [dup] = await db
        .select({ code: certificates.code })
        .from(certificates)
        .where(and(eq(certificates.userId, student.id), eq(certificates.programTitle, input.programTitle), eq(certificates.status, 'valid')));
      if (dup) throw new AppError('CONFLICT', `This student already has a valid certificate for this program (${dup.code}).`);

      const row = await db.transaction(async (tx) => {
        const code = await allocateCertificateCode(tx, Number(issuedOn.slice(0, 4)));
        const [created] = await tx
          .insert(certificates)
          .values({
            code,
            userId: student.id,
            planId: input.planId ?? null,
            courseId: input.courseId ?? null,
            recipientName,
            programTitle: input.programTitle,
            issuedAt,
            issuedBy: c.get('user')!.id,
          })
          .$returningId();
        return { id: created.id, code };
      });
      await logActivity(c, {
        action: 'certificates.issue',
        entityType: 'certificate',
        entityId: row.id,
        metadata: { code: row.code, userId: student.id, recipientName, programTitle: input.programTitle, issuedOn },
      });
      return c.json({ data: { id: row.id, code: row.code, recipientName } }, 201);
    },
  )

  /** Fix a misspelt printed name. The code stays the same, so printed copies and links keep working. */
  .patch('/certificates/:id', requireStaff('certificates.edit'), validate('param', idParam), validate('json', z.object({ recipientName: name }).strict()), async (c) => {
    const { db } = c.get('deps');
    const cert = await loadCertificate(db, c.req.valid('param').id);
    if (cert.status !== 'valid') throw new AppError('BUSINESS_RULE', 'This certificate is revoked. Issue a new one instead.');
    const { recipientName } = c.req.valid('json');
    if (recipientName === cert.recipientName) return c.json({ data: { ok: true, changed: false } });
    await db.update(certificates).set({ recipientName }).where(eq(certificates.id, cert.id));
    await logActivity(c, { action: 'certificates.update', entityType: 'certificate', entityId: cert.id, metadata: { code: cert.code, before: { recipientName: cert.recipientName }, after: { recipientName } } });
    return c.json({ data: { ok: true, changed: true } });
  })

  .post(
    '/certificates/:id/revoke',
    requireStaff('certificates.revoke'),
    validate('param', idParam),
    validate('json', z.object({ reason: z.string().trim().min(3, 'Give a short reason').max(500) }).strict()),
    async (c) => {
      const { db } = c.get('deps');
      const cert = await loadCertificate(db, c.req.valid('param').id);
      const { reason } = c.req.valid('json');
      const [result] = await db
        .update(certificates)
        .set({ status: 'revoked', revokedAt: new Date(), revokedReason: reason })
        .where(and(eq(certificates.id, cert.id), eq(certificates.status, 'valid')));
      if (result.affectedRows !== 1) throw new AppError('BUSINESS_RULE', 'This certificate is already revoked.');
      await logActivity(c, { action: 'certificates.revoke', entityType: 'certificate', entityId: cert.id, metadata: { code: cert.code, userId: cert.userId, reason } });
      return c.json({ data: { ok: true } });
    },
  );

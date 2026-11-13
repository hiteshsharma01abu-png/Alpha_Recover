import { eq, sql } from 'drizzle-orm';
import type { Database } from '../db';
import { certificates } from '../db/schema';

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

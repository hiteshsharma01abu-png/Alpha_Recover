import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { certificates, certificateSequences } from './db/schema';
import { allocateCertificateCode } from './services/certificates';
import { createTestContext, readJson, resetTables, signUp } from './test/helpers';

const dbAvailable = inject('dbAvailable');

describe.skipIf(!dbAvailable)('certificates (MySQL)', () => {
  let ctx: ReturnType<typeof createTestContext>;
  let userId: string;

  beforeAll(() => {
    ctx = createTestContext();
  });
  afterAll(async () => {
    await ctx.close();
  });
  beforeEach(async () => {
    await resetTables(ctx.db);
    ({ userId } = await signUp(ctx, 'grad@example.com'));
  });

  const issue = (code: string, extra: Partial<typeof certificates.$inferInsert> = {}) =>
    ctx.db.insert(certificates).values({
      code,
      userId,
      recipientName: 'Ravi Patel',
      programTitle: 'Professional Data Recovery Training',
      issuedAt: new Date('2026-10-02T06:00:00Z'),
      ...extra,
    });

  describe('code allocation', () => {
    it('numbers certificates per year, starting at 00001', async () => {
      const codes: string[] = [];
      for (let i = 0; i < 3; i += 1) codes.push(await ctx.db.transaction((tx) => allocateCertificateCode(tx, 2026)));
      codes.push(await ctx.db.transaction((tx) => allocateCertificateCode(tx, 2027)));
      expect(codes).toEqual(['AR-2026-00001', 'AR-2026-00002', 'AR-2026-00003', 'AR-2027-00001']);
    });

    it('stays unique and gap-free under concurrent issuing', async () => {
      const codes = await Promise.all(
        Array.from({ length: 20 }, () => ctx.db.transaction((tx) => allocateCertificateCode(tx, 2026))),
      );
      expect(new Set(codes).size).toBe(20);
      expect([...codes].sort()).toEqual(Array.from({ length: 20 }, (_, i) => `AR-2026-${String(i + 1).padStart(5, '0')}`));
      const [seq] = await ctx.db.select().from(certificateSequences).where(eq(certificateSequences.year, 2026));
      expect(seq.lastNumber).toBe(20);
    });

    it('does not consume a number when the issuing transaction rolls back', async () => {
      await expect(
        ctx.db.transaction(async (tx) => {
          await allocateCertificateCode(tx, 2026);
          throw new Error('PDF generation failed');
        }),
      ).rejects.toThrow('PDF generation failed');
      expect(await ctx.db.transaction((tx) => allocateCertificateCode(tx, 2026))).toBe('AR-2026-00001');
    });
  });

  describe('GET /certificates/verify/:code', () => {
    const verify = (code: string) => ctx.app.request(`/api/v1/certificates/verify/${encodeURIComponent(code)}`);

    it('confirms a valid certificate with only public details', async () => {
      await issue('AR-2026-00421');
      const res = await verify('AR-2026-00421');
      expect(res.status).toBe(200);
      const { data } = await readJson(res);
      expect(data).toEqual({
        code: 'AR-2026-00421',
        status: 'valid',
        recipientName: 'Ravi Patel',
        programTitle: 'Professional Data Recovery Training',
        issuedAt: '2026-10-02',
      });
      const raw = JSON.stringify(data);
      expect(raw).not.toContain('grad@example.com');
      expect(raw).not.toContain(userId);
    });

    it('accepts lower-case input and surrounding spaces', async () => {
      await issue('AR-2026-00421');
      expect((await verify(' ar-2026-00421 ')).status).toBe(200);
    });

    it('reports revoked certificates without the reason', async () => {
      await issue('AR-2026-00007', { status: 'revoked', revokedAt: new Date('2026-11-01T06:00:00Z'), revokedReason: 'Chargeback' });
      const { data } = await readJson(await verify('AR-2026-00007'));
      expect(data).toMatchObject({ status: 'revoked', revokedAt: '2026-11-01' });
      expect(JSON.stringify(data)).not.toContain('Chargeback');
    });

    it('gives the same 404 for unknown and malformed codes', async () => {
      const unknown = await verify('AR-2026-99999');
      const malformed = await verify('not-a-code');
      expect(unknown.status).toBe(404);
      expect(malformed.status).toBe(404);
      expect((await readJson(unknown)).error.message).toBe((await readJson(malformed)).error.message);
    });

    it('rate limits lookups to 30 per minute per IP', async () => {
      for (let i = 0; i < 30; i += 1) await verify('AR-2026-00001');
      expect((await verify('AR-2026-00001')).status).toBe(429);
    });
  });
});

import { sql } from 'drizzle-orm';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import { createDb } from '../db';
import { parseEnv } from '../env';
import type { EmailMessage, Mailer } from '../notifications/mailer';

export const testDatabaseUrl = () =>
  process.env.TEST_DATABASE_URL ?? 'mysql://app:app@127.0.0.1:3307/alpharecover_test';

const SECRET = 'test-secret-test-secret-test-secret-1234';

export const testEnv = () =>
  parseEnv({
    NODE_ENV: 'test',
    APP_URL: 'http://localhost:5173',
    DATABASE_URL: testDatabaseUrl(),
    BETTER_AUTH_SECRET: SECRET,
    CRON_SECRET: SECRET,
    IP_HASH_SALT: SECRET,
    LOG_LEVEL: 'error',
  });

/** Mailer that records messages and can be told to fail. */
export function recordingMailer() {
  const sent: EmailMessage[] = [];
  let failWith: string | null = null;
  const mailer: Mailer & { sent: EmailMessage[]; fail: (msg: string | null) => void } = {
    sent,
    fail: (msg) => {
      failWith = msg;
    },
    async send(message) {
      if (failWith) throw new Error(failWith);
      sent.push(message);
      return { messageId: `test-${sent.length}` };
    },
  };
  return mailer;
}

/** A full app wired to the test database. Call `close()` in afterAll. */
export function createTestContext() {
  const env = testEnv();
  const { db, pool } = createDb(env.DATABASE_URL);
  const auth = createAuth(env, db);
  const mailer = recordingMailer();
  const app = createApp({ env, db, auth, mailer });
  return { env, db, pool, auth, mailer, app, close: () => pool.end() };
}

/** Empties every table (keeps the schema). */
export async function resetTables(db: ReturnType<typeof createDb>['db']) {
  const [rows] = (await db.execute(
    sql`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name <> '__drizzle_migrations'`,
  )) as unknown as [{ name: string }[]];
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 0`);
  for (const { name } of rows) await db.execute(sql.raw(`TRUNCATE TABLE \`${name}\``));
  await db.execute(sql`SET FOREIGN_KEY_CHECKS = 1`);
}

/** Registers a user through Better Auth and returns its session cookie. */
export async function signUp(
  ctx: ReturnType<typeof createTestContext>,
  email = 'student@example.com',
  password = 'correct-horse-battery',
) {
  const res = await ctx.auth.api.signUpEmail({
    body: { email, password, name: 'Ravi', country: 'IN', termsAcceptedAt: new Date() },
    asResponse: true,
  });
  if (!res.ok) throw new Error(`signUp failed: ${res.status} ${await res.text()}`);
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const body = (await res.json()) as { user: { id: string } };
  return { cookie, userId: body.user.id };
}

/** Headers a same-origin browser fetch would send on a mutation. */
export const browserHeaders = { Origin: 'http://localhost:5173', 'X-Requested-With': 'fetch' };

/** Response body as a loosely typed object, for assertions. */
export const readJson = async (res: Response): Promise<any> => res.json();

import { eq, sql } from 'drizzle-orm';
import type { UserRole } from '../../shared/permissions';
import { createApp } from '../app';
import { createAuth } from '../auth/auth';
import { createDb } from '../db';
import { users } from '../db/schema';
import { parseEnv } from '../env';
import type { EmailMessage, Mailer } from '../notifications/mailer';

export const testDatabaseUrl = () =>
  process.env.TEST_DATABASE_URL ?? 'mysql://app:app@127.0.0.1:3307/alpharecover_test';

const SECRET = 'test-secret-test-secret-test-secret-1234';

export const testEnv = (overrides: Record<string, string> = {}) =>
  parseEnv({
    NODE_ENV: 'test',
    APP_URL: 'http://localhost:5173',
    DATABASE_URL: testDatabaseUrl(),
    BETTER_AUTH_SECRET: SECRET,
    CRON_SECRET: SECRET,
    IP_HASH_SALT: SECRET,
    LOG_LEVEL: 'error',
    ...overrides,
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
export function createTestContext(envOverrides: Record<string, string> = {}) {
  const env = testEnv(envOverrides);
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

/** Minimal browser-like cookie jar for multi-request auth tests. */
export class CookieJar {
  private cookies = new Map<string, string>();

  /** Stores cookies from a response; Max-Age=0 or an empty value deletes them. */
  store(res: Response) {
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const expired = attrs.some((a) => /max-age=0\b/i.test(a.trim())) || value === '';
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return res;
  }

  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  get size() {
    return this.cookies.size;
  }
}

/** POST JSON like the site does (CSRF headers + cookies), storing returned cookies in `jar`. */
export async function postJson(app: { request: (p: string, i?: RequestInit) => Response | Promise<Response> }, path: string, body: unknown, jar?: CookieJar) {
  const res = await app.request(`/api/v1${path}`, {
    method: 'POST',
    headers: { ...browserHeaders, 'Content-Type': 'application/json', ...(jar?.size ? { Cookie: jar.header() } : {}) },
    body: JSON.stringify(body),
  });
  return jar ? jar.store(res) : res;
}

export async function getJson(app: { request: (p: string, i?: RequestInit) => Response | Promise<Response> }, path: string, jar?: CookieJar) {
  const res = await app.request(`/api/v1${path}`, { headers: jar?.size ? { Cookie: jar.header() } : {} });
  return jar ? jar.store(res) : res;
}

let roleCounter = 0;

/** Registers a fresh account, gives it `role`, and returns its signed-in cookie jar and id. */
export async function loginAs(ctx: ReturnType<typeof createTestContext>, role: UserRole, firstName = 'Staff') {
  const jar = new CookieJar();
  roleCounter += 1;
  const email = `${role}-${roleCounter}@example.com`;
  await ctx.db.execute(sql`DELETE FROM rate_limit_buckets`); // register allows 5 per hour per IP
  const res = await postJson(
    ctx.app,
    '/auth/register',
    { firstName, email, country: 'IN', password: 'correct-horse-battery', confirmPassword: 'correct-horse-battery', acceptTerms: true },
    jar,
  );
  if (res.status !== 201 && res.status !== 200) throw new Error(`register failed: ${res.status}`);
  await ctx.db.update(users).set({ role }).where(eq(users.email, email));
  const [u] = await ctx.db.select({ id: users.id }).from(users).where(eq(users.email, email));
  return { jar, id: u.id, email };
}

/** Same-origin request with a JSON body and the session cookie. */
export const sendJson = (ctx: ReturnType<typeof createTestContext>, method: string, path: string, body: unknown, jar: CookieJar) =>
  ctx.app.request(`/api/v1${path}`, { method, headers: { ...browserHeaders, 'Content-Type': 'application/json', Cookie: jar.header() }, body: JSON.stringify(body) });

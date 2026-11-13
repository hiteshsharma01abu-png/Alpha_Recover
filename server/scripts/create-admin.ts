/**
 * Create or promote a staff account from the command line (the first Super Admin can't be invited
 * from a UI that doesn't exist yet).
 *
 *   npm run admin:create -- --email owner@alpharecover.com --name Hitesh [--role super_admin] [--password '…']
 *   node dist-server/create-admin.mjs --email … --name …         (production)
 *
 * Existing account → its role is changed. New email → a verified account is created; without
 * --password a strong one is generated and printed once (change it after the first login).
 */
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { USER_ROLES, type StaffRole, type UserRole } from '../../shared/permissions';
import { passwordProblem } from '../../shared/passwords';
import { createAuth } from '../auth/auth';
import { createDb, type Database } from '../db';
import { activityLogs, sessions, users } from '../db/schema';
import { env } from '../env';

export type CreateAdminInput = { email: string; name: string; role: StaffRole; password?: string };
export type CreateAdminResult = { userId: string; action: 'created' | 'promoted' | 'unchanged'; generatedPassword?: string };

export async function createOrPromoteAdmin(db: Database, auth: ReturnType<typeof createAuth>, input: CreateAdminInput): Promise<CreateAdminResult> {
  const email = input.email.trim().toLowerCase();
  const [existing] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, email));
  if (existing) {
    if (existing.role === input.role) return { userId: existing.id, action: 'unchanged' };
    await db.update(users).set({ role: input.role }).where(eq(users.id, existing.id));
    await db.delete(sessions).where(eq(sessions.userId, existing.id)); // new role → sign in again
    await db.insert(activityLogs).values({
      action: 'team.role_change',
      entityType: 'user',
      entityId: existing.id,
      metadata: { from: existing.role, to: input.role, via: 'cli' },
    });
    return { userId: existing.id, action: 'promoted' };
  }

  const generated = input.password ? undefined : randomBytes(18).toString('base64url');
  const password = input.password ?? generated!;
  const problem = passwordProblem(password);
  if (problem) throw new Error(`Password rejected: ${problem}`);
  const res = await auth.api.signUpEmail({
    body: { email, password, name: input.name.trim(), country: 'IN', termsAcceptedAt: new Date() },
  });
  await db.update(users).set({ role: input.role, emailVerified: true }).where(eq(users.id, res.user.id));
  await db.delete(sessions).where(eq(sessions.userId, res.user.id));
  await db.insert(activityLogs).values({
    action: 'team.create',
    entityType: 'user',
    entityId: res.user.id,
    metadata: { role: input.role, via: 'cli' },
  });
  return { userId: res.user.id, action: 'created', generatedPassword: generated };
}

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] ?? '';
  }
  return out;
}

const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntry) {
  const args = parseArgs(process.argv.slice(2));
  const role = (args.role || 'super_admin') as UserRole;
  if (!args.email || !args.name || role === 'student' || !USER_ROLES.includes(role)) {
    console.error('Usage: --email <email> --name <first name> [--role super_admin|admin|finance_manager|content_manager|support_manager] [--password <password>]');
    process.exit(1);
  }
  const config = env();
  const { db, pool } = createDb(config.DATABASE_URL);
  createOrPromoteAdmin(db, createAuth(config, db), { email: args.email, name: args.name, role: role as StaffRole, password: args.password || undefined })
    .then((r) => {
      console.log(`${r.action === 'created' ? 'Created' : r.action === 'promoted' ? 'Promoted' : 'Already'} ${args.email} as ${role}.`);
      if (r.generatedPassword) console.log(`Temporary password (shown once, change it after logging in): ${r.generatedPassword}`);
    })
    .catch((err: unknown) => {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

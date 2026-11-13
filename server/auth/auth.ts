import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Database } from '../db';
import * as schema from '../db/schema';
import type { Env } from '../env';
import { uuidv7 } from '../lib/ids';
import { enqueueEmail } from '../notifications/outbox';

/**
 * Better Auth on our own MySQL (docs/SECURITY.md §1). Its HTTP handler is NOT mounted:
 * our own /api/v1/auth/* routes (docs/API.md §1, built in Phase 3) call `auth.api.*` so the
 * public contract, validation and rate limits stay ours.
 */
export function createAuth(env: Env, db: Database) {
  const secure = env.APP_URL.startsWith('https://');
  return betterAuth({
    appName: 'Alpha Recover',
    baseURL: env.APP_URL,
    basePath: '/api/v1/auth',
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [new URL(env.APP_URL).origin],
    database: drizzleAdapter(db, {
      provider: 'mysql',
      usePlural: true,
      schema: {
        users: schema.users,
        sessions: schema.sessions,
        accounts: schema.accounts,
        verifications: schema.verifications,
      },
    }),
    user: {
      fields: { name: 'firstName' },
      additionalFields: {
        lastName: { type: 'string', required: false },
        phone: { type: 'string', required: false },
        country: { type: 'string', required: true },
        termsAcceptedAt: { type: 'date', required: true },
        // Never settable through sign-up input:
        role: { type: 'string', required: false, defaultValue: 'student', input: false },
        status: { type: 'string', required: false, defaultValue: 'active', input: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      autoSignIn: true,
      requireEmailVerification: false, // purchases check verification instead (PRD FR-A2)
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      // Links open the website's own pages, which call our API (Better Auth's handler isn't mounted).
      sendResetPassword: async ({ user, token }) => {
        const url = `${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
        await enqueueEmail(db, 'password_reset', user.email, { firstName: user.name, url });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, token }) => {
        const url = `${env.APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
        await enqueueEmail(db, 'verify_email', user.email, { firstName: user.name, url });
      },
    },
    session: {
      // "Remember me": 30 days, refreshed daily. Without it Better Auth issues a 24h session with a
      // browser-session cookie and never extends it (docs/SECURITY.md §1).
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    // Our MySQL rate limiter covers auth routes (server/lib/ratelimit.ts).
    rateLimit: { enabled: false },
    advanced: {
      cookiePrefix: 'ar',
      useSecureCookies: secure,
      database: { generateId: () => uuidv7() },
      ipAddress: env.TRUSTED_PROXY_HEADER ? { ipAddressHeaders: [env.TRUSTED_PROXY_HEADER] } : undefined,
    },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;

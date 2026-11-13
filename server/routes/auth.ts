import { eq } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { isAPIError } from 'better-auth/api';
import { z } from 'zod';
import { REGISTER_COUNTRIES } from '../../shared/countries';
import { PASSWORD_MAX, passwordProblem } from '../../shared/passwords';
import { logActivity } from '../audit';
import { getUser, requireUser } from '../auth/middleware';
import { sessions, users, type UserRole } from '../db/schema';
import { AppError } from '../lib/errors';
import { normalizePhone } from '../lib/phone';
import { hit, peek, rateLimit } from '../lib/ratelimit';
import { clientIp, hashValue } from '../lib/request';
import { verifyTurnstile } from '../lib/turnstile';
import { validate } from '../lib/validate';
import { enforceSessionLimit } from '../services/sessions';
import type { AppEnv } from '../types';

const email = z.string().trim().toLowerCase().max(254).pipe(z.email({ message: 'Enter a valid email address' }));
const newPassword = z
  .string()
  .max(PASSWORD_MAX)
  .superRefine((v, ctx) => {
    const problem = passwordProblem(v);
    if (problem) ctx.addIssue({ code: 'custom', message: problem });
  });
const matchConfirm = <T extends { password: string; confirmPassword: string }>(v: T, ctx: z.RefinementCtx) => {
  if (v.password !== v.confirmPassword) ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match' });
};
const countryCodes = REGISTER_COUNTRIES.map((c) => c.code) as [string, ...string[]];

const registerInput = z
  .object({
    firstName: z.string().trim().min(1, 'Enter your first name').max(80),
    email,
    country: z.enum(countryCodes),
    phone: z
      .string()
      .trim()
      .optional()
      .transform((v, ctx) => {
        if (!v) return undefined;
        const n = normalizePhone(v);
        if (!n) ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number' });
        return n ?? undefined;
      }),
    password: newPassword,
    confirmPassword: z.string(),
    acceptTerms: z.literal(true, { message: 'Please accept the terms and privacy policy' }),
    captchaToken: z.string().max(4096).optional(),
  })
  .superRefine(matchConfirm);

const LOGIN_WINDOW = 15 * 60;
const LOGIN_MAX_FAILURES = 5;

/** Public user shape returned by every auth endpoint. */
async function publicUser(c: Context<AppEnv>, userId: string) {
  const [u] = await c
    .get('deps')
    .db.select({ id: users.id, email: users.email, firstName: users.firstName, role: users.role, status: users.status, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, userId));
  return u;
}

/** Copies Better Auth's Set-Cookie headers (session cookie) onto our response. */
function forwardCookies(c: Context<AppEnv>, headers: Headers) {
  for (const cookie of headers.getSetCookie()) c.header('Set-Cookie', cookie, { append: true });
}

/** Better Auth error → our envelope (docs/API.md §0). Unknown errors bubble up as 500. */
function authCode(err: unknown): string | undefined {
  return isAPIError(err) ? ((err.body as { code?: string } | undefined)?.code ?? undefined) : undefined;
}

/**
 * /auth/* (docs/API.md §1). Better Auth does the cryptography and session storage; these routes own
 * the public contract, validation, rate limits, session limits and audit logging.
 */
export const authRoutes = new Hono<AppEnv>()
  .get('/auth/session', async (c) => {
    c.header('Cache-Control', 'no-store');
    return c.json({ data: { user: await getUser(c) } });
  })

  .post('/auth/register', rateLimit({ name: 'register', limit: 5, windowSeconds: 3600 }), validate('json', registerInput), async (c) => {
    const input = c.req.valid('json');
    const { auth, db, env } = c.get('deps');
    await verifyTurnstile(env.TURNSTILE_SECRET_KEY, input.captchaToken, clientIp(c));
    try {
      const { headers, response } = await auth.api.signUpEmail({
        body: {
          email: input.email,
          password: input.password,
          name: input.firstName,
          country: input.country,
          phone: input.phone,
          termsAcceptedAt: new Date(),
        },
        headers: c.req.raw.headers,
        returnHeaders: true,
      });
      forwardCookies(c, headers);
      await enforceSessionLimit(db, response.user.id, 'student');
      await logActivity(c, { action: 'auth.register', entityType: 'user', entityId: response.user.id, actor: { id: response.user.id, role: 'student' } });
      return c.json({ data: { user: await publicUser(c, response.user.id) } }, 201);
    } catch (err) {
      const code = authCode(err);
      if (code?.startsWith('USER_ALREADY_EXISTS')) {
        throw new AppError('CONFLICT', 'An account with this email already exists. Log in or reset your password.', {
          details: [{ path: 'email', message: 'An account with this email already exists' }],
        });
      }
      throw err;
    }
  })

  .post(
    '/auth/login',
    validate('json', z.object({ email, password: z.string().min(1, 'Enter your password').max(PASSWORD_MAX), remember: z.boolean().default(false) })),
    async (c) => {
      const { email: addr, password, remember } = c.req.valid('json');
      const { auth, db, env } = c.get('deps');
      // Only failures count toward the limit, so normal log-in/log-out never locks anyone out.
      const bucket = `login:${hashValue(clientIp(c), env.IP_HASH_SALT).slice(0, 24)}:${hashValue(addr, env.IP_HASH_SALT).slice(0, 24)}`;
      const { hits, resetAt } = await peek(db, bucket, LOGIN_WINDOW);
      if (hits >= LOGIN_MAX_FAILURES) {
        throw new AppError('RATE_LIMITED', 'Too many failed attempts. Please try again later or reset your password.', {
          headers: { 'Retry-After': String(Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000))) },
        });
      }

      const { headers, response } = await auth.api
        .signInEmail({ body: { email: addr, password, rememberMe: remember }, headers: c.req.raw.headers, returnHeaders: true })
        .catch(async (err: unknown) => {
          if (authCode(err) === 'INVALID_EMAIL_OR_PASSWORD') {
            await hit(db, bucket, LOGIN_WINDOW);
            await logActivity(c, { action: 'auth.login_failed', metadata: { emailHash: hashValue(addr, env.IP_HASH_SALT) }, actor: null });
            throw new AppError('UNAUTHENTICATED', 'Invalid email or password');
          }
          throw err;
        });

      const user = await publicUser(c, response.user.id);
      if (user.status !== 'active') {
        await db.delete(sessions).where(eq(sessions.token, response.token));
        throw new AppError('FORBIDDEN', 'This account is suspended. Please contact support.');
      }
      forwardCookies(c, headers);
      await enforceSessionLimit(db, user.id, user.role as UserRole);
      await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
      await logActivity(c, { action: 'auth.login', entityType: 'user', entityId: user.id, metadata: { remember }, actor: { id: user.id, role: user.role } });
      return c.json({ data: { user } });
    },
  )

  .post('/auth/logout', async (c) => {
    try {
      const { headers } = await c.get('deps').auth.api.signOut({ headers: c.req.raw.headers, returnHeaders: true });
      forwardCookies(c, headers);
    } catch {
      // No session: logging out is still a success.
    }
    return c.json({ data: { ok: true } });
  })

  .post('/auth/logout-all', requireUser(), async (c) => {
    const user = (await getUser(c))!;
    const { auth, db } = c.get('deps');
    const { headers } = await auth.api.signOut({ headers: c.req.raw.headers, returnHeaders: true });
    forwardCookies(c, headers);
    await db.delete(sessions).where(eq(sessions.userId, user.id));
    await logActivity(c, { action: 'auth.logout_all', entityType: 'user', entityId: user.id });
    return c.json({ data: { ok: true } });
  })

  .post('/auth/verify-email', rateLimit({ name: 'verify-email', limit: 20, windowSeconds: 3600 }), validate('json', z.object({ token: z.string().min(1).max(4096) })), async (c) => {
    try {
      await c.get('deps').auth.api.verifyEmail({ query: { token: c.req.valid('json').token } });
    } catch (err) {
      const code = authCode(err);
      if (code === 'INVALID_TOKEN' || code === 'TOKEN_EXPIRED' || code === 'USER_NOT_FOUND') {
        throw new AppError('VALIDATION_ERROR', 'This verification link is invalid or has expired. Request a new one from your account.', {
          details: [{ path: 'token', message: code === 'TOKEN_EXPIRED' ? 'expired' : 'invalid' }],
        });
      }
      throw err;
    }
    return c.json({ data: { verified: true } });
  })

  .post('/auth/verify-email/resend', requireUser(), rateLimit({ name: 'verify-resend', limit: 3, windowSeconds: 3600 }), async (c) => {
    const user = (await getUser(c))!;
    if (user.emailVerified) return c.json({ data: { alreadyVerified: true } });
    await c.get('deps').auth.api.sendVerificationEmail({ body: { email: user.email } });
    return c.json({ data: { sent: true } });
  })

  .post(
    '/auth/password/forgot',
    rateLimit({ name: 'password-forgot', limit: 5, windowSeconds: 3600 }),
    validate('json', z.object({ email, captchaToken: z.string().max(4096).optional() })),
    async (c) => {
      const { email: addr, captchaToken } = c.req.valid('json');
      const { auth, env } = c.get('deps');
      await verifyTurnstile(env.TURNSTILE_SECRET_KEY, captchaToken, clientIp(c));
      try {
        await auth.api.requestPasswordReset({ body: { email: addr, redirectTo: `${env.APP_URL}/reset-password` } });
      } catch {
        // Same answer whether or not the account exists (no account enumeration).
      }
      return c.json({ data: { ok: true } });
    },
  )

  .post(
    '/auth/password/reset',
    rateLimit({ name: 'password-reset', limit: 10, windowSeconds: 3600 }),
    validate('json', z.object({ token: z.string().min(1).max(4096), password: newPassword, confirmPassword: z.string() }).superRefine(matchConfirm)),
    async (c) => {
      const { token, password } = c.req.valid('json');
      try {
        // revokeSessionsOnPasswordReset (auth.ts) signs the account out everywhere.
        await c.get('deps').auth.api.resetPassword({ body: { token, newPassword: password } });
      } catch (err) {
        const code = authCode(err);
        if (code === 'INVALID_TOKEN' || code === 'TOKEN_EXPIRED') {
          throw new AppError('VALIDATION_ERROR', 'This reset link is invalid or has expired. Request a new one.', {
            details: [{ path: 'token', message: 'invalid' }],
          });
        }
        throw err;
      }
      await logActivity(c, { action: 'auth.password_reset', actor: null });
      return c.json({ data: { ok: true } });
    },
  )

  .post(
    '/auth/password/change',
    requireUser(),
    rateLimit({ name: 'password-change', limit: 10, windowSeconds: 3600 }),
    validate(
      'json',
      z
        .object({ currentPassword: z.string().min(1, 'Enter your current password').max(PASSWORD_MAX), password: newPassword, confirmPassword: z.string() })
        .superRefine(matchConfirm),
    ),
    async (c) => {
      const { currentPassword, password } = c.req.valid('json');
      const user = (await getUser(c))!;
      try {
        const { headers } = await c.get('deps').auth.api.changePassword({
          body: { currentPassword, newPassword: password, revokeOtherSessions: true },
          headers: c.req.raw.headers,
          returnHeaders: true,
        });
        forwardCookies(c, headers);
      } catch (err) {
        if (authCode(err) === 'INVALID_PASSWORD') {
          throw new AppError('VALIDATION_ERROR', 'Your current password is incorrect', {
            details: [{ path: 'currentPassword', message: 'Incorrect password' }],
          });
        }
        throw err;
      }
      await logActivity(c, { action: 'auth.password_change', entityType: 'user', entityId: user.id });
      return c.json({ data: { ok: true } });
    },
  );

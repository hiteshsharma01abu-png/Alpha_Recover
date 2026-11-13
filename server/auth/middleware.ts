import type { Context, MiddlewareHandler } from 'hono';
import { AppError } from '../lib/errors';
import type { AppEnv, SessionUser } from '../types';
import type { UserRole } from '../db/schema';
import { can, isStaff, type Permission } from './permissions';

/** Loads the session user once per request (null when anonymous). */
export async function getUser(c: Context<AppEnv>): Promise<SessionUser | null> {
  const cached = c.get('user');
  if (cached !== undefined) return cached;
  const session = await c.get('deps').auth.api.getSession({ headers: c.req.raw.headers });
  const u = session?.user as (Record<string, unknown> & { id: string; email: string; name: string; emailVerified: boolean }) | undefined;
  const user: SessionUser | null = u
    ? {
        id: u.id,
        email: u.email,
        firstName: u.name,
        role: u.role as UserRole,
        status: u.status as SessionUser['status'],
        emailVerified: u.emailVerified,
      }
    : null;
  c.set('user', user);
  c.set('sessionId', session?.session.id ?? null);
  return user;
}

/** 401 when not logged in, 403 when suspended. */
export function requireUser(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = await getUser(c);
    if (!user) throw new AppError('UNAUTHENTICATED', 'Please log in to continue');
    if (user.status !== 'active') throw new AppError('FORBIDDEN', 'This account is suspended');
    await next();
  };
}

/** Staff-only route guarded by a specific permission (checked on every admin route). */
export function requireStaff(permission: Permission): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = await getUser(c);
    if (!user) throw new AppError('UNAUTHENTICATED', 'Please log in to continue');
    if (user.status !== 'active') throw new AppError('FORBIDDEN', 'This account is suspended');
    if (!isStaff(user.role) || !can(user.role, permission)) {
      throw new AppError('FORBIDDEN', 'You do not have permission to do this');
    }
    await next();
  };
}

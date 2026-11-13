import { Hono } from 'hono';
import { getUser } from '../../auth/middleware';
import { permissionsFor, ROLE_LABELS } from '../../auth/permissions';
import type { AppEnv } from '../../types';

/** GET /admin/me — who is signed in and exactly what they may do (the admin UI renders from this). */
export const adminMeRoutes = new Hono<AppEnv>().get('/me', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = (await getUser(c))!;
  return c.json({
    data: {
      user: { id: user.id, email: user.email, firstName: user.firstName, emailVerified: user.emailVerified },
      role: user.role,
      roleLabel: ROLE_LABELS[user.role],
      permissions: permissionsFor(user.role),
    },
  });
});

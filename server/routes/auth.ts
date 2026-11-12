import { Hono } from 'hono';
import { getUser } from '../auth/middleware';
import type { AppEnv } from '../types';

/**
 * /auth/* (docs/API.md §1). Phase 1 ships only the session lookup the header needs;
 * register, login, logout and password reset arrive in Phase 3.
 */
export const authRoutes = new Hono<AppEnv>().get('/auth/session', async (c) => {
  c.header('Cache-Control', 'no-store');
  const user = await getUser(c);
  return c.json({ data: { user } });
});

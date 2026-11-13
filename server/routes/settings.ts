import { Hono } from 'hono';
import { getPublicSettings } from '../settings';
import type { AppEnv } from '../types';

/** GET /settings/public — contact details and social links for the site (docs/API.md §2). */
export const settingsRoutes = new Hono<AppEnv>().get('/settings/public', async (c) => {
  c.header('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400');
  return c.json({ data: await getPublicSettings(c.get('deps').db) });
});

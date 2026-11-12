import { Hono } from 'hono';
import { z } from 'zod';
import { AppError } from '../lib/errors';
import { validate } from '../lib/validate';
import { loadPlans } from '../services/pricing';
import type { AppEnv } from '../types';

// Short cache: the price changes the moment a sale starts or ends.
const PLAN_CACHE = 'public, max-age=30, s-maxage=60';

/** Plans with server-computed prices (docs/API.md §5). */
export const planRoutes = new Hono<AppEnv>()
  .get('/plans', async (c) => {
    c.header('Cache-Control', PLAN_CACHE);
    return c.json({ data: await loadPlans(c.get('deps').db) });
  })
  .get('/plans/:slug', validate('param', z.object({ slug: z.string().regex(/^[a-z0-9-]{1,64}$/) })), async (c) => {
    const [plan] = await loadPlans(c.get('deps').db, { slug: c.req.valid('param').slug });
    if (!plan) throw new AppError('NOT_FOUND', 'Plan not found');
    c.header('Cache-Control', PLAN_CACHE);
    return c.json({ data: plan });
  });

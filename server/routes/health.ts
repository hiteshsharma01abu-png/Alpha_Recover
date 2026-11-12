import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import type { AppEnv } from '../types';

/** GET /health — uptime monitors and deploy smoke tests. 503 when the database is unreachable. */
export const healthRoutes = new Hono<AppEnv>().get('/health', async (c) => {
  try {
    await c.get('deps').db.execute(sql`SELECT 1`);
  } catch (err) {
    logger.error('health check: database unreachable', { error: err instanceof Error ? err.message : String(err) });
    throw new AppError('SERVICE_UNAVAILABLE', 'Database unreachable');
  }
  return c.json({ data: { status: 'ok', db: 'ok', time: new Date().toISOString() } });
});

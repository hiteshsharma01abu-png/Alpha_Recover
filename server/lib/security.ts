import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from '../types';
import { AppError } from './errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie-authenticated mutations (docs/SECURITY.md §3): the request must come
 * from our own origin and carry `X-Requested-With: fetch`, which cross-site forms can't set.
 * Webhooks (signature-verified) and internal cron endpoints (bearer secret) are exempt.
 */
export function csrfGuard(exemptPrefixes: string[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (SAFE_METHODS.has(c.req.method) || exemptPrefixes.some((p) => c.req.path.startsWith(p))) {
      return next();
    }
    const allowedOrigin = new URL(c.get('deps').env.APP_URL).origin;
    const origin = c.req.header('origin');
    if (origin && origin !== allowedOrigin) {
      throw new AppError('FORBIDDEN', 'Cross-origin request rejected');
    }
    if (c.req.header('x-requested-with') !== 'fetch') {
      throw new AppError('FORBIDDEN', 'Missing X-Requested-With header');
    }
    await next();
  };
}

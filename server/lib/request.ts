import { createHash } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import type { AppEnv } from '../types';
import { uuidv7 } from './ids';
import { logger } from './logger';

/** Assigns a request id (echoed in `X-Request-Id`) and writes one access-log line per request. */
export function requestContext(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const requestId = `req_${uuidv7().replaceAll('-', '').slice(0, 20)}`;
    c.set('requestId', requestId);
    c.header('X-Request-Id', requestId);
    const started = performance.now();
    await next();
    logger.info('request', {
      requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms: Math.round(performance.now() - started),
      userId: c.get('user')?.id,
    });
  };
}

/** Client IP: from the configured trusted proxy header, else the socket address. */
export function clientIp(c: Context<AppEnv>): string {
  const header = c.get('deps').env.TRUSTED_PROXY_HEADER;
  if (header) {
    const value = c.req.header(header);
    if (value) return value.split(',')[0].trim();
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown'; // not running on @hono/node-server (e.g. app.request() in tests)
  }
}

/** Salted SHA-256 of a value (IPs, emails) so abuse controls work without storing raw PII. */
export function hashValue(value: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${value}`).digest('hex');
}

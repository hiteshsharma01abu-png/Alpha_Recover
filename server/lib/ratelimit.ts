import { sql } from 'drizzle-orm';
import type { Context, MiddlewareHandler } from 'hono';
import type { Database } from '../db';
import type { AppEnv } from '../types';
import { AppError } from './errors';
import { clientIp, hashValue } from './request';

export type RateLimitRule = {
  /** Bucket name, e.g. 'login' */
  name: string;
  limit: number;
  windowSeconds: number;
  /** Extra key parts beyond the client IP (e.g. a hashed email). */
  key?: (c: Context<AppEnv>) => string | Promise<string>;
};

/**
 * Fixed-window counter in MySQL (`rate_limit_buckets`): works on shared hosting with no Redis,
 * and across multiple app processes. Returns the hit count for the current window.
 */
export async function hit(db: Database, bucketKey: string, windowSeconds: number, now = Date.now()) {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs);
  // VALUES() keeps MariaDB compatibility. MySQL evaluates assignments left to right, so `hits`
  // compares against the *old* window_start before it is overwritten.
  await db.execute(sql`
    INSERT INTO rate_limit_buckets (bucket_key, window_start, hits, expires_at)
    VALUES (${bucketKey}, ${windowStart}, 1, ${expiresAt})
    ON DUPLICATE KEY UPDATE
      hits = IF(window_start = VALUES(window_start), hits + 1, 1),
      window_start = VALUES(window_start),
      expires_at = VALUES(expires_at)`);
  const [rows] = (await db.execute(
    sql`SELECT hits FROM rate_limit_buckets WHERE bucket_key = ${bucketKey}`,
  )) as unknown as [{ hits: number }[]];
  return { hits: Number(rows[0]?.hits ?? 1), resetAt: expiresAt };
}

/**
 * Raw `db.execute()` returns DATETIME as a string like "2026-11-13 16:30:00.000" (UTC, since the pool
 * uses timezone 'Z'). `new Date()` would read that as local time, so parse it explicitly as UTC.
 */
function utcDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(`${v.replace(' ', 'T')}Z`);
}

/** Hits recorded in the current window without adding one (for "count failures only" limits like login). */
export async function peek(db: Database, bucketKey: string, windowSeconds: number, now = Date.now()) {
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const [rows] = (await db.execute(
    sql`SELECT hits, window_start FROM rate_limit_buckets WHERE bucket_key = ${bucketKey}`,
  )) as unknown as [{ hits: number; window_start: Date | string }[]];
  const row = rows[0];
  if (!row || utcDate(row.window_start).getTime() !== windowStart.getTime()) return { hits: 0, resetAt: new Date(windowStart.getTime() + windowMs) };
  return { hits: Number(row.hits), resetAt: new Date(windowStart.getTime() + windowMs) };
}

/** Middleware: 429 RATE_LIMITED with Retry-After once `limit` is exceeded in the window. */
export function rateLimit(rule: RateLimitRule): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const { db, env } = c.get('deps');
    const parts = [rule.name, hashValue(clientIp(c), env.IP_HASH_SALT).slice(0, 32)];
    if (rule.key) parts.push(await rule.key(c));
    const { hits, resetAt } = await hit(db, parts.join(':').slice(0, 191), rule.windowSeconds);
    c.header('RateLimit-Limit', String(rule.limit));
    c.header('RateLimit-Remaining', String(Math.max(0, rule.limit - hits)));
    if (hits > rule.limit) {
      const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000));
      throw new AppError('RATE_LIMITED', 'Too many requests. Please try again later.', {
        headers: { 'Retry-After': String(retryAfter) },
      });
    }
    await next();
  };
}

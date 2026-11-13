import { Hono } from 'hono';
import { AppError } from '../lib/errors';
import { rateLimit } from '../lib/ratelimit';
import { CERTIFICATE_CODE, verifyCertificate } from '../services/certificates';
import type { AppEnv } from '../types';

/** GET /certificates/verify/:code — public certificate check (docs/API.md §2). */
export const certificateRoutes = new Hono<AppEnv>().get(
  '/certificates/verify/:code',
  rateLimit({ name: 'cert-verify', limit: 30, windowSeconds: 60 }),
  async (c) => {
    c.header('Cache-Control', 'no-store');
    const code = c.req.param('code').trim().toUpperCase();
    // Malformed and unknown codes get the same answer, so the format check reveals nothing.
    const result = CERTIFICATE_CODE.test(code) ? await verifyCertificate(c.get('deps').db, code) : null;
    if (!result) throw new AppError('NOT_FOUND', 'No certificate found with this ID');
    return c.json({ data: result });
  },
);

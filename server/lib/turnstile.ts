import { AppError } from './errors';
import { logger } from './logger';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifies a Cloudflare Turnstile token. Without a secret key (development) the check is skipped;
 * production refuses to start without one (server/env.ts).
 */
export async function verifyTurnstile(secret: string | undefined, token: string | undefined, ip?: string) {
  if (!secret) return;
  if (!token) throw new AppError('CAPTCHA_FAILED', 'Please complete the security check');
  let ok = false;
  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip && ip !== 'unknown') body.set('remoteip', ip);
    const res = await fetch(VERIFY_URL, { method: 'POST', body });
    const json = (await res.json()) as { success?: boolean; 'error-codes'?: string[] };
    ok = json.success === true;
    if (!ok) logger.warn('turnstile rejected', { errors: json['error-codes'] });
  } catch (err) {
    logger.error('turnstile unreachable', { error: err instanceof Error ? err.message : String(err) });
    throw new AppError('UPSTREAM_ERROR', 'Security check is unavailable. Please try again.');
  }
  if (!ok) throw new AppError('CAPTCHA_FAILED', 'Security check failed. Please try again.');
}

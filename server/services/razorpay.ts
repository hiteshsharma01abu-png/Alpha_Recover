import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Env } from '../env';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

/**
 * Razorpay REST client (orders + payments), called with fetch like the Bunny services: no SDK.
 * Docs: https://razorpay.com/docs/api/orders/ · https://razorpay.com/docs/api/payments/
 */
const API = 'https://api.razorpay.com/v1';

export type RazorpayEnv = Pick<Env, 'RAZORPAY_KEY_ID' | 'RAZORPAY_KEY_SECRET'>;

export type RazorpayPayment = {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  /** created → authorized → captured, or failed / refunded */
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  method: string | null;
  error_code: string | null;
  error_description: string | null;
};

function credentials(env: RazorpayEnv) {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    throw new AppError('SERVICE_UNAVAILABLE', 'Online payments are not set up yet. Please contact us on WhatsApp to enroll.');
  }
  return { keyId: env.RAZORPAY_KEY_ID, auth: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64')}` };
}

async function call<T>(env: RazorpayEnv, method: 'GET' | 'POST', path: string, body: unknown, fetchImpl: typeof fetch): Promise<T> {
  const { auth } = credentials(env);
  let res: Response;
  try {
    res = await fetchImpl(`${API}${path}`, {
      method,
      headers: { Authorization: auth, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    logger.error('razorpay unreachable', { path, error: (err as Error).message });
    throw new AppError('UPSTREAM_ERROR', 'The payment service is not responding. Please try again in a minute.');
  }
  if (!res.ok) {
    const detail = ((await res.json().catch(() => null)) as { error?: { description?: string } } | null)?.error?.description;
    // 401 here means our keys are wrong: a server problem, never the buyer's
    logger.error('razorpay error', { path, status: res.status, detail });
    throw new AppError('UPSTREAM_ERROR', 'The payment service returned an error. Please try again.');
  }
  return (await res.json()) as T;
}

/** The public key Checkout needs; throws 503 when payments aren't configured. */
export const razorpayKeyId = (env: RazorpayEnv) => credentials(env).keyId;

export function createRazorpayOrder(
  env: RazorpayEnv,
  input: { amountPaise: number; currency: string; receipt: string; notes: Record<string, string> },
  fetchImpl: typeof fetch = fetch,
) {
  return call<{ id: string; amount: number; status: string }>(
    env,
    'POST',
    '/orders',
    { amount: input.amountPaise, currency: input.currency, receipt: input.receipt, notes: input.notes },
    fetchImpl,
  );
}

export function fetchRazorpayPayment(env: RazorpayEnv, paymentId: string, fetchImpl: typeof fetch = fetch) {
  return call<RazorpayPayment>(env, 'GET', `/payments/${encodeURIComponent(paymentId)}`, undefined, fetchImpl);
}

/** Payments made against one Razorpay order (reconciling a missed handler or webhook). */
export async function fetchRazorpayOrderPayments(env: RazorpayEnv, providerOrderId: string, fetchImpl: typeof fetch = fetch) {
  return (await call<{ items: RazorpayPayment[] }>(env, 'GET', `/orders/${encodeURIComponent(providerOrderId)}/payments`, undefined, fetchImpl)).items;
}

const hmacHex = (secret: string, data: string) => createHmac('sha256', secret).update(data).digest('hex');

function safeEqualHex(expected: string, given: string) {
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Checkout handler response: HMAC-SHA256(`order_id|payment_id`, key secret), compared in constant time. */
export function checkoutSignatureValid(keySecret: string, providerOrderId: string, paymentId: string, signature: string) {
  return safeEqualHex(hmacHex(keySecret, `${providerOrderId}|${paymentId}`), signature);
}

/** Webhook: HMAC-SHA256 over the raw request body with the webhook secret. */
export function webhookSignatureValid(webhookSecret: string, rawBody: string, signature: string) {
  return safeEqualHex(hmacHex(webhookSecret, rawBody), signature);
}

export { hmacHex as razorpaySignature };

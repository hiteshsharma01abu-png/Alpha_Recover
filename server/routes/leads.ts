import { Hono } from 'hono';
import { z } from 'zod';
import { LEAD_REASONS } from '../../shared/leads';
import { leads } from '../db/schema';
import { logger } from '../lib/logger';
import { normalizePhone } from '../lib/phone';
import { rateLimit } from '../lib/ratelimit';
import { clientIp, hashValue } from '../lib/request';
import { verifyTurnstile } from '../lib/turnstile';
import { validate } from '../lib/validate';
import { enqueueEmail } from '../notifications/outbox';
import { getSetting } from '../settings';
import type { AppEnv } from '../types';

const reasonValues = LEAD_REASONS.map((r) => r.value) as [string, ...string[]];

const phone = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) ctx.addIssue({ code: 'custom', message: 'Enter a valid phone number' });
    return n ?? '';
  });
const email = z.string().trim().toLowerCase().max(254).pipe(z.email({ message: 'Enter a valid email address' }));
const optionalEmail = z
  .string()
  .trim()
  .max(254)
  .optional()
  .transform((v) => (v ? v.toLowerCase() : undefined))
  .pipe(z.email({ message: 'Enter a valid email address' }).optional());

const common = {
  pagePath: z.string().max(255).optional(),
  utm: z.record(z.string().max(40), z.string().max(200)).optional(),
  captchaToken: z.string().max(4096).optional(),
  /** Honeypot: hidden in the UI, so only bots fill it. */
  website: z.string().max(500).optional(),
};

export const leadInput = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('contact_form'),
    name: z.string().trim().min(1, 'Enter your name').max(120),
    email,
    phone,
    reason: z.enum(reasonValues),
    message: z.string().trim().min(1, 'Enter a message').max(5000),
    whatsappConsent: z.boolean().default(false),
    ...common,
  }),
  z.object({
    source: z.literal('callback'),
    name: z.string().trim().max(120).optional(),
    phone,
    email: optionalEmail,
    ...common,
  }),
]);

/** POST /leads — contact form and callback requests (docs/API.md §8). */
export const leadRoutes = new Hono<AppEnv>().post(
  '/leads',
  rateLimit({ name: 'leads', limit: 5, windowSeconds: 60 * 60 }),
  validate('json', leadInput),
  async (c) => {
    const input = c.req.valid('json');
    const { db, env } = c.get('deps');
    const ip = clientIp(c);
    const isSpam = Boolean(input.website);

    if (!isSpam) await verifyTurnstile(env.TURNSTILE_SECRET_KEY, input.captchaToken, ip);

    const contact = input.source === 'contact_form' ? input : null;
    const lead = {
      source: input.source,
      name: input.name || null,
      email: input.email ?? null,
      phone: input.phone,
      reason: (contact?.reason ?? null) as (typeof leads.$inferInsert)['reason'],
      message: contact?.message ?? null,
      whatsappConsent: contact?.whatsappConsent ?? false,
      status: isSpam ? ('spam' as const) : ('new' as const),
      pagePath: input.pagePath ?? null,
      utm: input.utm && Object.keys(input.utm).length ? input.utm : null,
      ipHash: hashValue(ip, env.IP_HASH_SALT),
      userAgent: c.req.header('user-agent')?.slice(0, 500) ?? null,
    };
    await db.insert(leads).values(lead);

    // Bots get the same 201 so the honeypot isn't revealed; they just don't trigger emails.
    if (!isSpam) {
      try {
        const recipients = await getSetting(db, 'lead_notification_emails', ['info@alpharecover.com']);
        const reasonLabel = LEAD_REASONS.find((r) => r.value === lead.reason)?.label ?? null;
        for (const to of recipients) {
          await enqueueEmail(db, 'lead_alert', to, {
            source: lead.source,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            reason: reasonLabel,
            message: lead.message,
            whatsappConsent: lead.whatsappConsent,
            pagePath: lead.pagePath,
          });
        }
        if (lead.email) {
          await enqueueEmail(db, 'lead_ack', lead.email, { name: lead.name, callback: lead.source === 'callback' });
        }
      } catch (err) {
        // The lead is saved; a failed notification must not turn into an error for the visitor.
        logger.error('lead notification enqueue failed', { error: err instanceof Error ? err.message : String(err) });
      }
    }

    return c.json({ data: { ok: true } }, 201);
  },
);

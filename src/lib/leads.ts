import type { LeadReason } from '../../shared/leads';
import { api, ApiError } from './api';

type ContactLead = {
  source: 'contact_form';
  name: string;
  email: string;
  phone: string;
  reason: LeadReason;
  message: string;
  whatsappConsent: boolean;
};

type CallbackLead = { source: 'callback'; phone: string; email?: string };

/** UTM parameters from the current URL, so leads can be attributed to campaigns. */
function utmParams(): Record<string, string> | undefined {
  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};
  for (const [k, v] of params) if (k.startsWith('utm_') && v) utm[k] = v.slice(0, 200);
  return Object.keys(utm).length ? utm : undefined;
}

/** POST /api/v1/leads. Adds page path, UTM, captcha token and the honeypot value. */
export function submitLead(lead: ContactLead | CallbackLead, extra: { captchaToken: string | null; website: string }) {
  return api.post<{ ok: true }>('/leads', {
    ...lead,
    pagePath: window.location.pathname,
    utm: utmParams(),
    captchaToken: extra.captchaToken ?? undefined,
    website: extra.website,
  });
}

/** Field → message map from a VALIDATION_ERROR, plus a general message for anything else. */
export function formErrors(err: unknown): { fields: Record<string, string>; message: string } {
  if (err instanceof ApiError) {
    const fields: Record<string, string> = {};
    for (const d of err.details) if (d.path && !fields[d.path]) fields[d.path] = d.message;
    const message =
      err.code === 'VALIDATION_ERROR' ? 'Please check the highlighted fields.' : err.message;
    return { fields, message };
  }
  return { fields: {}, message: 'Something went wrong. Please try again.' };
}

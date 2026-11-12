/**
 * Email templates (docs/API.md §13). Each returns subject, plain text and HTML.
 * Later phases add order_receipt, enrollment_welcome, lead_ack, lead_alert, certificate_issued…
 */
type Rendered = { subject: string; text: string; html: string };

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#123128;font-family:Arial,sans-serif;color:#F0EDE4">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0D231D;border:1px solid #1F5E57;border-radius:8px">
<tr><td style="padding:28px 32px"><p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;color:#D9B56E;text-transform:uppercase">Alpha Recover</p>
<h1 style="margin:0 0 20px;font-size:22px;color:#F0EDE4">${escapeHtml(title)}</h1>
<div style="font-size:15px;line-height:1.6;color:#CFDDD8">${bodyHtml}</div>
</td></tr></table></td></tr></table></body></html>`;
}

function button(url: string, label: string) {
  return `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:#F0EDE4;color:#123128;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">${escapeHtml(label)}</a></p>`;
}

export const templates = {
  verify_email: (p: { firstName: string; url: string }): Rendered => ({
    subject: 'Verify your email for Alpha Recover',
    text: `Hi ${p.firstName},\n\nConfirm your email address to finish setting up your account:\n${p.url}\n\nThis link expires in 24 hours. If you didn't create an account, ignore this email.`,
    html: layout(
      'Verify your email',
      `<p>Hi ${escapeHtml(p.firstName)},</p><p>Confirm your email address to finish setting up your account.</p>${button(p.url, 'Verify email')}<p style="font-size:13px">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>`,
    ),
  }),
  password_reset: (p: { firstName: string; url: string }): Rendered => ({
    subject: 'Reset your Alpha Recover password',
    text: `Hi ${p.firstName},\n\nReset your password here:\n${p.url}\n\nThis link expires in 1 hour. If you didn't ask for this, ignore this email.`,
    html: layout(
      'Reset your password',
      `<p>Hi ${escapeHtml(p.firstName)},</p><p>We received a request to reset your password.</p>${button(p.url, 'Reset password')}<p style="font-size:13px">This link expires in 1 hour. If you didn't ask for this, ignore this email.</p>`,
    ),
  }),
  /** To the team: a new lead arrived. */
  lead_alert: (p: {
    source: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    reason: string | null;
    message: string | null;
    whatsappConsent: boolean;
    pagePath: string | null;
  }): Rendered => {
    const rows: [string, string | null][] = [
      ['Source', p.source === 'callback' ? 'Callback request' : 'Contact form'],
      ['Name', p.name],
      ['Phone', p.phone],
      ['Email', p.email],
      ['Reason', p.reason],
      ['WhatsApp/SMS consent', p.whatsappConsent ? 'Yes' : 'No'],
      ['Page', p.pagePath],
    ];
    const filled = rows.filter(([, v]) => v);
    const who = p.name ?? p.phone ?? p.email ?? 'someone';
    return {
      subject: `New ${p.source === 'callback' ? 'callback request' : 'enquiry'} from ${who}`,
      text: `${filled.map(([k, v]) => `${k}: ${v}`).join('\n')}${p.message ? `\n\nMessage:\n${p.message}` : ''}`,
      html: layout(
        p.source === 'callback' ? 'New callback request' : 'New enquiry',
        `<table cellpadding="4" style="font-size:14px">${filled
          .map(([k, v]) => `<tr><td style="color:#A9C2BC">${escapeHtml(k)}</td><td style="color:#F0EDE4">${escapeHtml(v ?? '')}</td></tr>`)
          .join('')}</table>${p.message ? `<p style="margin-top:16px;white-space:pre-wrap">${escapeHtml(p.message)}</p>` : ''}`,
      ),
    };
  },
  /** To the person who submitted the form. */
  lead_ack: (p: { name: string | null; callback: boolean }): Rendered => {
    const hi = p.name ? `Hi ${p.name},` : 'Hi,';
    const line = p.callback
      ? 'Thanks for requesting a callback. Our team will call you within 24 hours (Mon – Sat, 9:00 AM – 6:00 PM IST).'
      : 'Thanks for getting in touch. We have received your message and will reply within 24 hours.';
    return {
      subject: p.callback ? 'We will call you back soon — Alpha Recover' : 'We received your message — Alpha Recover',
      text: `${hi}\n\n${line}\n\nFor anything urgent, WhatsApp us at +91 63551 97917.\n\nAlpha Recover`,
      html: layout(
        p.callback ? 'Callback requested' : 'Message received',
        `<p>${escapeHtml(hi)}</p><p>${escapeHtml(line)}</p><p>For anything urgent, WhatsApp us at <a href="https://wa.me/916355197917" style="color:#D9B56E">+91 63551 97917</a>.</p>`,
      ),
    };
  },
} satisfies Record<string, (payload: never) => Rendered>;

export type TemplateName = keyof typeof templates;
export type TemplatePayload<T extends TemplateName> = Parameters<(typeof templates)[T]>[0];

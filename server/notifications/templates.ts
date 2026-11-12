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
} satisfies Record<string, (payload: never) => Rendered>;

export type TemplateName = keyof typeof templates;
export type TemplatePayload<T extends TemplateName> = Parameters<(typeof templates)[T]>[0];

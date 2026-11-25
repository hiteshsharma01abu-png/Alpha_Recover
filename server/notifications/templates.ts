/**
 * Email templates (docs/API.md §13). Each returns subject, plain text and HTML.
 * order_receipt and enrollment_welcome are queued together when an order is paid (server/services/orders.ts).
 */
type Rendered = { subject: string; text: string; html: string };

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#123128;font-family:Arial,sans-serif;color:#F0EDE4">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#0D231D;border:1px solid #1F5E57;border-radius:8px">
<tr><td style="padding:28px 32px"><p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;color:#D9B56E;text-transform:uppercase">Alpha Recovery</p>
<h1 style="margin:0 0 20px;font-size:22px;color:#F0EDE4">${escapeHtml(title)}</h1>
<div style="font-size:15px;line-height:1.6;color:#CFDDD8">${bodyHtml}</div>
</td></tr></table></td></tr></table></body></html>`;
}

function button(url: string, label: string) {
  return `<p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:#F0EDE4;color:#123128;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">${escapeHtml(label)}</a></p>`;
}

export const templates = {
  verify_email: (p: { firstName: string; url: string }): Rendered => ({
    subject: 'Verify your email for Alpha Recovery',
    text: `Hi ${p.firstName},\n\nConfirm your email address to finish setting up your account:\n${p.url}\n\nThis link expires in 24 hours. If you didn't create an account, ignore this email.`,
    html: layout(
      'Verify your email',
      `<p>Hi ${escapeHtml(p.firstName)},</p><p>Confirm your email address to finish setting up your account.</p>${button(p.url, 'Verify email')}<p style="font-size:13px">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>`,
    ),
  }),
  password_reset: (p: { firstName: string; url: string }): Rendered => ({
    subject: 'Reset your Alpha Recovery password',
    text: `Hi ${p.firstName},\n\nReset your password here:\n${p.url}\n\nThis link expires in 1 hour. If you didn't ask for this, ignore this email.`,
    html: layout(
      'Reset your password',
      `<p>Hi ${escapeHtml(p.firstName)},</p><p>We received a request to reset your password.</p>${button(p.url, 'Reset password')}<p style="font-size:13px">This link expires in 1 hour. If you didn't ask for this, ignore this email.</p>`,
    ),
  }),
  /** The student completed a course and its certificate was issued automatically. */
  certificate_issued: (p: { firstName: string; programTitle: string; code: string; dashboardUrl: string; verifyUrl: string }): Rendered => ({
    subject: `Your certificate is ready: ${p.programTitle}`,
    text: `Hi ${p.firstName},\n\nCongratulations on completing ${p.programTitle}! Your certificate (ID ${p.code}) is ready.\n\nDownload it from My Learning:\n${p.dashboardUrl}\n\nAnyone can confirm it's genuine here:\n${p.verifyUrl}\n\nAlpha Recovery`,
    html: layout(
      'Your certificate is ready',
      `<p>Hi ${escapeHtml(p.firstName)},</p><p>Congratulations on completing <strong>${escapeHtml(p.programTitle)}</strong>! Your certificate is ready.</p><p>Certificate ID: <strong>${escapeHtml(p.code)}</strong></p>${button(p.dashboardUrl, 'Download your certificate')}<p style="font-size:13px">Anyone can confirm it's genuine at <a href="${escapeHtml(p.verifyUrl)}" style="color:#7DFFC0">${escapeHtml(p.verifyUrl)}</a>.</p>`,
    ),
  }),
  /** Payment confirmation: the buyer's record of what they paid. Not a GST tax invoice (none until a GSTIN exists). */
  order_receipt: (p: { firstName: string; orderNumber: string; planName: string; amount: string; paidAt: string; method: string | null; paymentId: string }): Rendered => {
    const date = new Date(p.paidAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
    const rows: [string, string][] = [
      ['Order', p.orderNumber],
      ['Plan', p.planName],
      ['Amount paid', p.amount],
      ['Date', `${date} IST`],
      ...(p.method ? [['Payment method', p.method.toUpperCase()] as [string, string]] : []),
      ['Payment ID', p.paymentId],
    ];
    return {
      subject: `Payment received: ${p.planName} (${p.orderNumber})`,
      text: `Hi ${p.firstName},\n\nThank you for your payment. Here are the details:\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nKeep this email for your records. For refunds, see our refund policy or reply to this email.\n\nAlpha Recovery`,
      html: layout(
        'Payment received',
        `<p>Hi ${escapeHtml(p.firstName)},</p><p>Thank you for your payment. Here are the details:</p><table cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;margin:8px 0 16px">${rows
          .map(([k, v]) => `<tr><td style="padding:6px 0;color:#A9C2BC">${escapeHtml(k)}</td><td style="padding:6px 0;text-align:right;color:#F0EDE4"><strong>${escapeHtml(v)}</strong></td></tr>`)
          .join('')}</table><p style="font-size:13px">Keep this email for your records. For refunds, see our refund policy or reply to this email.</p>`,
      ),
    };
  },
  /** Refund issued (admin or Razorpay dashboard). Banks take 5–7 working days to show it. */
  refund_processed: (p: { firstName: string; orderNumber: string; planName: string; amount: string; accessEnded: boolean }): Rendered => ({
    subject: `Refund issued: ${p.planName} (${p.orderNumber})`,
    text: `Hi ${p.firstName},\n\nWe've refunded ${p.amount} for your ${p.planName} (order ${p.orderNumber}) to your original payment method. Banks usually take 5–7 working days to show it.${p.accessEnded ? `\n\nAs per our refund policy, access to the ${p.planName} courses has ended.` : ''}\n\nQuestions? Reply to this email.\n\nAlpha Recovery`,
    html: layout(
      'Refund issued',
      `<p>Hi ${escapeHtml(p.firstName)},</p><p>We've refunded <strong>${escapeHtml(p.amount)}</strong> for your ${escapeHtml(p.planName)} (order ${escapeHtml(p.orderNumber)}) to your original payment method. Banks usually take 5–7 working days to show it.</p>${p.accessEnded ? `<p>As per our refund policy, access to the ${escapeHtml(p.planName)} courses has ended.</p>` : ''}<p style="font-size:13px">Questions? Reply to this email.</p>`,
    ),
  }),
  /** Sent with the receipt: access is open, here's where to start. */
  enrollment_welcome: (p: { firstName: string; planName: string; dashboardUrl: string; lifetime: boolean }): Rendered => ({
    subject: `Welcome to the ${p.planName}: your courses are unlocked`,
    text: `Hi ${p.firstName},\n\nWelcome aboard! Your ${p.planName} is active${p.lifetime ? ' with lifetime access' : ''}. Start learning from My Learning:\n${p.dashboardUrl}\n\nYou'll get a certificate for each course you complete. Questions? Reply to this email or message us on WhatsApp.\n\nAlpha Recovery`,
    html: layout(
      'Your courses are unlocked',
      `<p>Hi ${escapeHtml(p.firstName)},</p><p>Welcome aboard! Your <strong>${escapeHtml(p.planName)}</strong> is active${p.lifetime ? ' with lifetime access' : ''}.</p>${button(p.dashboardUrl, 'Start learning')}<p style="font-size:13px">You'll get a certificate for each course you complete. Questions? Reply to this email or message us on WhatsApp.</p>`,
    ),
  }),
  /** A Super Admin added this person to the team; the link sets their first password. */
  staff_invite: (p: { firstName: string; invitedBy: string; roleLabel: string; url: string }): Rendered => ({
    subject: `You're invited to the Alpha Recovery admin panel`,
    text: `Hi ${p.firstName},\n\n${p.invitedBy} added you to the Alpha Recovery team as ${p.roleLabel}.\n\nSet your password to get started:\n${p.url}\n\nThis link expires in 3 days. After that, ask for a new invite.`,
    html: layout(
      'Join the Alpha Recovery team',
      `<p>Hi ${escapeHtml(p.firstName)},</p><p>${escapeHtml(p.invitedBy)} added you to the Alpha Recovery team as <strong>${escapeHtml(p.roleLabel)}</strong>.</p>${button(p.url, 'Set your password')}<p style="font-size:13px">This link expires in 3 days. After that, ask for a new invite.</p>`,
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
      subject: p.callback ? 'We will call you back soon — Alpha Recovery' : 'We received your message — Alpha Recovery',
      text: `${hi}\n\n${line}\n\nFor anything urgent, WhatsApp us at +91 63551 97917.\n\nAlpha Recovery`,
      html: layout(
        p.callback ? 'Callback requested' : 'Message received',
        `<p>${escapeHtml(hi)}</p><p>${escapeHtml(line)}</p><p>For anything urgent, WhatsApp us at <a href="https://wa.me/916355197917" style="color:#D9B56E">+91 63551 97917</a>.</p>`,
      ),
    };
  },
} satisfies Record<string, (payload: never) => Rendered>;

export type TemplateName = keyof typeof templates;
export type TemplatePayload<T extends TemplateName> = Parameters<(typeof templates)[T]>[0];

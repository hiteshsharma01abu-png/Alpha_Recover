import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

export type EmailMessage = { to: string; subject: string; text: string; html: string; tag: string };

export interface Mailer {
  send(message: EmailMessage): Promise<{ messageId: string }>;
}

/** Postmark transactional email over HTTPS (works on any host; no SMTP). */
export function postmarkMailer(serverToken: string, from: string): Mailer {
  return {
    async send(message) {
      const res = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Postmark-Server-Token': serverToken,
        },
        body: JSON.stringify({
          From: from,
          To: message.to,
          Subject: message.subject,
          TextBody: message.text,
          HtmlBody: message.html,
          Tag: message.tag,
          MessageStream: 'outbound',
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { MessageID?: string; Message?: string };
      if (!res.ok || !body.MessageID) {
        throw new AppError('UPSTREAM_ERROR', `Postmark ${res.status}: ${body.Message ?? 'unknown error'}`);
      }
      return { messageId: body.MessageID };
    },
  };
}

/** Development fallback when POSTMARK_SERVER_TOKEN is unset: logs the email instead of sending it. */
export function logMailer(): Mailer {
  return {
    async send(message) {
      logger.info('email (not sent: no POSTMARK_SERVER_TOKEN)', {
        to: message.to,
        subject: message.subject,
        tag: message.tag,
        text: message.text,
      });
      return { messageId: `dev-${Date.now()}` };
    },
  };
}

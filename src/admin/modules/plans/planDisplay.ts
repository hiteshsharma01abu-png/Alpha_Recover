import type { PromotionState, PublishStatus } from '../../lib/adminApi';

export const PUBLISH_STATUSES: PublishStatus[] = ['draft', 'published', 'archived'];
export const PUBLISH_LABEL: Record<PublishStatus, string> = { draft: 'Draft', published: 'Published', archived: 'Archived' };
export const PUBLISH_TONE: Record<PublishStatus, 'success' | 'warning' | 'muted'> = { published: 'success', draft: 'warning', archived: 'muted' };

export const PROMO_LABEL: Record<PromotionState, string> = { running: 'Running', scheduled: 'Scheduled', paused: 'Paused', ended: 'Ended' };
export const PROMO_TONE: Record<PromotionState, 'success' | 'info' | 'warning' | 'muted'> = { running: 'success', scheduled: 'info', paused: 'warning', ended: 'muted' };

/** "5999" / "5,999.50" → paise, or null when it isn't a valid amount. */
export function rupeesToPaise(text: string): number | null {
  const clean = text.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

export const paiseToRupees = (paise: number | null) => (paise === null ? '' : String(paise / 100));

const istParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** ISO timestamp → "YYYY-MM-DDTHH:mm" in IST, for a datetime-local input. */
export function toIstInput(iso: string) {
  const p = Object.fromEntries(istParts.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export const accessLabel = (days: number | null) => (days === null ? 'Lifetime access' : `${days} days`);

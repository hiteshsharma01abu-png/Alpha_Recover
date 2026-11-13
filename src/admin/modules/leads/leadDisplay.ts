import { LEAD_REASONS, LEAD_SOURCE_LABELS, LEAD_STATUS_LABELS } from '../../../../shared/leads';
import type { LeadStatus } from '../../../../shared/leads';

export const STATUS_TONE: Record<LeadStatus, 'info' | 'warning' | 'success' | 'danger' | 'muted' | 'accent'> = {
  new: 'warning',
  contacted: 'info',
  qualified: 'accent',
  converted: 'success',
  closed: 'muted',
  spam: 'danger',
};

export const statusLabel = (s: LeadStatus) => LEAD_STATUS_LABELS[s];
export const reasonLabel = (v: string | null) => LEAD_REASONS.find((r) => r.value === v)?.label ?? '—';
export const sourceLabel = (v: string) => LEAD_SOURCE_LABELS[v] ?? v;

const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
/** Staff work in India time, whatever the browser's zone. */
export const formatIst = (iso: string) => `${dateTime.format(new Date(iso))} IST`;

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
export function ago(iso: string, now = Date.now()) {
  const mins = Math.round((now - Date.parse(iso)) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return relative.format(-mins, 'minute');
  const hours = Math.round(mins / 60);
  if (hours < 24) return relative.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 30) return relative.format(-days, 'day');
  return dateTime.format(new Date(iso)).split(',')[0];
}

/** Digits for wa.me links (E.164 without the plus). */
export const waDigits = (phone: string) => phone.replace(/\D/g, '');

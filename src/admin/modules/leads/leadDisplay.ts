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

export { ago, formatIst } from '../../lib/format';

/** Digits for wa.me links (E.164 without the plus). */
export const waDigits = (phone: string) => phone.replace(/\D/g, '');

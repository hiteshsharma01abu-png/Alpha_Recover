/**
 * Lead options shared by the frontend forms and the API (docs/API.md §8).
 * Plain data, no dependencies, so the frontend bundle stays small.
 */
export const LEAD_REASONS = [
  { value: 'technical_support', label: 'Technical Support' },
  { value: 'software_hardware_sale', label: 'Software / hardware sale' },
  { value: 'data_recovery_service', label: 'Data Recovery services' },
  { value: 'training', label: 'Training' },
  { value: 'other', label: 'Other' },
] as const;

export type LeadReason = (typeof LEAD_REASONS)[number]['value'];

export const LEAD_SOURCES = ['contact_form', 'callback'] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'closed', 'spam'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  converted: 'Converted',
  closed: 'Closed',
  spam: 'Spam',
};

/** Every source the leads table can hold (forms create the first two; the rest come later). */
export const LEAD_SOURCE_LABELS: Record<string, string> = {
  contact_form: 'Contact form',
  callback: 'Callback request',
  whatsapp: 'WhatsApp',
  manual: 'Added by staff',
};

/** Note types staff can add by hand; status_change / assignment are written by the API. */
export const LEAD_NOTE_TYPES = [
  { value: 'note', label: 'Note' },
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
] as const;

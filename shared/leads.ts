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

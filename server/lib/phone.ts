/**
 * Normalizes a typed phone number to E.164 (`+916355197917`). Most leads are Indian, so a bare
 * 10-digit number (or 0 + 10 digits) is treated as +91. Returns null if it can't be a phone number.
 */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  if (!/^\+?[\d\s\-().]{7,25}$/.test(raw)) return null;
  const digits = raw.replace(/\D/g, '');
  let e164: string;
  if (raw.startsWith('+')) e164 = `+${digits}`;
  else if (digits.startsWith('00')) e164 = `+${digits.slice(2)}`;
  else if (digits.length === 10) e164 = `+91${digits}`;
  else if (digits.length === 11 && digits.startsWith('0')) e164 = `+91${digits.slice(1)}`;
  else if (digits.length === 12 && digits.startsWith('91')) e164 = `+${digits}`;
  else return null;
  const n = e164.length - 1;
  return n >= 8 && n <= 15 ? e164 : null;
}

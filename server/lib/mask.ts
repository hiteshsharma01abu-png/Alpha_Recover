/** Partial masking for personal data in admin lists (docs/admin/SECURITY.md §7). Full values on detail views. */
export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return '•••••';
  const country = phone.startsWith('+91') ? '+91 ' : phone.startsWith('+') ? `+${digits.slice(0, digits.length - 10)} ` : '';
  return `${country}••••• ${digits.slice(-5)}`;
}

/** CSV cell: quotes, and neutralises formula injection (cells starting with = + - @ tab or CR). */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

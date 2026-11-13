import { REGISTER_COUNTRIES } from '../../../shared/countries';

const dateTime = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' });
const dateOnly = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' });

/** Staff work in India time, whatever the browser's zone. */
export const formatIst = (iso: string) => `${dateTime.format(new Date(iso))} IST`;
export const formatDate = (iso: string) => dateOnly.format(new Date(iso));

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
export function ago(iso: string, now = Date.now()) {
  const mins = Math.round((now - Date.parse(iso)) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return relative.format(-mins, 'minute');
  const hours = Math.round(mins / 60);
  if (hours < 24) return relative.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 30) return relative.format(-days, 'day');
  return formatDate(iso);
}

export const countryName = (code: string) => REGISTER_COUNTRIES.find((c) => c.code === code)?.label ?? code;

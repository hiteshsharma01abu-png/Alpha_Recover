import type { EnrollmentSource, EnrollmentStatus } from '../../lib/adminApi';

export const ENROLLMENT_STATUSES: EnrollmentStatus[] = ['active', 'expired', 'revoked'];

export const STATUS_TONE: Record<EnrollmentStatus, 'success' | 'muted' | 'danger'> = { active: 'success', expired: 'muted', revoked: 'danger' };
export const STATUS_LABEL: Record<EnrollmentStatus, string> = { active: 'Active', expired: 'Expired', revoked: 'Revoked' };
export const SOURCE_LABEL: Record<EnrollmentSource, string> = { purchase: 'Purchase', manual: 'Granted by staff', complimentary: 'Complimentary' };

/** Today in India time as YYYY-MM-DD (the minimum for an end date). */
export const todayIst = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

/** An ISO timestamp as the IST calendar day, for prefilling a date input. */
export const istDay = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(iso));

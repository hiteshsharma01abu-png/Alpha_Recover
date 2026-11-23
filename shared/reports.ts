/**
 * Report tabs and who sees them (docs/admin/AUTH_AND_RBAC.md §3): `reports.view` plus view access to
 * the module the report summarises, so a report never shows data its reader couldn't open anyway.
 * Shared by the API (enforcement) and the admin UI (which tabs to show).
 */
import type { Permission } from './permissions';

export const REPORT_TYPES = ['leads', 'students', 'enrollments', 'learning', 'content'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_ACCESS: Record<ReportType, { label: string; anyOf: Permission[] }> = {
  leads: { label: 'Leads', anyOf: ['leads.view'] },
  students: { label: 'Students', anyOf: ['students.view'] },
  enrollments: { label: 'Enrollments', anyOf: ['enrollments.view'] },
  /** Aggregates only (no student names), so course staff may see it too. */
  learning: { label: 'Learning', anyOf: ['students.view', 'courses.view'] },
  content: { label: 'Content', anyOf: ['courses.view', 'demos.view'] },
};

export const REPORT_INTERVALS = ['day', 'week', 'month'] as const;
export type ReportInterval = (typeof REPORT_INTERVALS)[number];

import type { UserRole } from '../db/schema';

/** Permission matrix from docs/SECURITY.md §2. Keep the two in sync. */
export const PERMISSIONS = [
  'dashboard.view',
  'leads.read',
  'leads.write',
  'leads.export',
  'students.read',
  'students.write',
  'enrollments.read',
  'enrollments.write',
  'orders.read',
  'orders.refund',
  'plans.read',
  'plans.write',
  'courses.read',
  'courses.write',
  'demos.read',
  'demos.write',
  'blog.read',
  'blog.write',
  'blog.publish',
  'certificates.read',
  'certificates.write',
  'notifications.read',
  'notifications.write',
  'reports.view',
  'reports.export',
  'audit.read',
  'settings.read',
  'settings.write',
  'admins.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const support: Permission[] = [
  'dashboard.view',
  'leads.read',
  'leads.write',
  'students.read',
  'enrollments.read',
  'orders.read',
  'certificates.read',
  'notifications.read',
];

const contentManager: Permission[] = [
  'dashboard.view',
  'courses.read',
  'courses.write',
  'demos.read',
  'demos.write',
  'blog.read',
  'blog.write',
  'blog.publish',
];

const admin: Permission[] = PERMISSIONS.filter((p) => p !== 'settings.write' && p !== 'admins.manage');

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  student: new Set(),
  support: new Set(support),
  content_manager: new Set(contentManager),
  admin: new Set(admin),
  super_admin: new Set(PERMISSIONS),
};

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export const isStaff = (role: UserRole) => role !== 'student';

/** Refunds above this need super_admin (docs/SECURITY.md §2). */
export const ADMIN_REFUND_LIMIT_PAISE = 500_000;

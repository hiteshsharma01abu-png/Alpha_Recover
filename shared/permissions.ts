/**
 * Roles and permissions, shared by the API (authorization) and the admin UI (what to show).
 * Source of truth for docs/admin/AUTH_AND_RBAC.md §3 — keep the two in sync.
 * The UI never decides access on its own: every API route checks these too.
 */

export const USER_ROLES = ['student', 'support_manager', 'content_manager', 'finance_manager', 'admin', 'super_admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];
export type StaffRole = Exclude<UserRole, 'student'>;

export const ROLE_LABELS: Record<UserRole, string> = {
  student: 'Student',
  support_manager: 'Support Manager',
  content_manager: 'Content Manager',
  finance_manager: 'Finance Manager',
  admin: 'Admin',
  super_admin: 'Super Admin',
};

const MODULE_ACTIONS = {
  dashboard: ['view'],
  leads: ['view', 'add', 'edit', 'delete', 'export', 'import'],
  students: ['view', 'add', 'edit', 'delete', 'export'],
  enrollments: ['view', 'add', 'edit', 'export', 'revoke'],
  orders: ['view', 'edit', 'export', 'refund'],
  courses: ['view', 'add', 'edit', 'delete', 'import'],
  plans: ['view', 'add', 'edit', 'delete'],
  demos: ['view', 'add', 'edit', 'delete'],
  blog: ['view', 'add', 'edit', 'delete', 'publish'],
  certificates: ['view', 'add', 'edit', 'export', 'revoke'],
  reports: ['view', 'export'],
  audit: ['view', 'export'],
  team: ['view', 'add', 'edit', 'delete', 'manage_roles'],
  notifications: ['view', 'edit'],
  settings: ['view', 'edit', 'edit_policies'],
} as const;

type ModuleActions = typeof MODULE_ACTIONS;
export type Module = keyof ModuleActions;
export type Permission = { [M in Module]: `${M}.${ModuleActions[M][number]}` }[Module];

export const PERMISSIONS = (Object.entries(MODULE_ACTIONS) as [Module, readonly string[]][]).flatMap(([m, actions]) =>
  actions.map((a) => `${m}.${a}` as Permission),
);

/** Shorthand: grant(['leads', 'VAEDXI']) — V view, A add, E edit, D delete, X export, I import. */
function grant(rows: [Module, string, ...string[]][]): Permission[] {
  const letters: Record<string, string> = { V: 'view', A: 'add', E: 'edit', D: 'delete', X: 'export', I: 'import' };
  return rows.flatMap(([module, codes, ...special]) => [
    ...[...codes].map((ch) => `${module}.${letters[ch]}` as Permission),
    ...special.map((s) => `${module}.${s}` as Permission),
  ]);
}

const ROLE_PERMISSIONS: Record<UserRole, ReadonlySet<Permission>> = {
  student: new Set(),
  super_admin: new Set(PERMISSIONS),
  admin: new Set(
    grant([
      ['dashboard', 'V'],
      ['leads', 'VAEDXI'],
      ['students', 'VAEDX'],
      ['enrollments', 'VAEX', 'revoke'],
      ['orders', 'VEX', 'refund'],
      ['courses', 'VAEDI'],
      ['plans', 'VAED'],
      ['demos', 'VAED'],
      ['blog', 'VAED', 'publish'],
      ['certificates', 'VAEX', 'revoke'],
      ['reports', 'VX'],
      ['audit', 'VX'],
      ['team', 'V'],
      ['notifications', 'VE'],
      ['settings', 'VE'],
    ]),
  ),
  finance_manager: new Set(
    grant([
      ['dashboard', 'V'],
      ['students', 'V'],
      ['enrollments', 'VAX', 'revoke'],
      ['orders', 'VEX', 'refund'],
      ['plans', 'VAED'],
      ['reports', 'VX'],
    ]),
  ),
  content_manager: new Set(
    grant([
      ['dashboard', 'V'],
      ['courses', 'VAEDI'],
      ['plans', 'V'],
      ['demos', 'VAED'],
      ['blog', 'VAED', 'publish'],
      ['reports', 'V'],
    ]),
  ),
  support_manager: new Set(
    grant([
      ['dashboard', 'V'],
      ['leads', 'VAEXI'],
      ['students', 'VE'],
      ['enrollments', 'V'],
      ['orders', 'V'],
      ['certificates', 'V'],
      ['reports', 'VX'],
      ['notifications', 'VE'],
    ]),
  ),
};

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function permissionsFor(role: UserRole): Permission[] {
  return PERMISSIONS.filter((p) => ROLE_PERMISSIONS[role].has(p));
}

export const isStaff = (role: UserRole): role is StaffRole => role !== 'student';

/** Refund ceiling in paise per role (null = no limit). Roles without orders.refund can't refund at all. */
export const REFUND_LIMITS: Partial<Record<UserRole, number | null>> = {
  admin: 500_000,
  finance_manager: null,
  super_admin: null,
};

/** Only super_admin assigns roles; nobody changes their own; the last super_admin can't be demoted. */
export const canManageRoles = (role: UserRole) => can(role, 'team.manage_roles');

import type { Permission } from '../../shared/permissions';

export type AdminNavItem = {
  /** Path under /admin ('' = dashboard). */
  path: string;
  label: string;
  icon: 'dashboard' | 'leads' | 'students' | 'team' | 'activity';
  permission: Permission;
  group: 'Overview' | 'Sales' | 'Learners' | 'Content' | 'Insights' | 'System';
};

/**
 * Sidebar + route permissions in one place (docs/admin/NAVIGATION.md). Modules are added here as they
 * ship, so the sidebar never links to unfinished pages.
 */
export const ADMIN_NAV: AdminNavItem[] = [
  { path: '', label: 'Dashboard', icon: 'dashboard', permission: 'dashboard.view', group: 'Overview' },
  { path: 'leads', label: 'Leads & Inquiries', icon: 'leads', permission: 'leads.view', group: 'Sales' },
];

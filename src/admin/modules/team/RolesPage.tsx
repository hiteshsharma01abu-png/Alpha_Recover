import { PERMISSIONS, ROLE_LABELS, USER_ROLES, can, isStaff } from '../../../../shared/permissions';
import type { Module } from '../../../../shared/permissions';
import { TeamTabs } from './TeamPage';
import './Team.css';

const STAFF_ROLES = USER_ROLES.filter(isStaff);
const MODULE_LABELS: Record<Module, string> = {
  dashboard: 'Dashboard',
  leads: 'Leads & Inquiries',
  students: 'Students',
  enrollments: 'Enrollments',
  orders: 'Orders & Payments',
  courses: 'Courses & Training',
  plans: 'Plans & Offers',
  demos: 'Demo Videos',
  blog: 'Blog',
  certificates: 'Certificates',
  reports: 'Reports',
  audit: 'Activity Log',
  team: 'Team & Access',
  notifications: 'Email Log',
  settings: 'Settings',
};
const ACTION_LABELS: Record<string, string> = {
  view: 'View',
  add: 'Add',
  edit: 'Edit',
  delete: 'Delete',
  export: 'Export',
  import: 'Import',
  revoke: 'Revoke',
  refund: 'Refund',
  publish: 'Publish',
  manage_roles: 'Change roles',
  edit_policies: 'Edit policies',
};

const MODULES = [...new Set(PERMISSIONS.map((p) => p.split('.')[0] as Module))];

/** /admin/team/roles — read-only view of shared/permissions.ts, the same matrix the API enforces. */
export function RolesPage() {
  return (
    <div>
      <TeamTabs />
      <p className="adm-muted">What each role can do. This is the exact list the server checks on every request; it changes only with a code update.</p>
      <div className="adm-table-wrap adm-roles-wrap">
        <table className="adm-table adm-roles">
          <thead>
            <tr>
              <th scope="col">Module</th>
              {STAFF_ROLES.map((r) => (
                <th key={r} scope="col">
                  {ROLE_LABELS[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="adm-static-rows">
            {MODULES.map((m) => {
              const perms = PERMISSIONS.filter((p) => p.startsWith(`${m}.`));
              return (
                <tr key={m}>
                  <th scope="row">{MODULE_LABELS[m]}</th>
                  {STAFF_ROLES.map((r) => {
                    const allowed = perms.filter((p) => can(r, p));
                    return (
                      <td key={r} data-label={ROLE_LABELS[r]}>
                        {allowed.length ? (
                          allowed.map((p) => (
                            <span key={p} className="adm-chip">
                              {ACTION_LABELS[p.split('.')[1]] ?? p.split('.')[1]}
                            </span>
                          ))
                        ) : (
                          <span className="adm-muted">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

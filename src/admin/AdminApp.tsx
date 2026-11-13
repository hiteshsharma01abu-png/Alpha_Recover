import { useEffect } from 'react';
import type { ComponentType } from 'react';
import type { Permission } from '../../shared/permissions';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminSessionProvider } from './auth/AdminSession';
import { AdminLoginPage } from './auth/AdminLoginPage';
import { RequirePermission } from './auth/RequirePermission';
import { RequireStaff } from './auth/RequireStaff';
import { AdminLayout } from './layout/AdminLayout';
import { DashboardPage } from './modules/dashboard/DashboardPage';
import { ActivityPage } from './modules/activity/ActivityPage';
import { LeadsPage } from './modules/leads/LeadsPage';
import { StudentDetailPage } from './modules/students/StudentDetailPage';
import { StudentsPage } from './modules/students/StudentsPage';
import { RolesPage } from './modules/team/RolesPage';
import { TeamPage } from './modules/team/TeamPage';

/** Module routes and the permission each needs (the sidebar uses the same permissions via routes.ts). */
const GUARDED: [path: string, perm: Permission, Page: ComponentType][] = [
  ['leads', 'leads.view', LeadsPage],
  ['students', 'students.view', StudentsPage],
  ['students/:id', 'students.view', StudentDetailPage],
  ['activity', 'audit.view', ActivityPage],
  ['team', 'team.view', TeamPage],
  ['team/roles', 'team.view', RolesPage],
];

/** Keeps admin pages out of search engines and labels the tab. */
function useAdminDocument() {
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const previousTitle = document.title;
    document.title = 'Admin · Alpha Recover';
    return () => {
      meta.remove();
      document.title = previousTitle;
    };
  }, []);
}

/** /admin/* — lazy-loaded from App.tsx, so none of this ships with the public pages. */
export default function AdminApp() {
  useAdminDocument();
  return (
    <AdminSessionProvider>
      <Routes>
        <Route path="login" element={<AdminLoginPage />} />
        <Route element={<RequireStaff />}>
          <Route element={<AdminLayout />}>
            <Route index element={<DashboardPage />} />
            {GUARDED.map(([path, perm, Page]) => (
              <Route key={path} path={path} element={<RequirePermission perm={perm}>
                    <Page />
                  </RequirePermission>} />
            ))}
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route>
      </Routes>
    </AdminSessionProvider>
  );
}

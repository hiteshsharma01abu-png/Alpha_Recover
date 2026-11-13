import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminSessionProvider } from './auth/AdminSession';
import { AdminLoginPage } from './auth/AdminLoginPage';
import { RequireStaff } from './auth/RequireStaff';
import { AdminLayout } from './layout/AdminLayout';
import { DashboardPage } from './modules/dashboard/DashboardPage';

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
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route>
      </Routes>
    </AdminSessionProvider>
  );
}

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminSession } from './adminSessionContext';

/** Gate for the admin shell: loading → login → "no access" → the panel. */
export function RequireStaff() {
  const { status } = useAdminSession();
  const location = useLocation();
  if (status === 'loading') return <div className="adm-boot" aria-busy="true" />;
  if (status !== 'ready') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/admin/login?next=${next}`} replace />;
  }
  return <Outlet />;
}

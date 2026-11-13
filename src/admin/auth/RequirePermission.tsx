import type { ReactNode } from 'react';
import type { Permission } from '../../../shared/permissions';
import { EmptyState } from '../components/States';
import { useAdminSession } from './adminSessionContext';

/** Per-route gate (docs/admin/AUTH_AND_RBAC.md §7). The sidebar hides the link too; the API checks again. */
export function RequirePermission({ perm, children }: { perm: Permission; children: ReactNode }) {
  const { can } = useAdminSession();
  if (!can(perm)) {
    return (
      <EmptyState>
        <p>You don&apos;t have access to this page. Ask a super admin if you need it.</p>
      </EmptyState>
    );
  }
  return children;
}

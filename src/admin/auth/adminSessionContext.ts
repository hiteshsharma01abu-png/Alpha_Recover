import { createContext, useContext } from 'react';
import type { Permission } from '../../../shared/permissions';
import type { AdminMe } from '../lib/adminApi';

export type AdminSessionStatus = 'loading' | 'anonymous' | 'forbidden' | 'ready' | 'error';

export type AdminSession = {
  status: AdminSessionStatus;
  me: AdminMe | null;
  /** UI convenience only: every API route authorizes again on the server. */
  can: (permission: Permission) => boolean;
  reload: () => Promise<void>;
};

export const AdminSessionContext = createContext<AdminSession | null>(null);

export function useAdminSession(): AdminSession {
  const ctx = useContext(AdminSessionContext);
  if (!ctx) throw new Error('useAdminSession must be used inside <AdminSessionProvider>');
  return ctx;
}

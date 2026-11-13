import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError } from '../../lib/api';
import { adminApi, type AdminMe } from '../lib/adminApi';
import { AdminSessionContext, type AdminSession, type AdminSessionStatus } from './adminSessionContext';

/** Loads GET /admin/me once and shares it with the whole admin app. */
export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AdminSessionStatus>('loading');
  const [me, setMe] = useState<AdminMe | null>(null);

  const settle = useCallback((request: Promise<AdminMe>) => {
    return request.then(
      (data) => {
        setMe(data);
        setStatus('ready');
      },
      (err: unknown) => {
        setMe(null);
        if (err instanceof ApiError && err.status === 401) setStatus('anonymous');
        else if (err instanceof ApiError && err.status === 403) setStatus('forbidden');
        else setStatus('error');
      },
    );
  }, []);

  const reload = useCallback(() => settle(adminApi.me()), [settle]);

  useEffect(() => {
    void settle(adminApi.me());
  }, [settle]);

  const value = useMemo<AdminSession>(() => {
    const granted = new Set(me?.permissions ?? []);
    return { status, me, reload, can: (p) => granted.has(p) };
  }, [status, me, reload]);

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

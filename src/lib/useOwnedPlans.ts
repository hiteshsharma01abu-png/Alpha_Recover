import { useEffect, useState } from 'react';
import { api } from './api';
import { useAuth } from './auth';

type MyEnrollment = { status: 'active' | 'revoked' | 'expired'; planSlug: string; planName: string; grantsAllCourses: boolean };

/** Plans the signed-in student holds now: `owned` by slug, and the name of a plan that already includes every course. */
export type OwnedPlans = { owned: Set<string>; allCoursesPlan: string | null };

/**
 * What the pricing page needs to replace Buy with "You own this plan". null while signed out or loading;
 * loaded after hydration, so the pre-rendered page is the same for everyone. A new `refreshKey` loads it again
 * (the header passes one that changes after a purchase).
 */
export function useOwnedPlans(refreshKey: string | number | boolean = 0): OwnedPlans | null {
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<{ userId: string; plans: OwnedPlans } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    void refreshKey;
    api
      .get<MyEnrollment[]>('/me/enrollments')
      .then((r) => {
        const active = r.data.filter((e) => e.status === 'active');
        if (live) setState({ userId, plans: { owned: new Set(active.map((e) => e.planSlug)), allCoursesPlan: active.find((e) => e.grantsAllCourses)?.planName ?? null } });
      })
      .catch(() => {
        // Not knowing is fine: Buy still works and the server refuses a plan you own
      });
    return () => {
      live = false;
    };
  }, [userId, refreshKey]);

  return userId && state?.userId === userId ? state.plans : null;
}

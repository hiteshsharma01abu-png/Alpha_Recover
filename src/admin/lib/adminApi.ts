import type { Permission, UserRole } from '../../../shared/permissions';
import { api } from '../../lib/api';

export type AdminMe = {
  user: { id: string; email: string; firstName: string; emailVerified: boolean };
  role: UserRole;
  roleLabel: string;
  permissions: Permission[];
};

export type RecentLead = {
  id: string;
  name: string | null;
  phone: string | null;
  source: string;
  reason: string | null;
  status: string;
  createdAt: string;
};

/** Each block is present only if the role may see that module (server decides). */
export type DashboardData = {
  leads?: { total: number; new: number; last7Days: number; recent: RecentLead[] };
  students?: { total: number; last7Days: number };
  content?: { tracks: number; lessons: number; lessonsWithVideo: number; blogPosts: number; blogPostsExcerptOnly: number };
  demoVideos?: { published: number; totalViews: number };
  pricing?: {
    plan: string;
    effectivePricePaise: number;
    pricePaise: number;
    promotion: { label: string; startsAt: string; endsAt: string } | null;
  } | null;
  email?: { failed: number; queued: number };
};

export const adminApi = {
  me: () => api.get<AdminMe>('/admin/me').then((r) => r.data),
  dashboard: () => api.get<DashboardData>('/admin/dashboard').then((r) => r.data),
};

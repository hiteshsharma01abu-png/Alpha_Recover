import type { LeadReason, LeadStatus } from '../../../shared/leads';
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

export type StaffRef = { id: string; firstName: string | null };

/** List rows: email and phone arrive masked. */
export type LeadRow = {
  id: string;
  source: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  reason: LeadReason | null;
  status: LeadStatus;
  assignee: StaffRef | null;
  createdAt: string;
};

export type LeadListMeta = { page: number; pageSize: number; total: number; counts: Record<LeadStatus | 'open', number> };

export type LeadNote = {
  id: string;
  type: 'note' | 'call' | 'email' | 'whatsapp' | 'status_change' | 'assignment';
  body: string | null;
  fromStatus: LeadStatus | null;
  toStatus: LeadStatus | null;
  author: StaffRef | null;
  createdAt: string;
};

export type LeadDetail = Omit<LeadRow, 'assignee'> & {
  message: string | null;
  whatsappConsent: boolean;
  pagePath: string | null;
  utm: Record<string, string> | null;
  userAgent: string | null;
  assignee: StaffRef | null;
  updatedAt: string;
  notes: LeadNote[];
};


export type StudentRow = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  phone: string | null;
  country: string;
  status: 'active' | 'suspended';
  emailVerified: boolean;
  enrolled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type StudentDetail = Omit<StudentRow, 'enrolled'> & {
  certificateName: string | null;
  whatsappOptIn: boolean;
  enrollments: { id: string; plan: string; source: string; status: string; startsAt: string; expiresAt: string | null; revokedReason: string | null }[];
  certificates: { id: string; code: string; programTitle: string; status: string; issuedAt: string }[];
  sessions: { id: string; device: string; signedInAt: string; lastActiveAt: string }[];
};

export type StudentUpdate = Partial<{ firstName: string; lastName: string | null; certificateName: string | null; phone: string | null; country: string }>;

export type TeamMember = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  role: UserRole;
  roleLabel: string;
  status: 'active' | 'suspended';
  invitePending: boolean;
  sessions: number;
  lastLoginAt: string | null;
  createdAt: string;
};

export type ActivityEntry = {
  id: number;
  action: string;
  actorRole: UserRole | null;
  actor: { id: string; firstName: string | null; email: string | null } | null;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  requestId: string | null;
  createdAt: string;
};

export type PageMeta = { page: number; pageSize: number; total: number };

export type Assignee = { id: string; firstName: string; role: UserRole };

const qs = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]))).toString();
  return search ? `?${search}` : '';
};

export const adminApi = {
  me: () => api.get<AdminMe>('/admin/me').then((r) => r.data),
  dashboard: () => api.get<DashboardData>('/admin/dashboard').then((r) => r.data),
  leads: {
    list: (params: Record<string, string | undefined>) =>
      api.get<LeadRow[]>(`/admin/leads${qs(params)}`).then((r) => ({ rows: r.data, meta: r.meta as LeadListMeta })),
    get: (id: string) => api.get<LeadDetail>(`/admin/leads/${id}`).then((r) => r.data),
    update: (id: string, body: { status?: LeadStatus; assignedTo?: string | null }) =>
      api.patch<{ id: string; status: LeadStatus; assignee: StaffRef | null }>(`/admin/leads/${id}`, body).then((r) => r.data),
    addNote: (id: string, body: { type: string; body: string }) => api.post<{ ok: true }>(`/admin/leads/${id}/notes`, body).then((r) => r.data),
    assignees: () => api.get<Assignee[]>('/admin/leads/assignees').then((r) => r.data),
    /** A plain link: the browser downloads it with the session cookie. */
    exportUrl: (params: Record<string, string | undefined>) => `/api/v1/admin/leads/export.csv${qs(params)}`,
  },
  students: {
    list: (params: Record<string, string | undefined>) =>
      api.get<StudentRow[]>(`/admin/students${qs(params)}`).then((r) => ({ rows: r.data, meta: r.meta as PageMeta })),
    get: (id: string) => api.get<StudentDetail>(`/admin/students/${id}`).then((r) => r.data),
    update: (id: string, body: StudentUpdate) => api.patch<{ ok: true; changed: string[] }>(`/admin/students/${id}`, body).then((r) => r.data),
    suspend: (id: string, reason: string) => api.post<{ ok: true }>(`/admin/students/${id}/suspend`, { reason }).then((r) => r.data),
    unsuspend: (id: string) => api.post<{ ok: true }>(`/admin/students/${id}/unsuspend`).then((r) => r.data),
    revokeSessions: (id: string) => api.post<{ ok: true; revoked: number }>(`/admin/students/${id}/sessions/revoke`).then((r) => r.data),
    passwordReset: (id: string) => api.post<{ ok: true }>(`/admin/students/${id}/password-reset`).then((r) => r.data),
  },
  team: {
    list: () => api.get<TeamMember[]>('/admin/team').then((r) => r.data),
    invite: (body: { email: string; firstName: string; role: UserRole }) =>
      api.post<{ id: string; action: 'invited' | 'promoted' }>('/admin/team', body).then((r) => r.data),
    resendInvite: (id: string) => api.post<{ ok: true }>(`/admin/team/${id}/resend-invite`).then((r) => r.data),
    setRole: (id: string, role: UserRole) => api.patch<{ id: string; role: UserRole }>(`/admin/team/${id}/role`, { role }).then((r) => r.data),
    deactivate: (id: string) => api.post<{ id: string }>(`/admin/team/${id}/deactivate`).then((r) => r.data),
    reactivate: (id: string) => api.post<{ id: string }>(`/admin/team/${id}/reactivate`).then((r) => r.data),
  },
  activity: {
    list: (params: Record<string, string | undefined>) =>
      api.get<ActivityEntry[]>(`/admin/activity${qs(params)}`).then((r) => ({ rows: r.data, meta: r.meta as PageMeta })),
    facets: () => api.get<{ actions: string[]; actors: { id: string; firstName: string; role: UserRole }[] }>('/admin/activity/facets').then((r) => r.data),
    exportUrl: (params: Record<string, string | undefined>) => `/api/v1/admin/activity/export.csv${qs(params)}`,
  },
};

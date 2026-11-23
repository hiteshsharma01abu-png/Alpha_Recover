import type { LeadReason, LeadStatus } from '../../../shared/leads';
import type { Permission, UserRole } from '../../../shared/permissions';
import type { ReportInterval, ReportType } from '../../../shared/reports';
import { api } from '../../lib/api';
import type { SocialPlatform } from '../../data/content';
import type { Company } from '../../lib/settings';

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
  enrollments: { id: string; plan: string; source: EnrollmentSource; status: EnrollmentStatus; startsAt: string; expiresAt: string | null; revokedReason: string | null }[];
  certificates: { id: string; code: string; recipientName: string; programTitle: string; status: 'valid' | 'revoked'; issuedAt: string }[];
  sessions: { id: string; device: string; signedInAt: string; lastActiveAt: string }[];
  /** Courses the student has started, most recent activity first. */
  learning: { slug: string; title: string; lessonsTotal: number; lessonsCompleted: number; progressPct: number; lastActivityAt: string }[];
};

export type StudentUpdate = Partial<{ firstName: string; lastName: string | null; certificateName: string | null; phone: string | null; country: string }>;

export type EnrollmentStatus = 'active' | 'expired' | 'revoked';
export type EnrollmentSource = 'purchase' | 'manual' | 'complimentary';

/** List rows: the student's email arrives masked. Status is computed (active past its end date = expired). */
export type EnrollmentRow = {
  id: string;
  userId: string;
  planId: string;
  plan: string;
  source: EnrollmentSource;
  status: EnrollmentStatus;
  orderId: string | null;
  startsAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  student: { id: string; firstName: string; lastName: string | null; email: string };
  grantedBy: StaffRef | null;
};

export type EnrollmentListMeta = PageMeta & { counts: Record<EnrollmentStatus, number> };

export type EnrollmentPlan = { id: string; name: string; status: string; accessDays: number | null };

/** `expiresOn` omitted = the plan's default period; null = lifetime; YYYY-MM-DD = until the end of that day (IST). */
export type EnrollmentGrant = { userId: string; planId: string; source: 'manual' | 'complimentary'; expiresOn?: string | null; reason: string };

export type PublishStatus = 'draft' | 'published' | 'archived';
export type PromotionState = 'running' | 'scheduled' | 'ended' | 'paused';

export type Promotion = { id: string; label: string; salePricePaise: number; startsAt: string; endsAt: string; isActive: boolean; state: PromotionState };

/** Server-computed price, the same numbers the public site shows. */
export type PlanPrice = {
  pricePaise: number;
  effectivePricePaise: number;
  comparePricePaise: number | null;
  discountPct: number;
  promotion: { label: string; startsAt: string; endsAt: string } | null;
};

export type PlanRow = PlanPrice & {
  id: string;
  slug: string;
  name: string;
  status: PublishStatus;
  accessDays: number | null;
  grantsAllCourses: boolean;
  compareAtPaise: number | null;
  nextPromotion: Promotion | null;
  activeEnrollments: number;
  updatedAt: string;
};

/** Editable fields (amounts in paise). */
export type PlanInput = {
  name: string;
  description: string | null;
  pricePaise: number;
  compareAtPaise: number | null;
  features: string[];
  mobileFeatureOrder: number[] | null;
  grantsAllCourses: boolean;
  courseIds: string[];
  accessDays: number | null;
  status: PublishStatus;
  sortOrder: number;
};

export type PlanDetail = PlanInput & {
  id: string;
  slug: string;
  currency: string;
  price: PlanPrice;
  promotions: Promotion[];
  enrollments: number;
  createdAt: string;
  updatedAt: string | null;
};

/** Start and end as "YYYY-MM-DDTHH:mm" in IST. */
export type PromotionInput = { label: string; salePricePaise: number; startsAt: string; endsAt: string };

export type DemoCategory = 'logical' | 'electrical' | 'mechanical' | 'firmware';
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced';

/** Editable fields. `thumbnailUrl` is a /assets/… path or an https URL; null = the site's bundled image. */
export type DemoVideoInput = {
  title: string;
  tag: string;
  category: DemoCategory;
  level: SkillLevel;
  description: string;
  tags: string[];
  durationSeconds: number;
  thumbnailUrl: string | null;
  status: PublishStatus;
  sortOrder: number;
  isFeatured: boolean;
};

export type AdminDemoVideo = DemoVideoInput & { id: string; slug: string; hasVideo: boolean; viewCount: number; publishedAt: string | null; updatedAt: string };

export type SettingEntry<T> = { value: T | null; isPublic: boolean; isPolicy: boolean; updatedAt: string | null; updatedBy: StaffRef | null };

/** Unset (null) values mean the built-in default applies; the UI shows that default. */
export type AdminSettings = {
  company: SettingEntry<Company>;
  social_links: SettingEntry<{ platform: SocialPlatform; url: string }[]>;
  lead_notification_emails: SettingEntry<string[]>;
  max_student_sessions: SettingEntry<number>;
  certificate_criteria: SettingEntry<{ type: 'all_lessons_completed' | 'manual' }>;
};

export type EmailState = 'queued' | 'retrying' | 'sent' | 'failed';

/** One outbox row. The email body/payload is never sent to the browser (it can hold sign-in links). */
export type EmailJob = {
  id: string;
  channel: 'email' | 'whatsapp';
  template: string;
  to: string;
  subject: string | null;
  state: EmailState;
  attempts: number;
  lastError: string | null;
  providerMessageId: string | null;
  createdAt: string;
  sentAt: string | null;
  nextAttemptAt: string | null;
  /** null = the Retry button can be offered. */
  retryBlockedReason: string | null;
};

export type BlogState = 'draft' | 'scheduled' | 'published';

export type BlogInput = {
  title: string;
  slug: string;
  excerpt: string;
  bodyMarkdown: string;
  coverImageUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type BlogRow = Pick<BlogInput, 'title' | 'slug' | 'excerpt' | 'coverImageUrl'> & {
  id: string;
  state: BlogState;
  words: number;
  author: StaffRef | null;
  publishedAt: string | null;
  updatedAt: string;
};

export type BlogDetail = BlogInput & {
  id: string;
  state: BlogState;
  /** Once published, the slug (web address) can't change. */
  slugLocked: boolean;
  author: StaffRef | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CertificateRow = {
  id: string;
  code: string;
  userId: string;
  recipientName: string;
  programTitle: string;
  planId: string | null;
  courseId: string | null;
  issuedAt: string;
  status: 'valid' | 'revoked';
  revokedAt: string | null;
  revokedReason: string | null;
  /** Email arrives masked. */
  student: { id: string; firstName: string; lastName: string | null; email: string };
  issuedBy: StaffRef | null;
};

export type CertificateIssue = { userId: string; programTitle: string; planId?: string | null; courseId?: string | null; recipientName?: string; issuedOn?: string };

export type CourseRow = {
  id: string;
  slug: string;
  title: string;
  status: PublishStatus;
  sortOrder: number;
  modules: number;
  lessons: { total: number; published: number; withVideo: number; preview: number };
  updatedAt: string;
};

export type LessonInput = { title: string; description: string | null; durationSeconds: number | null; isPreview: boolean; status: PublishStatus };
export type AdminLesson = LessonInput & { id: string; slug: string; hasVideo: boolean };
export type AdminModule = { id: string; slug: string; title: string; lessons: AdminLesson[] };
export type CourseInput = { title: string; summary: string; imageUrl: string | null; status: PublishStatus };
export type CourseDetail = CourseInput & { id: string; slug: string; updatedAt: string; modules: AdminModule[] };

export type ReportBreakdown = { key: string; count: number; of?: number }[];

/** Read-only aggregates. `range`/`series` are absent for the content report (running totals). */
export type ReportData = {
  range?: { from: string; to: string; interval: ReportInterval };
  totals: Record<string, number>;
  series?: { label: string; points: { bucket: string; count: number }[] };
  breakdowns: Record<string, ReportBreakdown>;
  note?: string;
};

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
  enrollments: {
    list: (params: Record<string, string | undefined>) =>
      api.get<EnrollmentRow[]>(`/admin/enrollments${qs(params)}`).then((r) => ({ rows: r.data, meta: r.meta as EnrollmentListMeta })),
    plans: () => api.get<EnrollmentPlan[]>('/admin/enrollments/plans').then((r) => r.data),
    grant: (body: EnrollmentGrant) => api.post<{ id: string; expiresAt: string | null }>('/admin/enrollments', body).then((r) => r.data),
    setEnd: (id: string, expiresOn: string | null) => api.patch<{ id: string; expiresAt: string | null }>(`/admin/enrollments/${id}`, { expiresOn }).then((r) => r.data),
    revoke: (id: string, reason: string) => api.post<{ id: string }>(`/admin/enrollments/${id}/revoke`, { reason }).then((r) => r.data),
    exportUrl: (params: Record<string, string | undefined>) => `/api/v1/admin/enrollments/export.csv${qs(params)}`,
  },
  plans: {
    list: () => api.get<PlanRow[]>('/admin/plans').then((r) => r.data),
    courses: () => api.get<{ id: string; title: string; status: PublishStatus }[]>('/admin/plans/courses').then((r) => r.data),
    get: (id: string) => api.get<PlanDetail>(`/admin/plans/${id}`).then((r) => r.data),
    create: (body: PlanInput & { slug: string }) => api.post<{ id: string }>('/admin/plans', body).then((r) => r.data),
    update: (id: string, body: Partial<PlanInput>) => api.patch<{ ok: true; changed: string[] }>(`/admin/plans/${id}`, body).then((r) => r.data),
    remove: (id: string) => api.delete<{ ok: true }>(`/admin/plans/${id}`).then((r) => r.data),
    addPromotion: (planId: string, body: PromotionInput) => api.post<{ id: string }>(`/admin/plans/${planId}/promotions`, body).then((r) => r.data),
    updatePromotion: (id: string, body: Partial<PromotionInput> & { isActive?: boolean }) => api.patch<Promotion>(`/admin/promotions/${id}`, body).then((r) => r.data),
    removePromotion: (id: string) => api.delete<{ ok: true }>(`/admin/promotions/${id}`).then((r) => r.data),
  },
  demoVideos: {
    list: (params: Record<string, string | undefined>) =>
      api.get<AdminDemoVideo[]>(`/admin/demo-videos${qs(params)}`).then((r) => ({ rows: r.data, meta: r.meta as { counts: Record<PublishStatus, number> } })),
    get: (id: string) => api.get<AdminDemoVideo>(`/admin/demo-videos/${id}`).then((r) => r.data),
    create: (body: DemoVideoInput & { slug: string }) => api.post<{ id: string }>('/admin/demo-videos', body).then((r) => r.data),
    update: (id: string, body: Partial<DemoVideoInput>) => api.patch<{ ok: true; changed: string[] }>(`/admin/demo-videos/${id}`, body).then((r) => r.data),
    remove: (id: string) => api.delete<{ ok: true }>(`/admin/demo-videos/${id}`).then((r) => r.data),
  },
  settings: {
    get: () => api.get<AdminSettings>('/admin/settings').then((r) => r.data),
    save: <K extends keyof AdminSettings>(key: K, value: NonNullable<AdminSettings[K]['value']>) =>
      api.put<{ ok: true; changed: boolean }>(`/admin/settings/${key}`, { value }).then((r) => r.data),
  },
  notifications: {
    list: (params: Record<string, string | undefined>) =>
      api.get<EmailJob[]>(`/admin/notifications${qs(params)}`).then((r) => ({ rows: r.data, meta: r.meta as PageMeta & { counts: Record<EmailState, number>; stalledSince: string | null } })),
    retry: (id: string) => api.post<{ ok: true }>(`/admin/notifications/${id}/retry`).then((r) => r.data),
  },
  blog: {
    list: (params: Record<string, string | undefined>) =>
      api.get<BlogRow[]>(`/admin/blog${qs(params)}`).then((r) => ({ rows: r.data, meta: r.meta as PageMeta & { counts: Record<BlogState, number> } })),
    get: (id: string) => api.get<BlogDetail>(`/admin/blog/${id}`).then((r) => r.data),
    create: (body: BlogInput) => api.post<{ id: string }>('/admin/blog', body).then((r) => r.data),
    update: (id: string, body: Partial<BlogInput>) => api.patch<{ ok: true; changed: string[] }>(`/admin/blog/${id}`, body).then((r) => r.data),
    /** `publishAt` "YYYY-MM-DDTHH:mm" in IST schedules; omitted = now. */
    publish: (id: string, publishAt?: string) => api.post<{ state: BlogState; publishedAt: string }>(`/admin/blog/${id}/publish`, publishAt ? { publishAt } : {}).then((r) => r.data),
    unpublish: (id: string) => api.post<{ state: BlogState }>(`/admin/blog/${id}/unpublish`).then((r) => r.data),
    remove: (id: string) => api.delete<{ ok: true }>(`/admin/blog/${id}`).then((r) => r.data),
  },
  certificates: {
    list: (params: Record<string, string | undefined>) =>
      api.get<CertificateRow[]>(`/admin/certificates${qs(params)}`).then((r) => ({ rows: r.data, meta: r.meta as PageMeta & { counts: { valid: number; revoked: number } } })),
    programs: () => api.get<{ plans: { id: string; title: string }[]; courses: { id: string; title: string }[] }>('/admin/certificates/programs').then((r) => r.data),
    issue: (body: CertificateIssue) => api.post<{ id: string; code: string; recipientName: string }>('/admin/certificates', body).then((r) => r.data),
    rename: (id: string, recipientName: string) => api.patch<{ ok: true; changed: boolean }>(`/admin/certificates/${id}`, { recipientName }).then((r) => r.data),
    revoke: (id: string, reason: string) => api.post<{ ok: true }>(`/admin/certificates/${id}/revoke`, { reason }).then((r) => r.data),
    exportUrl: (params: Record<string, string | undefined>) => `/api/v1/admin/certificates/export.csv${qs(params)}`,
  },
  courses: {
    list: () => api.get<CourseRow[]>('/admin/courses').then((r) => r.data),
    reorder: (ids: string[]) => api.put<{ ok: true }>('/admin/courses/order', { ids }).then((r) => r.data),
    get: (id: string) => api.get<CourseDetail>(`/admin/courses/${id}`).then((r) => r.data),
    create: (body: CourseInput & { slug: string }) => api.post<{ id: string }>('/admin/courses', body).then((r) => r.data),
    update: (id: string, body: Partial<CourseInput>) => api.patch<{ ok: true; changed: string[] }>(`/admin/courses/${id}`, body).then((r) => r.data),
    remove: (id: string) => api.delete<{ ok: true }>(`/admin/courses/${id}`).then((r) => r.data),
    /** Every module and lesson of the course, in the new order. */
    saveOrder: (id: string, modules: { id: string; lessonIds: string[] }[]) => api.put<{ ok: true }>(`/admin/courses/${id}/order`, { modules }).then((r) => r.data),
    addModule: (courseId: string, title: string) => api.post<{ id: string; slug: string }>(`/admin/courses/${courseId}/modules`, { title }).then((r) => r.data),
    renameModule: (id: string, title: string) => api.patch<{ ok: true }>(`/admin/modules/${id}`, { title }).then((r) => r.data),
    removeModule: (id: string) => api.delete<{ ok: true }>(`/admin/modules/${id}`).then((r) => r.data),
    addLesson: (moduleId: string, body: Partial<LessonInput> & { title: string; status: PublishStatus }) =>
      api.post<{ id: string; slug: string }>(`/admin/modules/${moduleId}/lessons`, body).then((r) => r.data),
    updateLesson: (id: string, body: Partial<LessonInput>) => api.patch<{ ok: true; changed: string[] }>(`/admin/lessons/${id}`, body).then((r) => r.data),
    removeLesson: (id: string) => api.delete<{ ok: true }>(`/admin/lessons/${id}`).then((r) => r.data),
  },
  reports: {
    get: (type: ReportType, params: Record<string, string | undefined>) => api.get<ReportData>(`/admin/reports/${type}${qs(params)}`).then((r) => r.data),
    exportUrl: (type: ReportType, params: Record<string, string | undefined>) => `/api/v1/admin/reports/${type}/export.csv${qs(params)}`,
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

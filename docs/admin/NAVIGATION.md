# Alpha Recover — Admin Panel Navigation & Modules

**Last reviewed:** 2026-11-13 · **Status:** Proposal
**Related:** [ARCHITECTURE.md](ARCHITECTURE.md) · [AUTH_AND_RBAC.md](AUTH_AND_RBAC.md) (permission strings) · [UI_UX.md](UI_UX.md) (sidebar behaviour) · [../API.md](../API.md) §10–14

## 1. How the proposed list was finalized against the real project

| Proposed module | Decision | Why |
|---|---|---|
| Dashboard | ✅ Keep | |
| Students | ✅ Keep | `users` table exists; registration arrives in backend Phase 3 |
| Courses & Training | ✅ Keep | `courses` / `course_modules` / `lessons` live (9 / 16 / 117) |
| Training Plans | ✅ Keep as **Plans & Offers** | `plans` + `promotions` live (Festival Sale) |
| Offers & Coupons | 🔀 **Merged into Plans & Offers** (Promotions tab); **Coupons deferred** | Promotions exist; the site has no coupon field, so coupons would be unused |
| Demo Videos | ✅ Keep | `demo_videos` live |
| Learning Materials | ⏸ **Deferred (hidden)** | No table, no site feature; it depends on the "firmware software access" decision (PRD §6) |
| Enrollments | ✅ Keep (P1) | Table arrives in backend Phase 3/5 |
| Payments & Orders | ✅ Keep as **Orders & Payments** (P1) | Tables arrive in backend Phase 5 |
| Leads & Inquiries | ✅ Keep | `leads` live, forms wired |
| Website CMS | 🔀 Split into **Blog** + **Site & Contact** (inside Settings) | Those are the CMS-managed contents that exist; marketing copy stays in `content.ts` (PRD §5) |
| Certificates | ✅ Keep | `certificates` live (verification); issuing in Phase 4 |
| Notifications | ✅ Keep as **Email Log** (P2) | `notification_jobs` outbox exists; no in-app notifications on the site |
| Reports & Analytics | ✅ Keep (P2) | Aggregates over existing tables |
| Admin Users & Permissions | ✅ Keep as **Team & Access** | Staff roles exist |
| Activity Logs | ✅ Keep | `activity_logs` exists |
| Settings | ✅ Keep | `site_settings` live |

## 2. Sidebar

Grouped by job, so each role mostly works within one or two groups. Items are hidden when the user lacks the module's `*.view` permission, and a group with no visible items is hidden too.

```
OVERVIEW
  ▸ Dashboard                       /admin
SALES
  ▸ Leads & Inquiries               /admin/leads
  ▸ Orders & Payments          (P1) /admin/orders
LEARNERS
  ▸ Students                        /admin/students
  ▸ Enrollments                (P1) /admin/enrollments
  ▸ Certificates                    /admin/certificates
CONTENT
  ▸ Courses & Training              /admin/courses
  ▸ Plans & Offers                  /admin/plans
  ▸ Demo Videos                     /admin/demo-videos
  ▸ Blog                            /admin/blog
INSIGHTS
  ▸ Reports                    (P2) /admin/reports
  ▸ Activity Log                    /admin/activity
SYSTEM
  ▸ Team & Access                   /admin/team
  ▸ Email Log                  (P2) /admin/notifications
  ▸ Settings                        /admin/settings
```
Footer of the sidebar: the signed-in user, their role badge, and **View website ↗**.

### Full route table

| Route | Page | Permission to open |
|---|---|---|
| `/admin/login`, `/admin/login/2fa` | Login, TOTP | public / pending 2FA |
| `/admin` | Dashboard | `dashboard.view` |
| `/admin/leads` · `/admin/leads/:id` (drawer) | Leads list · detail | `leads.view` |
| `/admin/orders` · `/admin/orders/:id` | Orders list · detail (payments, webhook events, refund) | `orders.view` |
| `/admin/students` · `/admin/students/:id` | Students · detail (tabs: profile, enrollments, orders, certificates, sessions) | `students.view` |
| `/admin/enrollments` | Enrollments | `enrollments.view` |
| `/admin/certificates` | Certificates | `certificates.view` |
| `/admin/courses` · `/admin/courses/:id` | Tracks · editor (modules, lessons, reorder) | `courses.view` |
| `/admin/plans` · `/admin/plans/:id` · `/admin/plans/:id/promotions` | Plans · editor · promotions | `plans.view` |
| `/admin/demo-videos` | Demo videos (drawer editor) | `demos.view` |
| `/admin/blog` · `/admin/blog/new` · `/admin/blog/:id` | Posts · editor | `blog.view` |
| `/admin/reports` · `/admin/reports/:tab` | Revenue, leads, students, learning, demo videos | `reports.view` |
| `/admin/activity` | Audit log | `audit.view` |
| `/admin/team` · `/admin/team/roles` | Staff users · role matrix (read-only) | `team.view` |
| `/admin/notifications` | Email outbox log | `notifications.view` |
| `/admin/settings` · `/admin/settings/:tab` | General · Site & Contact · Notifications · Policies | `settings.view` |
| `/admin/account` | My profile, 2FA, sessions | any staff |
| `/admin/*` (unknown) | Not found inside the shell | any staff |

### Role-wise sidebar visibility

✅ visible · — hidden (from the matrix in [AUTH_AND_RBAC.md](AUTH_AND_RBAC.md) §3)

| Item | Super Admin | Admin | Content Mgr | Finance Mgr | Support Mgr |
|---|:-:|:-:|:-:|:-:|:-:|
| Dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Leads & Inquiries | ✅ | ✅ | — | — | ✅ |
| Orders & Payments | ✅ | ✅ | — | ✅ | ✅ (view) |
| Students | ✅ | ✅ | — | ✅ (view) | ✅ |
| Enrollments | ✅ | ✅ | — | ✅ | ✅ (view) |
| Certificates | ✅ | ✅ | — | — | ✅ (view) |
| Courses & Training | ✅ | ✅ | ✅ | — | — |
| Plans & Offers | ✅ | ✅ | — | ✅ | — |
| Demo Videos | ✅ | ✅ | ✅ | — | — |
| Blog | ✅ | ✅ | ✅ | — | — |
| Reports | ✅ | ✅ | ✅ (content tabs) | ✅ (revenue tabs) | ✅ (leads tab) |
| Activity Log | ✅ | ✅ | — | — | — |
| Team & Access | ✅ | ✅ (view) | — | — | — |
| Email Log | ✅ | ✅ | — | — | ✅ |
| Settings | ✅ | ✅ (no Policies edit) | — | — | — |

Dashboard widgets are also permission-filtered (e.g. Content Manager sees content health, not revenue).

## 3. Module architecture

Priority: **P0** essential to operate · **P1** business functionality · **P2** advanced.
Backend dependencies refer to [../PLAN.md](../PLAN.md) phases. "Exists" = live today on `Dev`.

| Module | Purpose | Pages / key components | API (`/api/v1/admin/…`) | Tables | Permissions | Depends on | Priority |
|---|---|---|---|---|---|---|---|
| **Admin foundation** | Login, 2FA, shell, guards | AdminLoginPage, TwoFactorPage, AdminLayout, Sidebar, RequireStaff | `/auth/login` (Phase 3), `/admin/me`, 2FA, step-up | users, sessions, two_factors | any staff | Backend Phase 3 | **P0** |
| **Dashboard** | Today's picture: new leads, conversion, content health; revenue once payments exist | DashboardPage, KpiCard, widgets | `GET /dashboard` | leads, users, demo_videos, blog_posts, (orders) | `dashboard.view` (widgets filtered) | Foundation | **P0** |
| **Leads & Inquiries** | Work every enquiry to a close | LeadsPage (DataTable, FilterBar), LeadDrawer (status, assignee, notes timeline) | `GET /leads`, `GET/PATCH /leads/:id`, `POST /leads/:id/notes`, `GET /leads/export.csv` | leads (exists), **lead_notes (new)**, users | `leads.view/edit/export` | Foundation | **P0** |
| **Students** | Find a learner; support their account | StudentsPage, StudentDetailPage (tabs), SuspendDialog | `GET /students`, `GET/PATCH /students/:id`, suspend/unsuspend, revoke sessions, password-reset | users, sessions, (enrollments, orders, certificates) | `students.view/edit/delete` | Foundation; data grows with Phases 3–5 | **P0** |
| **Team & Access** | Invite staff, assign roles, enforce 2FA | TeamPage, InviteDialog, RoleChangeDialog (step-up), RolesPage (matrix) | `GET/POST /team`, `PATCH /team/:id/role`, `POST /team/:id/deactivate` | users, sessions | `team.view/add/edit` (`admins.manage`) | Foundation | **P0** |
| **Activity Log** | Who did what, when | ActivityLogPage (filters), entry drawer (before/after JSON) | `GET /activity` | activity_logs (exists) | `audit.view` | Foundation (every module writes to it) | **P0** |
| **Courses & Training** | Edit tracks, modules, lessons; attach videos; preview flag | CoursesPage, CourseEditorPage (drag-reorder), LessonDrawer, VideoUploader | `/courses`, `/courses/:id`, `/modules/:id`, `/lessons/:id`, `PUT /courses/:id/order`, `POST /videos/upload-url` | courses, course_modules, lessons (exist) | `courses.view/add/edit/delete` | Foundation; uploads need Bunny (Phase 4) | **P1** |
| **Plans & Offers** | Price, features, sale windows (drives the countdown) | PlansPage, PlanEditorPage, PromotionsTab, PromotionDialog (overlap check, IST times) | `/plans`, `/plans/:id`, `/plans/:id/promotions`, `/promotions/:id` | plans, promotions (exist) | `plans.view/add/edit/delete` | Foundation | **P1** |
| **Demo Videos** | Manage the public demo catalog | DemoVideosPage, DemoVideoDrawer, featured toggle, thumbnail upload | `/demo-videos`, `/demo-videos/:id`, `/media/upload-url` | demo_videos (exists) | `demos.view/add/edit/delete` | Foundation; upload needs Bunny | **P1** |
| **Blog** | Write, schedule, publish articles | BlogListPage, BlogEditorPage (MarkdownEditor + preview, SEO, schedule) | `/blog`, `/blog/:id`, publish/unpublish, `/media/upload-url` | blog_posts (exists) | `blog.view/add/edit/delete/publish` | Foundation | **P1** |
| **Certificates** | Look up, issue manually, revoke, regenerate PDF | CertificatesPage, IssueDialog, RevokeDialog (step-up) | `/certificates`, issue, revoke, regenerate-pdf | certificates, certificate_sequences (exist) | `certificates.view/add/edit` | Foundation; PDFs in Phase 4 | **P1** |
| **Enrollments** | Grant/revoke access (manual, complimentary, purchase) | EnrollmentsPage, GrantDialog, RevokeDialog | `/enrollments`, `/enrollments/:id/revoke` | **enrollments (new)** | `enrollments.view/add/edit` | Backend Phase 3/5 | **P1** |
| **Orders & Payments** | See payments, refund, reconcile missed webhooks | OrdersPage, OrderDetailPage, RefundDialog (step-up, limit) | `/orders`, `/orders/:id`, refund, reconcile, export | **orders, payments, payment_webhook_events (new)** | `orders.view/edit/export`, `orders.refund` | Backend Phase 5 | **P1** |
| **Settings** | Site & contact details, social links, lead recipients, policies (session limit, refund-revokes-access, certificate criteria) | SettingsPage (tabs) | `GET /settings`, `PUT /settings/:key` | site_settings (exists) | `settings.view/edit` (Policies: super_admin) | Foundation | **P1** |
| **Reports & Analytics** | Trends: revenue, leads by source/reason, signups, completion, demo views | ReportsPage (tabs, date range, CSV) | `/reports/:type`, `/reports/:type/export.csv` | all (read-only) | `reports.view/export` (tabs filtered by role) | P0/P1 data | **P2** |
| **Email Log** | Debug delivery; retry dead jobs | NotificationsPage | `/notifications`, `/notifications/:id/retry` | notification_jobs (exists) | `notifications.view/edit` | Foundation | **P2** |
| **Global search** | Jump to a lead/student/order/certificate | Command palette (⌘K) | `GET /search` | several | per-result permission | P0/P1 modules | **P2** |
| **Coupons** | Discount codes | — | — | coupons (new) | `plans.*` | A coupon field on checkout | **Deferred** |
| **Learning Materials** | Downloads per lesson | — | — | learning_materials (new) | `courses.*` | Business decision + lesson page | **Deferred** |

## 4. Mobile sidebar behaviour

| Width | Behaviour |
|---|---|
| ≥ 1280px | Expanded sidebar (264px) with labels and group headings |
| 1024–1279px | Collapsed rail (72px), icons only, tooltips on hover/focus; expands on hover or via a pinned toggle |
| < 1024px | Hidden; a top-bar ☰ button opens it as an off-canvas drawer (focus-trapped, Esc / backdrop to close, closes on navigation); the body doesn't scroll behind it |
| < 768px | Same drawer; data tables switch to card lists; drawers become full-screen sheets |

The collapsed/expanded preference is stored per browser. The active item is highlighted, and its group stays expanded.

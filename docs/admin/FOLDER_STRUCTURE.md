# Alpha Recover — Admin Panel Folder Structure

**Last reviewed:** 2026-11-13 · **Status:** Proposal (nothing created or moved)
**Related:** [ARCHITECTURE.md](ARCHITECTURE.md) · [NAVIGATION.md](NAVIGATION.md) · [AUTH_AND_RBAC.md](AUTH_AND_RBAC.md)

Follows the existing conventions in `AGENTS.md`:
- **Components:** named function exports; CSS colocated (`Foo.tsx` + `Foo.css`); a unique class prefix per area (`adm-` for the admin).
- **Shared code:** anything the frontend and API both use lives in `shared/`.
- **Backend routes:** small Hono routers in `server/routes/`.

## 1. Frontend: `src/admin/`

Everything admin lives in one folder, loaded lazily from `src/App.tsx`. Public files are not edited except for the single lazy route.

```
src/admin/
  AdminApp.tsx                 Admin router: login routes + protected shell; wraps QueryClientProvider
  routes.ts                    Single route table: path, title, icon, permission, group, lazy page.
                               Drives the router, the sidebar and breadcrumbs (one source of truth)

  layout/
    AdminLayout.tsx            Shell: sidebar + top bar + <Outlet/>; sets .adm[data-theme]
    AdminLayout.css            Admin design tokens (light + dark) and shell grid; all classes prefixed adm-
    Sidebar.tsx                Groups/items from routes.ts filtered by permission; collapsible; mobile drawer
    Topbar.tsx                 Page title, breadcrumbs, search trigger (P2), theme toggle, user menu
    Breadcrumbs.tsx
    ThemeToggle.tsx            light / dark / system; stored per browser
    UserMenu.tsx               Profile, 2FA, active sessions, log out

  auth/
    AdminLoginPage.tsx         /admin/login (email + password)
    TwoFactorPage.tsx          /admin/login/2fa (TOTP) and first-time enrolment
    RequireStaff.tsx           Route guard: loading → login redirect → "no access" page
    RequirePermission.tsx      Per-route / per-action guard (renders 403 view or hides children)
    useAdminSession.ts         GET /admin/me via React Query; exposes user, role, can(permission)
    StepUpDialog.tsx           Re-confirm password/TOTP before sensitive actions
    NoAccessPage.tsx           403 view (with "switch account" link)

  components/                  Generic admin UI (no business logic), each with colocated .css
    DataTable/
      DataTable.tsx            Columns, sorting, row selection, sticky header; server-driven
      DataTable.css
      ColumnVisibility.tsx
      MobileCardList.tsx       Same rows as cards under 768px
    FilterBar.tsx              Search + select/date filters; syncs with the URL
    Pagination.tsx
    Drawer.tsx                 Right-side panel for view/edit (focus-trapped)
    Modal.tsx
    ConfirmDialog.tsx          Destructive actions; typed confirmation for delete/refund
    Form/
      FormField.tsx            Label, input, hint, error; aria-describedby wiring
      TextInput.tsx, Select.tsx, Textarea.tsx, Checkbox.tsx, DateTimeInput.tsx, MoneyInput.tsx (paise ↔ ₹)
      MarkdownEditor.tsx       Textarea + live preview using src/components/ui/Markdown
      useZodForm.ts            Small hook: values, errors from a shared Zod schema, server error mapping
    KpiCard.tsx
    StatusBadge.tsx            Lead/order/enrollment/certificate status colours
    EmptyState.tsx
    ErrorState.tsx             Includes requestId for support
    Skeleton.tsx
    Toaster.tsx                Success/error toasts (aria-live)
    Tabs.tsx
    PageHeader.tsx             Title, description, primary action button (permission-aware)

  modules/                     One folder per sidebar module (see NAVIGATION.md)
    dashboard/
      DashboardPage.tsx
      widgets/                 LeadsWidget, RevenueWidget, ContentHealthWidget…
      api.ts                   React Query hooks: useDashboard()
    leads/
      LeadsPage.tsx            List: filters (status, reason, source, date), export
      LeadDrawer.tsx           Detail, status change, assignment, notes timeline
      api.ts                   useLeads(filters), useLead(id), useUpdateLead(), useAddNote()
      columns.tsx
    students/                  StudentsPage, StudentDetailPage (tabs: profile, enrollments, orders, certificates, sessions)
    enrollments/               EnrollmentsPage, GrantEnrollmentDialog, RevokeDialog
    orders/                    OrdersPage, OrderDetailPage (payments, webhook events), RefundDialog
    courses/                   CoursesPage, CourseEditorPage (modules + lessons, drag reorder), LessonDrawer
    plans/                     PlansPage, PlanEditorPage, PromotionsTab, PromotionDialog
    demo-videos/               DemoVideosPage, DemoVideoDrawer (upload, featured toggle)
    blog/                      BlogListPage, BlogEditorPage (MarkdownEditor, SEO, schedule)
    certificates/              CertificatesPage, IssueCertificateDialog, RevokeDialog
    notifications/             NotificationsPage (outbox log, retry)
    reports/                   ReportsPage (tabs: revenue, leads, students, learning, demo videos)
    team/                      TeamPage (staff users, invite, role), RolesPage (read-only matrix)
    activity/                  ActivityLogPage (filters: actor, action, entity, date)
    settings/                  SettingsPage (tabs: general, site & contact, notifications, policies)

  lib/
    queryClient.ts             React Query defaults (staleTime, retry: no retry on 4xx)
    adminApi.ts                Thin wrapper over src/lib/api.ts: 401 → login, 403 → no-access event
    format.ts                  ₹ from paise, dates in IST, relative time, file sizes
    csv.ts                     Trigger CSV downloads from /export.csv endpoints

  hooks/
    useTableState.ts           page / pageSize / sort / filters ⇄ URL search params
    useDebouncedValue.ts
    useMediaQuery.ts
    useUnsavedChangesPrompt.ts

  types.ts                     Admin-only UI types (API DTO types come from shared/)
```

**Per-module convention:** `XxxPage.tsx` (route component), `api.ts` (React Query hooks for that module's endpoints), `columns.tsx` (table columns), dialogs/drawers as needed, and colocated `.css` only when generic components aren't enough.

## 2. Shared: `shared/` (frontend + API)

```
shared/
  leads.ts                     (exists) lead reasons/sources
  permissions.ts               MOVED from server/auth/permissions.ts: roles, permission strings, matrix, can()
  schemas/
    admin/
      leads.ts                 updateLead, addLeadNote, leadFilters
      students.ts
      courses.ts               course/module/lesson create/update, reorder
      plans.ts                 plan update, promotion create (with overlap rule message)
      demoVideos.ts
      blog.ts
      certificates.ts
      enrollments.ts
      orders.ts                refund
      team.ts                  invite, role change
      settings.ts              per-key value schemas (moved from server/settings.ts)
    pagination.ts              page, pageSize, sort, q
  types/
    admin.ts                   DTOs returned by /admin/* (shared by API handlers and UI)
```

`server/auth/permissions.ts` and `server/settings.ts` would re-export from `shared/`, so existing imports keep working.

## 3. Backend: `server/`

```
server/
  routes/
    admin/
      index.ts                 Mounts every admin router under /admin; applies requireStaff baseline
      me.ts                    GET /admin/me
      dashboard.ts
      leads.ts                 list, detail, update, notes, export
      students.ts
      enrollments.ts
      orders.ts                list, detail, refund, reconcile
      courses.ts               courses, modules, lessons, reorder, video upload URL
      plans.ts                 plans, promotions (overlap check)
      demoVideos.ts
      blog.ts
      certificates.ts          issue, revoke, regenerate PDF
      notifications.ts         outbox list, retry
      reports.ts
      team.ts                  staff users, invite, role change
      activity.ts
      settings.ts
  services/                    Business logic reused by public + admin routes
    pricing.ts                 (exists)
    certificates.ts            (exists; gains issueCertificate())
    leads.ts                   status transitions + note on status change
    enrollments.ts             grant/revoke/access check
    orders.ts                  activateOrder(), refund()
    exports.ts                 streamed CSV helper
  auth/
    middleware.ts              (exists) + requireStepUp()
    permissions.ts             re-export from shared/permissions.ts
  admin.test.ts                RBAC matrix test: every admin route × every role
```

## 4. Styles and assets

- `src/admin/layout/AdminLayout.css` defines **admin tokens** under `.adm[data-theme="dark"]` and `.adm[data-theme="light"]`, derived from the brand palette in `src/styles/global.css` (pine, ivory, brass, mint).
- No admin rules go into `global.css`. The public site's appearance cannot change.
- Icons reuse `src/lib/icons.ts` and `public/icons/` (new admin glyphs are added as SVG files in the same `set__name__variant` pattern).
- Class prefix: `adm-` (e.g. `adm-sidebar`, `adm-table`, `adm-kpi`).

## 5. Tests

| Location | What |
|---|---|
| `server/admin.test.ts` + `server/<module>.admin.test.ts` | API: permission matrix, validation, audit-log writes, CSV exports |
| `src/admin/**/*.test.tsx` | Unit tests for table state, form validation mapping and permission-aware rendering (`react-dom/server`, as with `Markdown.test.tsx`) |
| Playwright (TESTING.md) | Login + 2FA, one happy path per P0 module, mobile sidebar, theme toggle |

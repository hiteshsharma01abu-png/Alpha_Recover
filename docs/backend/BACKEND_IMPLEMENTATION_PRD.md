# Alpha Recover — Backend Implementation PRD

**Status:** Draft for approval · **Date:** 2026-11-12
**Related:** `BACKEND_PROJECT_AUDIT.md`, `BACKEND_DATABASE_SCHEMA.md`, `BACKEND_API_SPECIFICATION.md`, `BACKEND_IMPLEMENTATION_PLAN.md`, `BACKEND_SECURITY_AND_PERMISSIONS.md`, `BACKEND_QA_AND_TESTING_PLAN.md`

---

## 1. Product summary

Alpha Recover sells **online data recovery training** (one-time purchase, lifetime access) and generates **leads for data recovery services, technical support and software/hardware sales**. It's based in Ahmedabad, India, priced in INR, and serves international learners too: the register form offers India, US, UK and UAE, and the marketing copy mentions 4 languages.

### Business flows inferred from the UI

1. **Browse → Buy → Learn.** A visitor browses tracks and demo videos, buys the **Professional Plan**, logs in, watches the 117 lessons across 9 tracks, tracks progress, and earns a certificate.
2. **Inquire.** A visitor submits the contact form (reason: support, sale, recovery service, training, other) or a callback request. The team follows up by phone, email or WhatsApp.
3. **Verify.** A third party (employer, client) verifies a trainee's certificate ID publicly.
4. **Read.** A visitor reads blog articles.
5. **Operate (new).** Staff manage leads, students, enrollments, content, pricing/promotions, certificates and orders.

### Goals
- Make every existing frontend interaction functional without redesigning the UI.
- Take payments safely and activate access automatically.
- Protect paid video content.
- Give staff an admin backend for day-to-day operations.

### Non-goals (for this backend scope)
- Redesigning existing pages.
- Multi-tenant or institute (B2B seat) licensing: the UI says "no seat limits" for individuals. It could be added later.
- Live classes, forums, quizzes: none appear in the UI.
- A full marketing CMS for every homepage string. Static marketing copy stays in `content.ts` unless requested (see §5).

---

## 2. Frontend → backend mapping

| Frontend page / feature | Current UI status | Backend required | API required | Database required |
|---|---|---|---|---|
| Home — hero, stats, why-learn, industries | Implemented, static copy | None initially (keep static) | No | No |
| Home — Solutions stack / quick actions | Implemented, static | Course slugs must exist | Optional (`GET /courses`) | `courses` |
| Home / Training — Training Explorer (tracks → modules → lessons) | Implemented, static | Course catalog | `GET /courses`, `GET /courses/:slug` | `courses`, `course_modules`, `lessons` |
| Header Training dropdown | Implemented, static | Course list | `GET /courses` | `courses` |
| Header / drawer "Account" CTA | Implemented, static link | Show login state | `GET /auth/session` | `sessions` |
| `/training/:trackId` lesson list | Implemented, lesson click → alert | Access control, playback token, progress | `GET /courses/:slug`, `POST /lessons/:id/playback`, `PUT /me/progress/:lessonId` | `lessons`, `enrollments`, `lesson_progress` |
| Lesson player page | **Not built** (frontend work) | Video delivery | `POST /lessons/:id/playback` | `lessons` |
| Student dashboard / My courses | **Not built** (frontend work) | Enrolled courses + progress | `GET /me/dashboard` | `enrollments`, `lesson_progress` |
| Professional Plan section (Home, `/pricing`) | Implemented, static price | Plan + active promotion, server-side price | `GET /plans`, `GET /plans/:slug` | `plans`, `promotions` |
| Sale countdown | Implemented, **fake timer** | Real promotion end time | `GET /plans/:slug` (`promotion.endsAt`) | `promotions` |
| Buy Now (`/pricing`) | Implemented, alert | Order creation, Razorpay checkout, verification | `POST /checkout/orders`, `POST /checkout/verify` | `orders`, `payments` |
| Payment confirmation | **Not built** (success/failure pages) | Webhook processing, enrollment activation | `POST /webhooks/razorpay`, `GET /me/orders/:id` | `payments`, `payment_webhook_events`, `enrollments` |
| Ask on WhatsApp / floating WhatsApp | Implemented (`wa.me`) | None (optional click tracking) | No | No |
| Demo videos — home preview + `/demos` (filter, search, pagination, featured) | Implemented over 6 static items | Catalog, server-side filter/search/paging, playback, views | `GET /demo-videos`, `GET /demo-videos/:slug`, `POST /demo-videos/:id/view` | `demo_videos` |
| Contact form | Implemented, discards data | Lead capture, consent, notifications | `POST /leads` | `leads`, `notification_jobs` |
| Request callback (CTA) | Implemented, alert | Lead capture | `POST /leads` (source `callback`) | `leads` |
| Services "Request service" | Link to `/contact` | Covered by contact lead (`reason=data_recovery_service`) | `POST /leads` | `leads` |
| Login | Implemented, stub | Authentication, session cookie | `POST /auth/login`, `POST /auth/logout` | `users`, `sessions` |
| Register | Implemented, stub | Account creation, email verification | `POST /auth/register`, `POST /auth/verify-email` | `users`, `verification_tokens` |
| Lost your password | Button only | Reset email + token | `POST /auth/password/forgot`, `POST /auth/password/reset` | `verification_tokens` |
| Remember me | Unbound checkbox | Session lifetime choice | `POST /auth/login` (`remember`) | `sessions` |
| Verify certificate | Implemented, stub | Public lookup | `GET /certificates/verify/:code` | `certificates` |
| Certificate download (student) | **Not built** | PDF generation + signed download | `GET /me/certificates`, `GET /me/certificates/:id/download` | `certificates` |
| Blog list / post | Implemented, excerpt only | Blog CMS with article body | `GET /blog`, `GET /blog/:slug` | `blog_posts` |
| Footer contact details, social links | Implemented, static/placeholder | Site settings | `GET /settings/public` | `site_settings` |
| Legal pages (privacy, terms, refunds) | **Not built** | Optional CMS page | `GET /pages/:slug` (optional) | `site_settings` or static |
| Admin panel (all modules) | **Not built** | Full admin backend | `/admin/*` | All tables |

---

## 3. Functional requirements

### 3.1 Authentication & accounts
- FR-A1: Register with first name, email, country, optional phone, password, terms acceptance (timestamp stored).
- FR-A2: Email verification link (24h). Unverified users can log in but can't buy until verified (recommended; configurable).
- FR-A3: Login with email + password. "Remember me" gives a 30-day session; otherwise 12 hours.
- FR-A4: Logout (current session) and "log out all devices".
- FR-A5: Password reset by email link (1h, single use).
- FR-A6: Maximum **2 concurrent student sessions**. A new login evicts the oldest. This limits sharing of a lifetime-access product.
- FR-A7: Profile: view and update name, phone, country; change password.

### 3.2 Catalog
- FR-C1: Public course list and detail (tracks → modules → lessons) with titles, durations, preview flags. Paid content (video IDs, materials) is never exposed publicly.
- FR-C2: Lessons can be marked `is_preview` so they're playable without purchase.

### 3.3 Learning
- FR-L1: Only users with an **active enrollment** granting a course can get a playback token for its non-preview lessons.
- FR-L2: Playback tokens are short-lived (≤ 2h) signed URLs from the video host.
- FR-L3: Progress per lesson (seconds watched, completed). Course completion % is derived.
- FR-L4: Student dashboard: enrolled courses, progress, "continue where you left off", certificates.

### 3.4 Plans, promotions, checkout
- FR-P1: One active plan today ("Professional Plan"). The model supports more.
- FR-P2: A promotion (e.g. "Festival Sale") overrides the price between `starts_at` and `ends_at`. The countdown reads `ends_at`.
- FR-P3: **Price is always computed on the server.**
- FR-P4: Checkout creates an internal order and a Razorpay order. The client opens Razorpay Checkout, then the server verifies the signature. A webhook (`payment.captured`, `order.paid`) is the source of truth.
- FR-P5: Enrollment is activated **only** after verified capture, and idempotently (webhook and client verify can both arrive).
- FR-P6: Receipt email on success. A GST invoice is generated once GSTIN is registered (company GST is "Pending").
- FR-P7: Admin-initiated full or partial refund through Razorpay. A refund revokes the enrollment (configurable).
- FR-P8: Coupons are **deferred**. The UI has no coupon field, so the schema reserves the extension point only.

### 3.5 Leads
- FR-LD1: Contact form and callback submissions create leads with source, reason, consent, page URL, UTM parameters.
- FR-LD2: Notify the team by email (and optionally WhatsApp) on new lead. Send an acknowledgement email to the submitter.
- FR-LD3: Lead pipeline: `new → contacted → qualified → converted / closed / spam`, with assignee and notes.
- FR-LD4: Spam protection: captcha (Cloudflare Turnstile), honeypot, rate limit.

### 3.6 Demo videos
- FR-D1: Public catalog with category filter, text search, pagination, featured video, counts per category.
- FR-D2: Public playback (demo videos are free previews). View count increments are rate limited per IP.

### 3.7 Certificates
- FR-CT1: Certificate code format `AR-YYYY-NNNNN`, unique and sequential per year.
- FR-CT2: Issued automatically when completion criteria are met, or manually by an admin. **Criteria need business confirmation**: proposed 100% of lessons completed in the plan's courses.
- FR-CT3: Public verify returns status, recipient name, program, issue date. No email or phone.
- FR-CT4: PDF certificate with a QR code linking to `/verify-certificate?code=…`.
- FR-CT5: Admin can revoke, with a reason. Verify then shows "revoked".

### 3.8 Blog
- FR-B1: Posts with slug, title, excerpt, Markdown body, cover, publish date, SEO fields, draft/published status.

### 3.9 Settings
- FR-S1: Public settings: company contact, hours, WhatsApp number, social links, address.
- FR-S2: Admin-editable operational settings: notification recipients, session limit, certificate criteria, refund-revokes-access flag.

### 3.10 Admin panel backend
See §6 of `BACKEND_IMPLEMENTATION_PLAN.md` and the `/admin` API group. Modules: dashboard, students, courses, plans and promotions, demo videos, enrollments, orders and payments, leads, blog, certificates, notifications log, admin users and roles, reports, activity logs, settings.

---

## 4. Recommended backend architecture

**Principles:**
1. **Host-portable.** Hosting isn't decided (Vercel is temporary; cPanel shared hosting is a likely target; a VPS is possible). The backend is a plain Node.js app that runs unchanged on cPanel (Node.js App / Passenger), a VPS (PM2 + Nginx) or Vercel (adapter, during development only).
2. **Stay on the existing stack** (TypeScript, one repo) and add the fewest services. Anything a shared host can't do well (video streaming, email delivery, payments) goes to a specialist service that works with any host.

| Concern | Recommendation | Why | Alternatives considered |
|---|---|---|---|
| Runtime | **Node.js 20+**, one long-running app process | Supported by cPanel "Setup Node.js App", every VPS, and Vercel (via adapter) | PHP/Laravel: only if the chosen host can't run Node (see §4.1) |
| API framework | **Hono** with `@hono/node-server` | Tiny, Web-standard; the same app code runs on Node servers and Vercel | Express (heavier, not Web-standard) |
| Language / validation | **TypeScript + Zod**, schemas in `shared/` used by both frontend and API | One source of truth for request shapes; frontend forms reuse them | — |
| Database | **MySQL 8.0+ / MariaDB 10.6+** (InnoDB, utf8mb4) | Available on every cPanel host and VPS; transactions and constraints for orders and enrollments; included in hosting cost and backups | PostgreSQL (better features, but rarely offered on shared hosting); MongoDB (weaker fit for money and enrollment integrity) |
| ORM / migrations | **Drizzle ORM** (`mysql2` driver) + drizzle-kit migrations | Lightweight, SQL-first, typed; works with MySQL and MariaDB | Prisma (heavier engine binary, awkward on shared hosting) |
| Authentication | **Better Auth** (open-source library) on our own MySQL: email/password, email verification, password reset, DB sessions in httpOnly cookies | Avoids hand-rolling security-critical code; data stays in our DB; supports session limits, admin roles, 2FA | Hand-rolled auth (more risk), Clerk/Auth0 (per-user cost, data outside our DB) |
| Authorization | Role-based: `student` + admin roles (`super_admin`, `admin`, `content_manager`, `support`), permission map in code | Small staff, fixed role set | DB-driven permission tables (more than needed) |
| Payments | **Razorpay** (Orders API + Checkout + webhooks) | INR, UPI, cards, netbanking; international cards; host-independent | Stripe (add later for USD) |
| Video hosting | **Bunny Stream** (signed token URLs, India PoPs, optional DRM) | Shared hosting can't stream video (bandwidth limits, terms of service); token-protected playback for paid lessons | Cloudflare Stream, Mux (pricier), Vimeo (weaker access control), YouTube unlisted (no protection; acceptable **only** for public demo videos) |
| File storage | **Bunny Storage** with token-signed CDN URLs, for certificate PDFs, thumbnails, materials, software downloads | Keeps large files off the web host; one media vendor | Cloudflare R2; local disk (not recommended on shared hosting) |
| Email | **Postmark** (transactional, via HTTPS API) | Mail sent from shared hosting often lands in spam; you appear to already use Postmark | Resend, Amazon SES; host SMTP (poor deliverability) |
| WhatsApp | Phase 1: keep `wa.me` links. Later: **WhatsApp Business Cloud API** via a BSP (Interakt, AiSensy, Gupshup) for template messages to opted-in users | Needs Meta business verification; consent is captured from Phase 2 | — |
| Scheduled jobs | **Cron** (cPanel Cron Jobs, or crontab on a VPS) calling protected internal endpoints with `curl` every minute; emails also attempted immediately | Works on every host; Passenger may idle-stop the Node process, so no in-process timers | Vercel Cron (only while on Vercel) |
| Async jobs | **DB outbox** (`notification_jobs`) drained by cron | No queue server needed; retries survive restarts | Redis/BullMQ on a VPS if volume grows |
| Rate limiting | **MySQL-backed counters** (`rate_limit_buckets`) behind a `rateLimit()` interface | No extra service; works across Passenger processes | Redis (swap in later on a VPS) |
| Bot protection | **Cloudflare Turnstile** on register, contact, callback, forgot password | Free, host-independent | reCAPTCHA |
| Errors / monitoring | **Sentry** (frontend + API); JSON logs to stdout (captured in the cPanel app log, or by PM2/journald on a VPS); uptime monitor on `/api/v1/health` | Low setup, host-independent | — |
| Audit trail | `activity_logs` table for every admin mutation and security event | Accountability for refunds, enrollments, revocations | — |
| Backups | Host daily backups (cPanel/VPS snapshots) **plus** our own nightly `mysqldump` (cron) uploaded to Bunny Storage, 30-day retention | Don't rely on the host alone | Managed DB with point-in-time restore (on a VPS/cloud) |
| PDF generation | `pdf-lib` + `qrcode` in-process | Pure JS; no headless browser (not possible on shared hosting) | Puppeteer (too heavy) |
| Frontend hosting | Static `dist/` served by the host's web server (Apache/LiteSpeed via `.htaccess` on cPanel, Nginx on VPS), with SPA fallback, cache and security headers | Same build output on every host | — |
| Deployment | GitHub Actions: lint → typecheck → test → build SPA + bundle API (esbuild) → upload over **SSH/rsync** (FTP fallback) → run migrations → restart app | Repeatable, no manual uploads | cPanel Git Version Control (manual pull) |

### 4.1 Hosting requirements checklist (use this when choosing a host)

| Requirement | Why | Shared cPanel | VPS |
|---|---|---|---|
| **Node.js app support, Node 20+** ("Setup Node.js App" in cPanel) | Runs the API. **Without it, this plan doesn't work on that host** | Varies by plan, **verify** | ✓ |
| MySQL 8.0+ or MariaDB 10.6+ | JSON columns, generated columns, window functions | Usually ✓ (check version) | ✓ |
| SSH access | Automated deploys and migrations | Some plans | ✓ |
| Cron jobs at a **1-minute** interval | Email queue, order expiry | Some hosts allow only 5–15 min (email then waits longer) | ✓ |
| Free SSL (AutoSSL / Let's Encrypt) | HTTPS is mandatory for login and payments | ✓ | ✓ |
| Outbound HTTPS allowed | Razorpay, Bunny, Postmark, Sentry, Turnstile APIs | Usually ✓ | ✓ |
| ≥ 1 GB RAM for the Node app, ≥ 2 processes | Stable API under sale traffic | Plan-dependent | ✓ |
| `.htaccess` (Apache/LiteSpeed) | SPA routing and headers | ✓ | n/a (Nginx config) |
| Daily backups | Disaster recovery | Usually ✓ | Snapshot add-on |
| India/Asia data centre | Latency for Indian users | Choose at signup | Choose at signup |

**Recommendation:** for a site that takes payments, a small **VPS (≈ ₹500–1,000/month)** is more reliable than shared hosting and has no limits on processes or cron. If shared cPanel is preferred, pick a plan that ticks every row above. **Development and staging don't need the final host:** the API runs locally with Docker MySQL and can be previewed on Vercel with a small managed MySQL until the host is chosen.

### Repository layout (proposed, additive only)
```
server/
  index.ts                 Node entry (@hono/node-server); used by cPanel Passenger / PM2
  app.ts                   Hono app, middleware (request id, logging, errors, auth, rate limit)
  routes/                  auth, public, me, checkout, webhooks, internal (cron), admin/*
  services/                pricing, enrollment, certificates, leads, notifications, video
  db/schema.ts, db/index.ts, db/migrations/
  lib/                     razorpay, bunny, postmark, turnstile, ratelimit, logger, errors
api/[[...route]].ts        Vercel adapter (development/preview only)
shared/schemas/            Zod schemas shared with the frontend
deploy/                    .htaccess template, Passenger/PM2 config, Nginx example, cron list
src/lib/api.ts             (frontend, later) typed fetch client
```

### Request flow
```
Browser ── https://alpharecover.com ──> Web server (Apache/LiteSpeed or Nginx)
  ├─ /, /training, /pricing …   → static dist/ (SPA fallback to index.html)
  └─ /api/v1/*                  → Node app (Hono)   [cPanel: Node.js App mounted at /api; VPS: Nginx proxy]
        ├─ middleware: requestId → logger → rateLimit → session → RBAC → zod validate
        ├─ services → Drizzle → MySQL
        ├─ Razorpay (orders, refunds)   ← webhooks → /api/v1/webhooks/razorpay
        ├─ Bunny (signed video/file URLs)
        └─ notification_jobs outbox ← cron (curl every minute) → Postmark / WhatsApp BSP
```
SPA and API share one domain, so session cookies are first-party and no CORS is needed.

### Common response envelope
```json
// success
{ "data": { ... }, "meta": { "page": 1, "pageSize": 12, "total": 40 } }
// error
{ "error": { "code": "VALIDATION_ERROR", "message": "Email is invalid", "details": [{ "path": "email", "message": "Invalid email" }], "requestId": "req_01H…" } }
```

---

## 5. Content strategy (what becomes dynamic)

| Content | Decision | Reason |
|---|---|---|
| Courses, modules, lessons | **DB** | Needed for access control, video IDs, progress |
| Plans, promotions | **DB** | Money; admin must change sale price and countdown without a deploy |
| Demo videos | **DB** | Uploads, view counts, filters |
| Blog posts | **DB** | Article bodies; staff publish without a deploy |
| Company contact, social links, hours | **DB** (`site_settings`) | Fixes placeholder social links; editable |
| Certificates | **DB** | Core feature |
| Hero copy, stats, why-learn, industries, services list, featured solutions | **Static** (`content.ts`) for now | Rarely changes; a CMS for it is unnecessary scope. Can move to `site_settings` JSON later |

---

## 6. Open business decisions (needed before or during implementation)

1. **Certificate criteria:** 100% lesson completion? A quiz? Manual approval?
2. **Refund policy:** window (e.g. 7 days), partial refunds, and whether a refund revokes access (default: yes).
3. **Verification before purchase:** require a verified email to buy? (Recommended: yes.)
4. **Firmware software access** (a sold feature): download link, licence key, or delivered over WhatsApp?
5. **Callback form:** collect a phone number instead of (or in addition to) email?
6. **Session limit:** 2 concurrent devices acceptable?
7. **International pricing:** INR only via Razorpay, or add USD via Stripe?
8. **GST invoices:** timing (GSTIN "Pending").
9. **Demo video hosting:** Bunny (consistent) or YouTube unlisted (free, discoverable on your YouTube channel)?
10. **Languages:** marketing mentions 4 languages. Are lessons multilingual (per-language video variants)? This affects the lesson model.
11. **Production hosting:** a VPS (recommended) or a shared cPanel plan that meets every row of §4.1. Needed before launch (Phase 7); development doesn't depend on it.

# Alpha Recover — Implementation Plan

**Last reviewed:** 2026-11-13 · **Status:** For approval. Nothing is implemented yet.
**Sizing:** S ≈ 1–2 dev-days, M ≈ 3–5, L ≈ 6–10, for one full-stack developer. Ranges assume decisions in [PRD.md](PRD.md) §6 are answered promptly.

---

## 1. Guiding constraints

- **Additive only.** The backend lives in new `api/`, `server/`, `shared/` folders. Existing routes, pages and components keep working at every step. Each frontend form is switched from its stub to the API one at a time.
- **Ship value early.** Lead capture (money on the table today) and checkout come before the admin polish.
- **Frontend work is a dependency.** Several backend features need new UI that doesn't exist: lesson player, student dashboard, checkout result pages, reset-password page, admin panel. These are listed per phase as **[FE]** items so the plan is honest about end-to-end delivery.
- **Every phase ends deployable.** Each phase finishes on a staging environment, then production behind feature flags.
- **Host-portable.** Production hosting is undecided (shared cPanel or VPS). The API is a plain Node.js app on MySQL that runs on either, and on Vercel during development. See [ARCHITECTURE.md](ARCHITECTURE.md) §3 for the host checklist.

## 2. Dependency map

```
Phase 0 Decisions & accounts ─┐
Phase 1 Foundation ───────────┼─> Phase 2 Public (leads, catalog, plans, demos, blog, certs verify)
                              ├─> Phase 3 Auth & student ──> Phase 4 Learning (video, progress, certs issue)
                              │                         └──> Phase 5 Payments (needs plans from P2, auth from P3)
                              └─> Phase 6 Admin backend (incremental; each module after its domain phase)
Phase 7 QA & security hardening (continuous, gate before production launch)
```

## 3. Phases

### Phase 0 — Decisions & third-party setup (non-code, start now) · S
| Task | Owner |
|---|---|
| Answer [PRD.md](PRD.md) §6 open decisions (certificate criteria, refund policy, callback phone, session limit, international pricing, firmware software delivery, languages) | Business |
| Create accounts: Razorpay (KYC takes days, so **start first**), Bunny (Stream + Storage), Postmark (verify `alpharecover.com` domain: SPF, DKIM, Return-Path), Cloudflare Turnstile, Sentry. A small managed MySQL for staging until the production host is chosen | Business + dev |
| Publish legal pages (Privacy, Terms, Refund/Cancellation, Contact). **Razorpay activation requires them.** [FE + content] | Business |
| Provide real promotion dates, a final course list, and recorded lesson videos (or a schedule) | Business |

**Exit:** decisions recorded in the PRD; API keys stored as environment secrets (GitHub Actions + staging host). **Hosting choice can wait until Phase 7**, but sooner is better so staging matches production.

### Phase 1 — Backend foundation · M · **Done: verified locally and in CI, on `Dev` (2026-11-12)**
| Task | Detail |
|---|---|
| Project scaffold | `server/index.ts` (Node entry, `@hono/node-server`) → Hono app; `server/` structure; esbuild bundle; Vercel adapter `api/[[...route]].ts` for development previews; `deploy/` templates: `.htaccess` (SPA fallback + `/api` exclusion + headers), Passenger/PM2 config, Nginx example, cron list |
| Database | MySQL connection pool (`mysql2`, UTC time zone), Drizzle config, local Docker MySQL, first migration: `users`, `accounts`, `sessions`, `verifications`, `site_settings`, `activity_logs`, `notification_jobs` |
| Env config | Zod-validated `env.ts` (fail fast at boot); `.env.example` documented |
| Common layers | Response envelope, typed `AppError` → error middleware, `requestId`, structured JSON logger, Sentry, Zod validation middleware, rate-limit middleware (MySQL `rate_limit_buckets`), CORS locked to same origin, security headers |
| Auth foundation | Better Auth wired to Drizzle; cookie config; role field; `requireUser` / `requireStaff(permission)` middleware; permission map |
| Notifications outbox | `enqueue()` + `/internal/cron/notifications` + Postmark client + base email templates |
| Tooling | Vitest, Supertest-style request tests against Hono, MySQL service container in CI, GitHub Actions: lint → typecheck → test → build → deploy to staging over SSH → migrate |
| Frontend client | `src/lib/api.ts` typed fetch wrapper (no UI change yet) |

**Exit:** `GET /api/v1/health` live on preview; CI green; migrations reproducible.

**Status**
- [x] Scaffold (`server/`), esbuild bundle, `deploy/` templates. Vercel adapter deliberately deferred (see ARCHITECTURE.md §4)
- [x] MySQL pool + Drizzle + first migration (8 tables incl. `rate_limit_buckets`); Docker MySQL
- [x] Zod env validation, `.env.example`
- [x] Envelope, `AppError`, request id, JSON logs, Sentry (optional), Zod validation, MySQL rate limiter, CSRF guard, security headers
- [x] Better Auth (scrypt, DB sessions, `ar.` cookies, UUIDv7 ids), `requireUser` / `requireStaff`, permission matrix
- [x] Email outbox + cron endpoints + Postmark/dev mailer + verify/reset templates
- [x] Vitest (unit + MySQL integration), GitHub Actions CI on MySQL 8.4 + MariaDB 10.6
- [x] `src/lib/api.ts`
- [x] All 28 tests pass locally on MySQL 8.4 (Docker); production bundle verified end to end (migrate → health → cron)
- [x] CI green on GitHub: 28/28 tests on MySQL 8.4 and MariaDB 10.6 (run 43248868357, `Dev` @ 2be5bf6)
- [ ] Staging deploy (needs a host or managed MySQL; deploy-over-SSH job added when the host is chosen)

### Phase 2 — Public website backend · M–L · **Done (2026-11-13), on `Dev`**
| Task | API | [FE] work |
|---|---|---|
| Leads | `POST /leads` + Turnstile + honeypot + `lead_alert` / `lead_ack` emails | Wire Contact form and callback CTA; add a `name` to the consent checkbox; phone field on the callback form (required) |
| Catalog schema + seed | `courses`, `course_modules`, `lessons` migration; seed from `content.ts` | — |
| Catalog APIs | `GET /courses`, `GET /courses/:slug` | Training explorer, track pages, header dropdown read from the API (static fallback kept) |
| Plans & promotions | `plans`, `plan_courses`, `promotions`; `GET /plans/:slug` with server price | Professional Plan section reads price/label; countdown uses `promotion.endsAt` |
| Demo videos | `demo_videos` + seed; list/featured/detail/view APIs; re-host thumbnails | Demos page uses server filter/search/pagination; play opens an embed |
| Blog | `blog_posts` + seed; `GET /blog`, `GET /blog/:slug` | BlogPost renders Markdown |
| Certificates verify | `certificates`, `certificate_sequences`; `GET /certificates/verify/:code` | Verify page shows the result |
| Public settings | `GET /settings/public` | Footer/contact read settings; fix social links |

**Exit:** all public forms functional in production; leads arrive in the inbox.

**Status**
- [x] Leads: `leads` table, `POST /leads` (validation, phone normalization, honeypot, Turnstile, 5/hour rate limit), `lead_alert` + `lead_ack` emails via the outbox, recipients from `site_settings.lead_notification_emails` (seeded `info@alpharecover.com`). Contact form + callback form (now with required phone) wired; verified in a real browser
- [x] Catalog: `courses` / `course_modules` / `lessons` (9 / 16 / 117, insert-only seed), `GET /courses[?include=outline]`, `GET /courses/:slug` (video ids never exposed). Header menus, Training explorer and track pages read the API with the static catalog as fallback; verified in the browser with and without the API
- [x] Plans & promotions: `plans` / `plan_courses` / `promotions`, server-side pricing (`server/services/pricing.ts`), `GET /plans[/:slug]`. Professional Plan ₹5,999 with the Festival Sale at ₹2,500 until 30 Nov 2026 11:59 PM IST. Real countdown; at zero the sale hides and the price becomes ₹5,999 without a reload. Static fallback applies the same window. Browser-verified (live, expiry, fallback)
- [x] Demo videos: `demo_videos` (one featured video enforced by the DB), insert-only seed of the 6 videos, `GET /demo-videos` (category, search, pagination, counts), `/featured`, `/:slug`, `POST /:slug/view` (1 per IP per 30 min). Demos page and Home preview read the API with static fallback; real view counts and upload dates. Browser-verified with and without the API
- [x] Blog: `blog_posts` (insert-only seed of the 3 posts; bodies = excerpts until written), `GET /blog` (scheduling via `publishedAt`), `GET /blog/:slug`. Blog pages read the API with static fallback; safe Markdown renderer (no raw HTML, safe links) with article styles; post page sets title/meta description. Developer placeholder text removed. Browser-verified with and without the API
- [x] Certificate verification: `certificates` + `certificate_sequences` (gap-free per-year codes, tested with 20 concurrent issues; column renamed to `last_number` since `last_value` is reserved in MySQL 8), `GET /certificates/verify/:code` (30/min, same 404 for unknown/malformed, no private data). Verify page shows valid/revoked/not found, supports `?code=` links, and says "temporarily unavailable" without the API. Browser-verified
- [x] Public settings: `company` + `social_links` in `site_settings` (insert-only seed), `GET /settings/public`; Footer, Contact page, callback section, pricing and floating WhatsApp buttons read it with static fallback; an empty social list hides the icons. Browser-verified

**Open items (need the owner)**
- Real social profile URLs (YouTube, LinkedIn, Facebook, Instagram), or which to hide. Placeholders for now; owner asked to be reminded later
- Blog article text (the 3 posts only have one-line excerpts)
- Postmark server token + verified `alpharecover.com` sender (lead emails are logged, not sent, until then)
- Cloudflare Turnstile site + secret keys (required in production)
- Production host (see ARCHITECTURE.md §3); the API isn't deployed yet, so the live site runs on the static fallbacks

### Phase 3 — Auth & student backend · M · **Done (2026-11-13), on `Dev`**
| Task | API | [FE] work |
|---|---|---|
| Register / login / logout / session | `/auth/*` | Wire Account forms; header shows the logged-in state |
| Email verification | `/auth/verify-email` (+ resend) | Verification landing route |
| Password reset | `/auth/password/forgot`, `/reset` | **New** reset-password route |
| Profile & sessions | `/me`, `PATCH /me`, `/me/sessions` | **New** profile/settings page |
| Session limit | Evict the oldest beyond 2 | Message "You were logged out on another device" |
| Enrollments table | `enrollments` migration; access-check service | — |

**Exit:** a user can register, verify, log in and reset a password in production.

**Status**
- [x] Auth API: register (Turnstile, common-password check, ISO country, E.164 phone), login (remember-me 30d / 24h browser session, 5-failures lockout, suspended accounts refused), logout, logout-all, verify-email (+ resend), forgot/reset (website links, single-use, signs out everywhere), change password (keeps this session, signs out others), 2-session limit for students (setting). Audit-logged. 18 tests
- [x] Frontend: shared auth store (`src/lib/auth.ts`); Account page login/register/forgot wired with field errors, remember-me, Turnstile; signed-in view (verification status + resend, log out, log out everywhere); header shows "My Account"; `/verify-email` and `/reset-password` pages; "you were signed out" notice (2-device limit). Browser-verified end to end
- [x] Profile & sessions: `GET`/`PATCH /me` (strict: no email/role/status), `GET /me/sessions` (device names, current flag), `DELETE /me/sessions/:id` (own only). `/account/settings` page: profile (incl. name on certificate, WhatsApp consent), change password, devices with sign-out. 8 tests; browser-verified on two devices
- [x] Enrollments: `enrollments` table (one active per user + plan and one per order, enforced by unique indexes), grant/revoke/access/expire service, `GET /me/enrollments`, `GET /me/access/courses/:slug`; maintenance cron marks ended enrollments expired. 11 tests incl. 10 concurrent grants. FK to `orders` follows in Phase 5

### Phase 4 — Training delivery · L
| Task | API | [FE] work |
|---|---|---|
| Video pipeline | Bunny Stream library, token auth enabled; `POST /admin/videos/upload-url` | — |
| Playback | `POST /lessons/:id/playback` (preview vs enrolled) | **New lesson player page** (Bunny iframe embed, next/prev, module list) |
| Progress | `PUT /me/progress/:lessonId`, `GET /me/progress` | Player reports position every ~15s and on pause/end |
| Dashboard | `GET /me/dashboard` | **New student dashboard** ("Continue learning", progress bars, certificates) |
| Certificates issue | Eligibility check on completion; PDF generation (`pdf-lib` + QR); `/me/certificates` + signed download | Certificate list + download on the dashboard |
| Materials (optional) | `learning_materials` + signed download, only if confirmed (firmware software access) | Downloads list on the lesson page |

**Exit:** an enrolled test student can watch, resume, complete and download a certificate.

### Phase 5 — Payments & business logic · L
| Task | Detail |
|---|---|
| Orders & payments schema | `orders`, `payments`, `payment_webhook_events` |
| Checkout | `POST /checkout/orders` (server price, reuse open order, block if enrolled) |
| Client verify | `POST /checkout/verify` (signature + payment fetch) |
| Webhooks | `POST /webhooks/razorpay`: signature, idempotency, `activateOrder()` transaction |
| Emails | `order_receipt`, `enrollment_welcome`; GST invoice PDF once GSTIN exists |
| Refunds | Admin refund → Razorpay API → `refund.processed` webhook → revoke per setting |
| Reconciliation | `/internal/cron/maintenance` expires stale orders; admin "reconcile" re-checks Razorpay |
| [FE] | Buy Now opens Razorpay Checkout (`checkout.js`); **new** `/checkout/success` and `/checkout/failed` pages; order history on the profile |
| Coupons | **Deferred** (no UI). Schema extension documented |

**Exit:** a live ₹1 test plan purchase activates access end to end; webhook replay is safe; refund revokes access.

### Phase 6 — Admin panel backend · L (incremental)
Built module by module, right after the domain it depends on ships. The admin **UI** is a separate frontend effort. Recommended: a protected `/admin` area in the same SPA, reusing the design tokens, lazy-loaded so it doesn't grow the public bundle.

| # | Module | Services / APIs | Models | CRUD | Permission | Depends on | Priority |
|---|---|---|---|---|---|---|---|
| 1 | Leads & inquiries | list/filter, detail, status, assign, notes, CSV export | leads, lead_notes | R U (+notes C) | `leads.*` | P2 | **P0** |
| 2 | Dashboard | KPI aggregates | all (read) | R | `dashboard.view` | P2, P5 | **P0** |
| 3 | Orders & payments | list, detail, refund, reconcile | orders, payments, webhook events | R + refund | `orders.*` | P5 | **P0** |
| 4 | Students | list, detail, edit, suspend, force logout, reset | users, sessions | R U | `students.*` | P3 | **P0** |
| 5 | Enrollments | list, manual grant, revoke | enrollments | C R U | `enrollments.*` | P3 | **P0** |
| 6 | Plans & promotions | price, features, sale windows | plans, promotions, plan_courses | C R U D | `plans.*` | P2 | **P1** |
| 7 | Courses (tracks/modules/lessons) | CRUD, reorder, video upload | courses, course_modules, lessons | C R U D | `courses.*` | P2, P4 | **P1** |
| 8 | Demo videos | CRUD, featured, upload | demo_videos | C R U D | `demos.*` | P2 | **P1** |
| 9 | Certificates | list, manual issue, revoke, regenerate | certificates | C R U | `certificates.*` | P4 | **P1** |
| 10 | Admin users & permissions | invite, role change | users | C R U | `admins.manage` | P1 | **P1** |
| 11 | Activity logs | filterable audit viewer | activity_logs | R | `audit.read` | P1 | **P1** |
| 12 | Website CMS (blog + media) | blog CRUD, publish, image upload | blog_posts | C R U D | `blog.*` | P2 | **P2** |
| 13 | Settings | edit public and operational settings | site_settings | R U | `settings.*` | P1 | **P2** |
| 14 | Notifications log | outbox view, retry | notification_jobs | R + retry | `notifications.*` | P1 | **P2** |
| 15 | Reports & analytics | revenue, leads, students, learning, demos, CSV | all (read) | R | `reports.*` | P2–P5 | **P2** |
| 16 | Learning materials | upload, attach, delete | learning_materials | C R U D | `courses.write` | P4 (if confirmed) | **P3** |
| 17 | Coupons & offers | — | coupons | — | — | Coupon UI | **Deferred** |

### Phase 7 — QA, security & launch · M (continuous, final gate)
See [TESTING.md](TESTING.md) and [SECURITY.md](SECURITY.md). Gate items: auth/RBAC test suite green, payment idempotency tests, webhook replay test, rate limits verified, backups restore-tested, Sentry alerts configured, runbook written, rollback rehearsed.

## 4. Timeline (indicative, one developer)

| Weeks | Phases |
|---|---|
| 0 | Phase 0 (in parallel with Phase 1). Razorpay KYC started day 1 |
| 1–2 | Phase 1 foundation, then Phase 2 leads (ship leads early) |
| 3–4 | Rest of Phase 2; Phase 3 auth; admin Leads + Students modules |
| 5–7 | Phase 4 learning (+ player and dashboard FE) |
| 7–9 | Phase 5 payments (+ checkout FE); admin Orders, Enrollments, Dashboard |
| 9–11 | Remaining admin modules (P1, P2) + admin UI |
| 11–12 | Phase 7 hardening, load test, launch |

Roughly **10–12 weeks** for backend plus the required new frontend screens. With two developers (backend + frontend/admin UI) this drops to **6–8 weeks**.

## 5. Risks, dependencies, recommendations

| Risk | Impact | Mitigation |
|---|---|---|
| Razorpay activation delayed (KYC, legal pages, GST pending) | Can't take payments | Start KYC immediately; publish legal pages; payments can go live without GSTIN (invoice later) |
| Video content not ready (117 lessons need recordings) | Product can't launch | Launch with preview lessons + "coming soon"; seed lessons as `draft` |
| Video piracy (screen recording can't be fully prevented) | Revenue leakage | Token URLs, session limit, optional Bunny DRM + per-user watermark; accept residual risk |
| Account sharing on a lifetime product | Revenue leakage | 2-session limit, admin session revoke, login anomaly logging |
| Missed or duplicated webhooks | Paid users without access, or double grants | Idempotent `activateOrder`, unique constraints, client verify + webhook, reconcile cron/admin action |
| Client-trusted prices | Fraud | Server-side pricing only; amount check on verify |
| SPA blog has weak SEO | Low organic traffic | Prerender blog/course routes at build (e.g. `vite-plugin-prerender` or a small static export step) in a later iteration |
| Serverless cold starts / timeouts | Slow first request | Hono + Drizzle are light; keep heavy work (PDF) small; outbox for retries |
| Shared hosting limits (no Node.js support, low RAM/process caps, cron ≥ 5 min) | API can't run, or degrades during sales | Pick the host with the [ARCHITECTURE.md](ARCHITECTURE.md) §3 checklist; the app stays portable, so moving to a VPS later means no code changes |
| Concurrent editing (Cursor + Claude) on the same repo | Lost or overwritten work | Work on feature branches with PRs; one tool per branch |
| Scope creep into a full marketing CMS | Delay | Keep static copy in `content.ts` (PRD §5) |

**Recommendations**
1. Approve the stack in [ARCHITECTURE.md](ARCHITECTURE.md) §2, or flag changes, before Phase 1.
2. Start Razorpay KYC, Postmark domain verification and legal pages **this week**. They're on the critical path.
3. Ship **Phase 2 leads first**: smallest effort, immediate business value.
4. Use feature branches and PRs from here on; deploy every merge to a staging environment first.
5. Decide the admin UI approach (in-SPA `/admin`, recommended) so frontend work can run in parallel.
6. **Choose the production host using the [ARCHITECTURE.md](ARCHITECTURE.md) §3 checklist** (VPS recommended; a shared cPanel plan only if it supports Node.js 20+, SSH and 1-minute cron).

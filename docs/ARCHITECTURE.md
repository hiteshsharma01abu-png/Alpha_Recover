# Alpha Recover — Architecture

**Last reviewed:** 2026-11-12
**Scope:** how the system is built: the current frontend, the planned backend, hosting and repository layout. Product scope and requirements live in [PRD.md](PRD.md); the visual system lives in [DESIGN.md](DESIGN.md).

---

## 1. Frontend (current)

| Area | Details |
|---|---|
| Stack | Vite 8 · React 19 · TypeScript 6 (`noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`) · React Router 7 · plain CSS (no UI kit, no Tailwind). Node 24 for tooling |
| Runtime dependencies | `react`, `react-dom`, `react-router-dom` only |
| Rendering | Client-side SPA; `BrowserRouter`; all routes eagerly imported in `src/App.tsx`, nested under `<Layout/>`; unknown paths redirect to `/` |
| State | Local `useState` only; no global store or data-fetching library |
| Data | All copy and data in `src/data/content.ts` (no API yet) |
| Build | `tsc -b && vite build` → static `dist/` (one JS + one CSS bundle) |
| Lint | `oxlint` (`.oxlintrc.json`) |
| Hosting (temporary) | Vercel static SPA, catch-all rewrite to `/index.html` in `vercel.json`. Production host undecided (see §3) |

### Source layout

```
src/
  main.tsx              BrowserRouter + global.css
  App.tsx               All routes, nested under <Layout/>; unknown paths → "/"
  components/
    layout/             App shell on every page: Layout (Header, <Outlet/>, Footer, ScrollToTop,
                        WhatsAppFloat, RouteScrollReset)
    sections/           Big page sections reused across routes (Home, /pricing, /demos, /training,
                        /contact), each *.tsx with its colocated *.css. SolutionsStack.css also holds
                        the shared sticky stack-card styles used by ProTraining + DemoVideos sections.
    visuals/            *Visuals.tsx: image/icon maps + small visual components for sections
                        (PageHddVisual.tsx is currently unused)
    ui/                 Small generic building blocks: Reveal (IntersectionObserver fade-in)
  pages/                One file per route; CSS colocated (Home.css = Home-only: hero, global stats, why-learn)
  data/content.ts       ALL copy/data: company, stats, trainingTracks, demoVideos, pricing, services, industries, blogPosts
  data/sectionMedia.ts  Section → /assets image maps
  lib/icons.ts          Local SVG icon resolver (see DESIGN.md)
  styles/global.css     Design tokens (:root vars), base, buttons, container
  styles/glass.css      Glass/blur surface styles
  styles/sections.css   Accent bars shared across sections
public/
  assets/               Compressed .webp/.png images referenced as '/assets/...'
  icons/                Pre-exported Iconify SVGs, one file per icon + colour variant
```

### Routes

| Path | Page | Notes |
|---|---|---|
| `/` | Home | Hero, solutions, training explorer, pro training, demo videos, Professional Plan, contact CTA |
| `/training` | TrainingIndex | Training explorer + pro training |
| `/training/:trackId` | TrainingTrack | Track modules and lessons (lesson player not built) |
| `/pricing` | Pricing | Professional Plan with Buy Now (checkout stub) |
| `/demos` | Demos | Filter, search, pagination over demo videos |
| `/contact` | Contact | Contact form (stub) |
| `/account` | Account | Login, register, forgot password; signed-in view (verification status, log out) |
| `/about`, `/services`, `/industries` | Static pages | |
| `/blog`, `/blog/:slug` | Blog | Excerpts only |
| `/verify-certificate` | VerifyCertificate | Certificate lookup (API) |
| `/account/settings` | AccountSettings | Profile, change password, your devices (sign out others) |
| `/verify-email` | VerifyEmail | Landing page for the verification email link (`?token=`) |
| `/reset-password` | ResetPassword | Landing page for the password-reset email link (`?token=`) |

Because every route is eagerly imported, **all CSS ships in one bundle**: class prefixes must stay unique per section to avoid cross-file cascade clashes.

---

## 2. Backend (planned — not implemented yet)

**Principles:**
1. **Host-portable.** Hosting isn't decided (Vercel is temporary; cPanel shared hosting is a likely target; a VPS is possible). The backend is a plain Node.js app that runs unchanged on cPanel (Node.js App / Passenger), a VPS (PM2 + Nginx) or Vercel (adapter, during development only).
2. **Stay on the existing stack** (TypeScript, one repo) and add the fewest services. Anything a shared host can't do well (video streaming, email delivery, payments) goes to a specialist service that works with any host.

| Concern | Recommendation | Why | Alternatives considered |
|---|---|---|---|
| Runtime | **Node.js 20+**, one long-running app process | Supported by cPanel "Setup Node.js App", every VPS, and Vercel (via adapter) | PHP/Laravel: only if the chosen host can't run Node (see §3) |
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

## 3. Hosting requirements checklist (use this when choosing a host)

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

## 4. Repository layout

Phase 1 (built) is marked ✓; the rest arrives with later phases.
```
server/
  index.ts            ✓ Node entry (@hono/node-server): cPanel Passenger startup file / PM2
  app.ts              ✓ Hono app: request id, JSON access log, security headers, CSRF guard, error envelope
  env.ts              ✓ Zod-validated environment (fails fast at boot)
  types.ts            ✓ Deps injected into every request (env, db, auth, mailer)
  audit.ts            ✓ logActivity() → activity_logs
  auth/               ✓ Better Auth config, requireUser / requireStaff, permission matrix
  db/                 ✓ schema.ts, pool (UTC), migrate.ts, seed.ts (catalog from content.ts), migrations/, docker-init/
  lib/                ✓ errors, logger, ids (UUIDv7), request/client IP, validate (Zod), ratelimit (MySQL), security
  notifications/      ✓ mailer (Postmark / dev log), templates, outbox (queue + retries)
  routes/             ✓ health, auth (session), internal (cron), leads, catalog · later: me, checkout, webhooks, admin/*
  services/             pricing, enrollment, certificates, leads, video (Phase 2+)
  test/               ✓ Vitest global setup + helpers (real MySQL)
shared/schemas/         Zod schemas shared with the frontend (Phase 2+)
scripts/build-api.mjs ✓ esbuild bundle → dist-server/ (all deps bundled: no npm install on the host)
deploy/               ✓ htaccess.example, nginx.conf.example, crontab.example
docker-compose.yml    ✓ local MySQL 8.4
.github/workflows/    ✓ CI: lint, build, tests on MySQL 8.4 + MariaDB 10.6
src/lib/api.ts        ✓ typed fetch client for the frontend (not used by pages yet)
```

**No Vercel adapter yet.** Vercel deploys any top-level `api/` folder as functions automatically; with no database configured there, they'd deploy broken. Add it only if a Vercel staging environment with a managed MySQL is set up.

**API data with static fallback:** every page with API-backed content renders the bundled data from `content.ts` immediately and switches to the API response when it arrives: `useTrainingTracks()` (`src/lib/catalog.ts`), `usePlan()` (`plans.ts`), `useDemoVideos()` (`demoVideos.ts`), `useBlogPosts()` / `useBlogPost()` (`blog.ts`), `useSiteSettings()` (`settings.ts`). The site therefore works unchanged on static hosting with no API, and reflects admin edits once the API is live. Pages that only make sense live (forms, certificate lookup) show a clear error when the API is unreachable.

**Local development:** `npm run dev` (Vite, :5173) proxies `/api` to `npm run dev:api` (:8787), so the browser sees one origin, just like production.

## 5. Request flow
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

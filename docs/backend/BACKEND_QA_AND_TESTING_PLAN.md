# Alpha Recover — Backend QA & Testing Plan

**Date:** 2026-11-12 · **Status:** Proposal

---

## 1. Strategy

| Layer | Tool | Scope | Runs |
|---|---|---|---|
| Unit | Vitest | Pure services: pricing, certificate code generation, access rules, permission map, Zod schemas, signature verification | Every commit (CI) |
| API / integration | Vitest + Hono `app.request()` against a real MySQL 8 (Docker locally, service container in CI; the suite also runs once against MariaDB 10.6 to keep cPanel compatibility) | Every endpoint: happy path, validation, auth, permission, errors | Every PR (CI) |
| Contract | Shared Zod schemas imported by tests and the frontend | Request/response shapes stay in sync | Every PR |
| External mocks | MSW / nock for Razorpay, Bunny, Postmark, Turnstile; recorded fixtures of real webhook payloads | Deterministic CI | Every PR |
| Sandbox E2E | Playwright against staging + Razorpay **test mode** + Bunny test library | Critical user journeys | Before each production release |
| Frontend integration | Playwright (existing pages wired to the API) | Forms and flows in a real browser, desktop + mobile viewport | Before release |
| Visual regression | Playwright computed-style / screenshot diff (the same harness used to verify the Home.css split) | Ensures wiring forms doesn't change the UI | When frontend files change |
| Security | OWASP ZAP baseline scan on preview, `npm audit`, manual auth/RBAC review | Before launch, then monthly | |
| Load | k6 | Public catalog, `/leads`, checkout create, webhook burst | Before launch |

**Coverage targets:** services ≥ 90% lines; routes: 100% of endpoints have at least one success, one auth-failure and one validation-failure test.

## 2. Test environments

| Env | Database | Payments | Video | Email |
|---|---|---|---|---|
| Local | Docker MySQL 8 | Razorpay test keys | Bunny test library | Postmark test token (sink) |
| CI | MySQL service container per run (migrations applied from scratch) | Mocked | Mocked | Mocked |
| Staging | Managed MySQL until the host is chosen, then a staging DB/subdomain on the production host (seeded, no real PII) | Test mode | Test library | Sandbox |
| Production | Host MySQL (cPanel or VPS) | Live | Live | Live |

Seed fixtures: 1 super_admin, 1 admin, 1 content_manager, 1 support, 3 students (no enrollment / active enrollment / revoked enrollment), catalog seeded from `content.ts`, 1 plan + active promotion, 6 demo videos, 3 posts, 2 certificates (valid / revoked).

## 3. Functional test cases (by area)

### Authentication
- Register: success; duplicate email (generic message, 409); invalid email; weak/breached password; password mismatch; terms unchecked; missing captcha; rate limit on the 6th attempt.
- Login: success sets an HttpOnly/Secure/SameSite cookie; wrong password generic 401; suspended user 403; brute-force lockout 429; "remember me" sets a 30d expiry.
- Session limit: 3rd login evicts the 1st; the evicted session gets 401.
- Verify email: valid token; expired; reused; resend.
- Forgot/reset: unknown email still returns 200; token single-use; expiry 1h; all sessions revoked after reset.
- Logout and logout-all invalidate server sessions.

### Authorization (RBAC matrix tests)
- A parameterized test generates **every admin route × every role** and asserts allow/deny against `permissions.ts` (prevents drift).
- Student can't reach any `/admin/*` (403); anonymous gets 401.
- IDOR: student A requests B's order or certificate download → 404.
- Last super_admin can't be demoted; staff can't change their own role; refund threshold enforced for `admin`.

### Catalog & learning
- `GET /courses/:slug` never contains `videoId` (snapshot assertion on the JSON keys).
- Playback: preview lesson anonymous → 200; paid lesson anonymous → 401; logged-in, not enrolled → 403 `NOT_ENROLLED`; enrolled → 200 with a signed URL whose expiry ≤ 2h; revoked or expired enrollment → 403; draft lesson → 404.
- Progress: monotonic `watchedSeconds`; completion at 90%; out-of-range values rejected; completing the final lesson issues exactly one certificate (rerun is idempotent).

### Plans & promotions
- Effective price with no promotion, an active promotion, before start, after end, and with `is_active=false`.
- Overlapping promotion → 422.
- `endsAt` matches the DB (countdown source).

### Checkout & payments (highest risk; most tests)
- Create order: server amount equals the effective price; a tampered client amount is ignored; already enrolled → 409; unverified email → 403 (when the setting is on); an open order is reused.
- Verify: valid signature + captured → paid + enrollment; invalid signature → 400; amount mismatch → 422 and flagged.
- Webhook: invalid signature → 400; valid `payment.captured` → activation; **same event twice → one enrollment**; **verify and webhook racing concurrently → one enrollment** (parallel test); out-of-order events (`failed` after `captured`) don't downgrade; `refund.processed` → refund recorded and access revoked per setting.
- Stale order expiry via the maintenance cron.
- Reconcile: missed webhook recovered.

### Leads
- Contact form: required fields; reason mapping for all 5 options; consent stored; honeypot filled → stored as spam, 201 returned; captcha failure; rate limit.
- Callback: email-only accepted; neither email nor phone → 400.
- Notifications: `lead_alert` and `lead_ack` jobs enqueued; outbox retry with backoff; `dead` after 5 attempts.
- Admin: status change writes a `lead_notes` status_change entry; CSV export respects filters and permission.

### Demo videos
- Filter by each category; search by title/tag/tags; pagination boundaries (page beyond total); featured excluded from the list; `counts` correct; view increment rate limited.

### Certificates
- Verify valid, revoked (no reason exposed), unknown, malformed (same 404), lowercase input normalized.
- Code sequence gap-free under concurrent issuance (parallel test); year rollover.
- PDF contains the code and a QR URL; signed download link expires.

### Blog, settings
- Only published posts are public; drafts 404; slug uniqueness; Markdown sanitization (script tags stripped).
- Settings: per-key validation; public endpoint exposes only `is_public` keys.

## 4. Database integrity tests

- Migrations apply cleanly on an empty DB and are idempotent in CI.
- Constraint tests: unique email (case-insensitive), unique `provider_order_id`, unique `enrollments.order_id`, one active enrollment per user+plan, one featured demo video, certificate code format check.
- FK behaviour: can't delete a plan or course with orders/enrollments (restrict); cascades only where documented.
- Soft delete: soft-deleted rows excluded from public queries; slugs reusable after soft delete.
- Money columns are integers; no float arithmetic in the pricing tests.

## 5. Frontend integration testing (after wiring)

| Journey | Steps | Viewports |
|---|---|---|
| Lead | Home → callback CTA submit → success; `/contact` full form → success; DB row + emails | 390, 768, 1440 |
| Register & verify | `/account` register → verify link (Postmark sandbox) → login → header shows the account | 390, 1440 |
| Reset password | Forgot → email → reset page → login with the new password | 390 |
| Purchase | `/pricing` → Buy Now → Razorpay test checkout (UPI success / card failure) → success page → dashboard shows the course | 390, 1440 |
| Learn | Dashboard → continue → player loads → progress saved → resume position on reload | 390, 1440 |
| Certificate | Complete the seeded short course → certificate on dashboard → download → `/verify-certificate` shows valid | 1440 |
| Demos | Filter, search, paginate, play | 390, 1440 |
| Access denial | Logged-out user clicks a paid lesson → prompt to log in/buy (no video) | 390 |

**Regression:** the existing static pages (About, Services, Industries, Blog list) must render unchanged. Run the computed-style diff harness against the pre-wiring build for pages whose components weren't intentionally changed.

## 6. Non-functional

- **Performance budgets:** public GET p95 < 300 ms (cached < 50 ms at edge); checkout create p95 < 800 ms (includes the Razorpay call); webhook handling < 2 s.
- **Load (k6):** 200 rps on catalog/plans for 5 min with no errors; 50 concurrent checkouts; webhook burst of 100 events (with duplicates) gives zero double enrollments.
- **Resilience:** Postmark down → jobs retry, no user-facing error; Razorpay timeout on order create → 502 with a retry hint; DB connection blip → error surfaced, no partial writes (transactions).

## 7. Security testing checklist

- [ ] Auth cookies flagged HttpOnly/Secure/SameSite; no tokens in localStorage
- [ ] CSRF: cross-origin POST rejected (Origin check + header requirement)
- [ ] RBAC matrix suite green; IDOR tests green
- [ ] Rate limits trigger at the documented thresholds
- [ ] No sensitive fields in any public response (`videoId`, hashes, emails in verify)
- [ ] Webhook signature and replay tests green
- [ ] CSP and security headers present (securityheaders.com grade A)
- [ ] ZAP baseline: no High/Medium findings
- [ ] `npm audit`: no high/critical vulnerabilities
- [ ] Secrets only in host/CI environment settings; repo scan (gitleaks) clean
- [ ] MySQL not reachable from the internet (Remote MySQL off / firewall)
- [ ] `.htaccess` (or Nginx) blocks access to dotfiles, `server/`, and source maps
- [ ] Staff 2FA enforced for admin/super_admin

## 8. Deployment validation & rollback

**Pre-deploy (CI gate):** lint → typecheck → unit → integration → migration dry run on a production-schema branch → build.

**Migrations:** expand/contract only (add columns/tables first, backfill, switch code, remove later). No destructive migration ships in the same release as the code that stops using the column.

**Release steps:**
1. Merge PR → staging deploy validated (sandbox E2E green).
2. Apply migrations to production (CI job, manual approval).
3. Promote the deployment to production.
4. Smoke test: `/api/v1/health`, `GET /plans/professional`, `GET /courses`, submit a test lead (tagged), test login.
5. Watch Sentry and logs for 30 min.

**Feature flags (site_settings):** `checkout_enabled`, `registration_enabled`, `leads_enabled`. These let a single feature be switched off without a redeploy.

**Rollback:** each deploy goes to a timestamped release folder with a `current` symlink (or a kept previous build on cPanel); rollback = switch back and restart the app. The schema stays backward compatible thanks to expand/contract. For data issues, restore the latest `mysqldump` into a scratch database, verify, then switch. Payment-related incidents: disable `checkout_enabled`, then reconcile orders with Razorpay before re-enabling.

**Launch go/no-go:** every Phase 7 gate item in `BACKEND_IMPLEMENTATION_PLAN.md` checked; a live ₹1 transaction completed and refunded successfully in production.

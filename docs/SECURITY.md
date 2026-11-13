# Alpha Recover — Security, Authentication & Permissions

**Last reviewed:** 2026-11-13 · **Status:** Proposal · Related: [API.md](API.md) · [DATABASE.md](DATABASE.md)

---

## 1. Authentication

| Control | Requirement |
|---|---|
| Library | Better Auth on our own MySQL (no hand-rolled crypto) |
| Password hashing | **scrypt** (Better Auth default, memory-hard, per-hash salt). Chosen over argon2id because it needs no native module, so it runs on shared hosting |
| Password policy | 8–128 chars; reject the top breached passwords; no composition rules (NIST 800-63B) |
| Session | Opaque random token in cookie `ar.session_token` (`__Secure-ar.session_token` over HTTPS), signed with `BETTER_AUTH_SECRET`: `HttpOnly; Secure; SameSite=Lax; Path=/`. Stored server-side (`sessions`) so it's revocable |
| Lifetime | "Remember me": 30 days, refreshed daily. Otherwise 24 hours with a browser-session cookie (ends when the browser closes) and no refresh. Staff rules come with the admin panel (docs/admin/AUTH_AND_RBAC.md §6) |
| Session limit | Students: max 2 concurrent (`site_settings.max_student_sessions`). Staff: 3. Each new login signs out the oldest sessions beyond the limit (`server/services/sessions.ts`). **Implemented** |
| Rotation | New session ID on login, privilege change and password change; all sessions revoked on password reset |
| Email verification | Token (hashed at rest), 24h, single use. Purchases require a verified email (setting) |
| Password reset | Token (hashed), 1h, single use; response is identical whether or not the email exists |
| Brute force | 5 **failed** logins / 15 min per IP + email → 429 (successful logins don't count); failures logged to `activity_logs` (`auth.login_failed`, email stored only as a salted hash). Register 5/hour, forgot 5/hour, reset 10/hour, verify-resend 3/hour. **Implemented** |
| Account enumeration | Generic messages on login, register conflict and forgot password |
| Staff accounts | Invite-only (no public staff signup); **TOTP 2FA required for `admin` and `super_admin`** (Better Auth 2FA plugin); staff login alerts by email |
| Logout | `POST /auth/logout` deletes the server session and clears the cookie |

## 2. Authorization (RBAC)

**Approved 2026-11-13.** Roles, the module × action permission matrix, refund limits, the role hierarchy, staff sessions and unauthorized-access handling are defined in **[admin/AUTH_AND_RBAC.md](admin/AUTH_AND_RBAC.md)**. The code source of truth is [`shared/permissions.ts`](../shared/permissions.ts), used by both the API and the admin UI.

| Role | Summary |
|---|---|
| `student` | Own profile, own orders, enrolled content; no admin access |
| `support_manager` | Leads, student accounts (contact details, resets, sessions), view orders/enrollments/certificates, email log |
| `content_manager` | Courses, lessons, demo videos, blog (incl. publishing); views plans |
| `finance_manager` | Orders, refunds (no limit), plans and promotions, enrollments tied to payments, revenue reports |
| `admin` | All modules; team view only; refunds up to ₹5,000; no policy settings |
| `super_admin` | Everything, incl. roles, policies, unlimited refunds |

Implementation:
- `requireStaffAny()` guards the whole `/api/v1/admin/*` router (signed in, active, staff role).
- Each route adds `requireStaff('<module>.<action>')`. There are no blanket "is staff" routes for mutations.
- Role changes revoke the target's sessions.

### Resource ownership (students)
- All `/me/*` queries are scoped by the session user. IDs in URLs are never trusted for ownership (e.g. `DELETE /me/sessions/:id` only finds your own sessions; anyone else's is a 404).
- Course access = an active, unexpired enrollment for a plan that grants the course (`server/services/enrollments.ts`). It is checked on the server for every playback request, not just in the UI.

### Guard rails
- The last `super_admin` can't be demoted or suspended; staff can't change their own role.
- Refunds above the role's limit (`REFUND_LIMITS`) are refused.
- All admin mutations write `activity_logs` with before/after metadata.

## 3. API security

| Area | Control |
|---|---|
| Input validation | Zod on every body, query and param; unknown keys stripped; length limits on all strings; enums for all choice fields |
| Output | Explicit DTOs; never serialize ORM rows directly (prevents leaking `video_id`, password hashes, IP data) |
| SQL injection | Drizzle parameterized queries only; no string-built SQL |
| CSRF | SameSite=Lax cookie + Origin/Referer check on mutations + `X-Requested-With: fetch` header requirement; webhooks exempt (signature-verified) |
| CORS | Same origin only (SPA and API on one domain); no wildcard |
| XSS | React escapes by default. Blog Markdown is rendered by `src/components/ui/Markdown.tsx` into React elements (never `dangerouslySetInnerHTML`), so HTML in the text is shown as text; links are allowed only for `http(s)`, `mailto`, site-relative and `#` targets (`javascript:`, `data:`, protocol-relative are dropped). Covered by `Markdown.test.tsx`. CSP header (below) |
| Security headers | `Content-Security-Policy` (self, Razorpay checkout, Bunny iframe/CDN, Turnstile, Google Fonts), `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `frame-ancestors 'none'`. Set in `vercel.json` for static files and in middleware for the API |
| Rate limiting | MySQL-backed fixed-window counters (`rate_limit_buckets`, limits in API spec §0); 429 + `Retry-After`. Client IP taken only from the trusted proxy header configured for the host |
| Bot protection | Turnstile on register, forgot password, leads; honeypot field on leads |
| Mass assignment | Admin update schemas whitelist fields; `role` changes only via a dedicated endpoint |
| File uploads | Direct-to-Bunny signed uploads; MIME and size whitelist (images ≤ 5 MB; video via Bunny TUS); random keys; never served from our origin |
| Errors | Generic messages to clients; full details only in logs/Sentry; `requestId` correlation |
| Dependencies | `npm audit` / Dependabot in CI; lockfile committed |

## 4. Payment security

- Prices are computed **only** on the server; the client never sends an amount.
- `POST /checkout/verify`: HMAC-SHA256 of `order_id|payment_id` with the key secret, constant-time compare, **plus** a server-side fetch of the payment to confirm `captured` and the amount.
- Webhooks: HMAC-SHA256 over the **raw** body with the webhook secret; reject on mismatch (logged); idempotency via a unique `event_id`.
- `activateOrder` runs in one DB transaction with `SELECT … FOR UPDATE` on the order; unique `enrollments.order_id` makes double activation impossible.
- No card data touches our servers (Razorpay Checkout handles it), so the PCI-DSS scope is SAQ-A.
- Razorpay keys: `key_id` is public; `key_secret` and `webhook_secret` live only in server env.

## 5. Content protection (paid video)

- `lessons.video_id` is never in public responses; only a signed, expiring (≤ 2h) Bunny token URL is returned to entitled users.
- Bunny Stream: token authentication on, allowed referrer = site domain, direct-play disabled, optional MediaCage DRM and a dynamic watermark (user email) as an upgrade.
- Session limit plus logging playback-token issuance per user (abuse detection: many tokens from many IPs).
- Residual risk: screen recording can't be fully prevented. This is accepted.

## 6. Data protection & privacy

| Data | Handling |
|---|---|
| Passwords | scrypt hash only |
| Tokens (session, verify, reset) | Random, hashed at rest where supported, expiring |
| Email / phone | Stored for account and leads; never exposed in public APIs (certificate verify shows only name/program/date/status) |
| IP addresses | Leads/audit: salted SHA-256 hash; sessions: raw IP for security display, deleted with the session |
| Consent | `leads.whatsapp_consent`, `users.whatsapp_opt_in_at`, `users.terms_accepted_at` recorded with timestamps |
| Retention | Spam leads purged after 90 days; expired sessions/tokens purged daily; financial records kept ≥ 8 years (Indian tax rules) |
| User rights | Export and delete-account request handled by admin (soft delete + anonymize PII, keep orders for accounting) — aligned with India's DPDP Act 2023 |
| Secrets | Environment variables per environment (cPanel Node.js App env settings or a VPS `.env` readable only by the app user, `chmod 600`; GitHub Actions secrets for deploys); never in the repo (`.env*` is already gitignored); rotate on staff exit |
| Encryption | TLS everywhere (AutoSSL / Let's Encrypt), HSTS; MySQL accessible only from localhost (Remote MySQL disabled on cPanel; firewall on a VPS); disk encryption depends on the host |

## 7. Logging, monitoring, incident response

- Structured JSON logs (`requestId`, `userId`, route, status, latency); no passwords, tokens or full card/PII in logs.
- Sentry for API + frontend errors; alerts on: error-rate spike, webhook signature failures, payment `amount mismatch`, notification jobs reaching `dead`.
- `activity_logs` for security events: login failures, password resets, role changes, suspensions, refunds, enrollment grants/revokes, certificate revocations, settings changes.
- Uptime check on `/api/v1/health` (DB ping).
- Incident runbook: rotate secrets, revoke all sessions (`DELETE FROM sessions`), disable checkout via a settings flag, restore the DB from the latest `mysqldump` or host backup.

## 8. Backup & recovery

| Item | Policy |
|---|---|
| MySQL | Host daily backups + our nightly `mysqldump --single-transaction` (cron) gzipped and uploaded to Bunny Storage, kept 30 days. On a VPS, also enable binary logs for point-in-time recovery |
| Restore test | Quarterly restore into a scratch database; verify row counts and app boot |
| Media | Bunny Storage replication region enabled; original lesson video masters also kept offline by the business |
| RPO / RTO | Shared hosting: RPO ≤ 24h (nightly dump; payments can be re-synced from Razorpay); VPS with binlogs: RPO ≤ 5 min. RTO ≤ 2h |

## 9. Environment variables (planned; names only)

`DATABASE_URL` (mysql://…), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `BUNNY_STREAM_LIBRARY_ID`, `BUNNY_STREAM_API_KEY`, `BUNNY_STREAM_TOKEN_KEY`, `BUNNY_STORAGE_ZONE`, `BUNNY_STORAGE_KEY`, `BUNNY_CDN_TOKEN_KEY`, `POSTMARK_SERVER_TOKEN`, `POSTMARK_WEBHOOK_SECRET`, `TURNSTILE_SECRET_KEY`, `VITE_TURNSTILE_SITE_KEY`, `VITE_RAZORPAY_KEY_ID`, `SENTRY_DSN`, `VITE_SENTRY_DSN`, `CRON_SECRET`, `IP_HASH_SALT`, `TRUSTED_PROXY` (which header carries the real client IP on the chosen host).
No environment configuration is changed as part of this planning task.

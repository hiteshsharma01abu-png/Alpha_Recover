# Alpha Recover — Admin Panel Security Plan

**Last reviewed:** 2026-11-13 · **Status:** Proposal
**Related:** system-wide controls in [../SECURITY.md](../SECURITY.md) (not repeated here) · [AUTH_AND_RBAC.md](AUTH_AND_RBAC.md) · [ARCHITECTURE.md](ARCHITECTURE.md)

This document lists **what the admin panel adds or tightens**. Everything in `docs/SECURITY.md` (scrypt, DB sessions, CSRF guard, Zod, rate limits, CSP, backups…) applies as well.

## 1. Already in place (verified) and reused

| Control | Where | Status |
|---|---|---|
| CSRF guard (same-origin `Origin` + `X-Requested-With: fetch` on mutations) | `server/lib/security.ts`, applied to all `/api/v1/*` except webhooks and cron | ✅ live, tested |
| Security headers (`secureHeaders`, `Cache-Control: no-store` default) | `server/app.ts` | ✅ live |
| Zod validation with a standard error envelope | `server/lib/validate.ts` | ✅ live |
| MySQL-backed rate limiter | `server/lib/ratelimit.ts` | ✅ live |
| `requireStaff(permission)` | `server/auth/middleware.ts` | ✅ live (to be extended, see AUTH_AND_RBAC.md) |
| Role/status not settable via sign-up | Better Auth `input: false` | ✅ tested |
| Append-only audit trail | `activity_logs` + `logActivity()` | ✅ table/helper live |
| XSS-safe Markdown rendering | `src/components/ui/Markdown.tsx` | ✅ live, tested |
| No secrets in the frontend; video ids never exposed | DTOs in routes | ✅ tested |

## 2. Admin route protection

- **API is the boundary.** The `/admin` UI only decides what to *show*. Every `/api/v1/admin/*` request is authorized on the server (`requireStaff('<module>.<action>')`) regardless of what the UI did.
- **Baseline for the whole admin router:** an authenticated session, `status = active`, a staff role, and **2FA completed** for roles that require it. Anything else returns 401/403 before any handler runs.
- **Frontend guards** (`RequireStaff`, `RequirePermission`) give good UX but aren't relied on for security.
- `/admin` pages send `noindex, nofollow`; `robots.txt` disallows `/admin` and `/api`.
- **Optional hardening (later):** restrict `/api/v1/admin/*` by IP allow-list at the web server, or move the admin to a subdomain; the code layout allows both without backend changes.

## 3. Backend authorization

- One permission per route, from `shared/permissions.ts`; **no wildcard "is admin" routes**.
- **Business-rule checks inside handlers:**
  - refund ≤ role limit
  - hierarchy rules for user management
  - can't revoke your own access or demote the last `super_admin`
  - can't publish someone else's draft without `blog.publish`
- **Object-level checks:** IDs in URLs are validated (UUID format) and loaded with scoping. For example, a support manager editing a student can change contact fields only; `role` and `status` changes go through dedicated, separately permissioned endpoints.
- **Step-up re-authentication** (password or TOTP within 10 minutes) for refunds, role changes, deletes, certificate revocations, policy edits, and exports containing personal data.
- **Automated test:** every admin route × every role; a new route without a declared permission fails CI.

## 4. Input validation

- Shared Zod schemas (`shared/schemas/admin/*`) validate on the client (UX) **and** the server (security). The server never trusts client validation.
- Update schemas are **whitelists**; unknown keys are stripped. Server-owned fields (`id`, `role`, `status`, `created_by`, amounts on orders, `view_count`) can't be set through generic updates.
- **Format rules:**
  - slugs `^[a-z0-9-]+$`
  - money as integer paise with min/max
  - dates as ISO, interpreted and displayed in IST
  - URLs `https://` only for links and media
  - Markdown length limits
- **File uploads:** never through the API server. The API issues short-lived signed upload URLs to Bunny with a **content-type and size whitelist** (images ≤ 5 MB; video by TUS with a size cap) and random object keys. Uploaded files are never served from our origin.
- **CSV import** (leads, lessons): parsed server-side with row limits (5,000), per-row validation, a dry-run preview, and formula-injection protection (cells beginning with `= + - @` are escaped on export *and* rejected or escaped on import).

## 5. API security

- **Rate limits** (per user and IP, MySQL buckets):
  - admin API 300/min per user
  - login 5 per 15 min
  - 2FA verify 5 per 15 min, then a lockout email
  - exports 10 per hour
  - step-up 5 per 15 min
- **Pagination caps:** `pageSize ≤ 100`; exports are streamed in batches and capped (e.g. 50,000 rows) to protect shared-hosting memory.
- **Error hygiene:** generic messages to the client and details in logs and Sentry with the `requestId`. No stack traces, SQL or internal ids leak to the browser.
- **CORS:** none (same origin only).
- **Response DTOs:** explicit, so password hashes, tokens, `video_id`, raw IP hashes and webhook secrets are never serialized.

## 6. Secure session and token handling

- Same HttpOnly, Secure, SameSite=Lax `ar.session_token` cookie; **nothing auth-related in `localStorage`**. The UI only caches `/admin/me` in memory via React Query.
- Staff sessions: 8h absolute, 30 min idle, maximum 3 concurrent. They're rotated on login, 2FA enrolment and role change, and **revoked everywhere** on role change, deactivation or password reset.
- TOTP secrets are encrypted at rest (Better Auth `twoFactor`); backup codes are hashed and single-use.
- Invite and reset tokens: random, hashed at rest, single-use, 24h / 1h expiry.
- A new-device login sends an email alert to the staff member.

## 7. Sensitive data protection

| Data | Rule in the admin |
|---|---|
| Student email/phone | Visible to roles with `students.view` / `leads.view`. **Masked in lists** (`ra***@gmail.com`, `+91 ••••• 97917`) and revealed on the detail view with a logged `pii.view` action for bulk-sensitive screens |
| Payment data | Only gateway ids and amounts (no card data ever reaches us); refunds need `orders.refund` + step-up |
| Lead messages | Treated as personal data; exports require `leads.export` + step-up and are audit-logged with the filter used |
| Exports | CSV generated on demand (not stored), filename with a timestamp, `Content-Disposition: attachment`, logged (`export.leads`, row count, filters) |
| Audit metadata | Before/after diffs **exclude** password hashes, tokens, TOTP secrets and full card/bank data |
| Deleted records | Soft delete for business entities; PII anonymization on account deletion requests (DPDP); orders and payments retained ≥ 8 years |

## 8. Activity logging

- **Logged:** every create, update or delete; status changes; grants and revokes; refunds; exports; role changes; logins, failed logins, 2FA events, step-ups; denied attempts on sensitive actions; settings changes.
- **Fields:** actor id + role, action (`leads.update`, `orders.refund`…), entity type and id, before/after metadata, IP hash, request id, timestamp.
- **Append-only:** the repository layer exposes insert and select only; on a VPS the DB user also lacks UPDATE/DELETE on `activity_logs`.
- The **Activity Log** module (admin and super_admin) filters by actor, action, entity and date, and links back to the affected record.
- **Alerts** (email to super_admin): a refund above ₹10,000, a role change, 5+ failed staff logins for one account, an export of more than 1,000 personal-data rows.

## 9. CSRF

Applicable: the admin uses cookie auth. The existing guard already covers it:
- SameSite=Lax cookie
- `Origin` must equal `APP_URL`
- `X-Requested-With: fetch` required on every non-GET request (cross-site forms can't set it)

Admin GET endpoints are **read-only** (no state changes over GET, including exports, which are GET but side-effect-free apart from audit logging).

## 10. XSS protection

- React escapes everything by default; **`dangerouslySetInnerHTML` is banned** in `src/admin/**` (add an oxlint rule).
- Admin-entered content that appears on the public site (blog Markdown, course and lesson titles, demo descriptions, settings text) is rendered as text or through the safe `Markdown` component, so a compromised staff account can't inject scripts into public pages.
- URLs entered by staff (links, media) are validated server-side (`https://` only) and rendered with `rel="noopener noreferrer"` when external.
- CSP (from docs/SECURITY.md) applies to `/admin` as well: no inline scripts, and `frame-ancestors 'none'`.

## 11. Database access controls

- The app connects with **one least-privilege DB user** (SELECT/INSERT/UPDATE/DELETE on the app schema, no DDL in production). Migrations run with a separate migration user during deploys.
- On a VPS, also revoke UPDATE/DELETE on `activity_logs` from the app user. On cPanel (per-database grants only) this is enforced in the repository layer.
- Remote MySQL is disabled and the DB listens on localhost only (docs/DEPLOYMENT.md).
- All queries are parameterized (Drizzle); no string-built SQL in admin search or filters (sort columns come from a whitelist).
- Backups as in docs/SECURITY.md §8; restoring is a super_admin and ops procedure, never an admin-panel action.

## 12. Security acceptance checklist (before the admin goes live)

- [ ] Every admin route has a declared permission; the RBAC matrix test passes for all roles
- [ ] 2FA enforced for super_admin, admin and finance_manager; backup codes work
- [ ] Step-up enforced for refund, role change, delete, revoke, policy edit and personal-data export
- [ ] Staff session limits (8h / 30 min idle / 3 devices) verified
- [ ] Audit entries written for every mutation and sensitive read; no secrets in metadata
- [ ] PII masking in lists; exports logged
- [ ] No `dangerouslySetInnerHTML` in the admin; public pages render admin content safely
- [ ] Upload type and size whitelist enforced; CSV formula injection handled
- [ ] `/admin` noindex + robots disallow; CSP active
- [ ] Rate limits trip at the documented thresholds

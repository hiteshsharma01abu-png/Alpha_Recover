# Alpha Recover — API Specification

**Base URL:** `/api/v1` (same origin as the SPA; Node.js + Hono, host-portable: cPanel Node.js App, VPS, or Vercel during development)
**Format:** JSON (UTF-8). Request bodies are validated with Zod schemas shared from `shared/schemas/`.
**Last reviewed:** 2026-11-12 · **Status:** Proposal · Related: [DATABASE.md](DATABASE.md) · [SECURITY.md](SECURITY.md)

---

## 0. Conventions

### Authentication
- Session cookie `ar.session_token` (`__Secure-` prefix over HTTPS; httpOnly, Secure, SameSite=Lax, Path=/), issued by Better Auth.
- **Auth levels:** `public` · `user` (any logged-in user) · `student` (logged in, `status=active`) · `staff:<permission>` (admin roles, see [SECURITY.md](SECURITY.md)).
- Mutating requests from the browser must send `X-Requested-With: fetch` (a CSRF defence-in-depth check, alongside SameSite cookies and an Origin check).

### Envelope
```json
{ "data": {}, "meta": { "page": 1, "pageSize": 20, "total": 134 } }
{ "error": { "code": "NOT_FOUND", "message": "Course not found", "details": [], "requestId": "req_…" } }
```

### Standard error codes

| HTTP | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod failure; `details[]` = `{ path, message }` |
| 400 | `CAPTCHA_FAILED` | Turnstile token missing or invalid |
| 401 | `UNAUTHENTICATED` | No or expired session |
| 403 | `FORBIDDEN` | Role or permission missing; suspended user |
| 403 | `EMAIL_NOT_VERIFIED` | Action requires a verified email |
| 403 | `NOT_ENROLLED` | Paid lesson without access |
| 404 | `NOT_FOUND` | |
| 409 | `CONFLICT` | Duplicate email, already enrolled, slug taken |
| 422 | `BUSINESS_RULE` | e.g. promotion overlaps, refund exceeds amount |
| 429 | `RATE_LIMITED` | `Retry-After` header set |
| 502 | `UPSTREAM_ERROR` | Razorpay / Bunny / Postmark failure |
| 500 | `INTERNAL_ERROR` | Unexpected; logged to Sentry with `requestId` |

### Pagination & filtering
`?page=1&pageSize=20` (max 100), `?sort=-createdAt`, `?q=` free-text search. Lists return `meta.total`.

### Rate limits (per IP unless noted)

| Group | Limit |
|---|---|
| `POST /auth/login` | 5 / 15 min per IP + email |
| `POST /auth/register`, `/auth/password/forgot` | 5 / hour |
| `POST /leads` | 5 / hour |
| `GET /certificates/verify/:code` | 30 / min |
| `POST /demo-videos/:id/view` | 1 / video / 30 min |
| Authenticated APIs | 120 / min per user |
| Admin APIs | 300 / min per user |

---

## 0.1 Health

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | public | Uptime / deploy smoke test. `200 { "data": { "status": "ok", "db": "ok", "time": "…" } }`, or `503 SERVICE_UNAVAILABLE` when the database is unreachable. **Implemented (Phase 1)** |

## 1. Authentication APIs

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | public + captcha | Create a student account |
| POST | `/auth/login` | public | Email/password login; sets cookie |
| POST | `/auth/logout` | user | End the current session |
| POST | `/auth/logout-all` | user | End all sessions for the user |
| GET | `/auth/session` | public | Current user or `null` (header login state). **Implemented (Phase 1)** |
| POST | `/auth/verify-email` | public | Confirm an email with a token |
| POST | `/auth/verify-email/resend` | user | Resend the verification email |
| POST | `/auth/password/forgot` | public + captcha | Send a reset link (always 200) |
| POST | `/auth/password/reset` | public | Set a new password with a token |
| POST | `/auth/password/change` | user | Change password (current password required) |

### `POST /auth/register`
Request (mirrors the Account register form):
```json
{ "firstName": "Ravi", "email": "ravi@example.com", "country": "IN", "phone": "+916355197917",
  "password": "S3cure-pass!", "confirmPassword": "S3cure-pass!", "acceptTerms": true, "captchaToken": "…" }
```
Validation: `firstName` 1–80 chars; `email` valid, ≤ 254; `country` ∈ {IN, US, GB, AE, ZZ}; `phone` optional E.164; `password` 8–128 chars, not in the breached top-10k list; `confirmPassword` equals `password`; `acceptTerms === true`.
Response `201`: `{ "data": { "user": { "id", "email", "firstName", "emailVerified": false } } }`, with the session cookie set.
Errors: 400 `VALIDATION_ERROR`, 400 `CAPTCHA_FAILED`, 409 `CONFLICT` (email exists; the message is generic: "If this email is new, check your inbox"), 429.
DB: insert `users`, `accounts`, `sessions`, `verifications`; enqueue `notification_jobs(verify_email)`; `activity_logs(auth.register)`.

### `POST /auth/login`
Request: `{ "email": "…", "password": "…", "remember": true }`
Response `200`: `{ "data": { "user": { "id", "email", "firstName", "role", "emailVerified" } } }`, cookie set (30d if `remember`, else 12h).
Errors: 401 `UNAUTHENTICATED` (generic "Invalid email or password"), 403 `FORBIDDEN` (suspended), 429.
DB: verify argon2id hash; insert `sessions`; evict the oldest if over `max_student_sessions`; update `users.last_login_at`; log `auth.login` or `auth.login_failed`.

### `GET /auth/session`
Response: `{ "data": { "user": { … } | null } }`

### `POST /auth/password/forgot`
Request: `{ "email": "…", "captchaToken": "…" }` → always `200 { "data": { "ok": true } }` (no account enumeration).
### `POST /auth/password/reset`
Request: `{ "token": "…", "password": "…", "confirmPassword": "…" }` → `200`; all sessions revoked. Errors: 400 invalid or expired token.

---

## 2. Public Website APIs

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/settings/public` | public | Company contact, hours, WhatsApp, social links (Footer, Contact, CTA) |
| GET | `/blog` | public | Published posts, newest first (`?page`, `?pageSize` ≤ 50): slug, title, excerpt, coverImageUrl, publishedAt; `meta.total`. Only `published`, not deleted, and `publishedAt` ≤ now (scheduling works). **Implemented (Phase 2)** |
| GET | `/blog/:slug` | public | Full post: adds `bodyMarkdown`, `seoTitle`, `seoDescription`. The site renders the Markdown with `src/components/ui/Markdown.tsx` (no raw HTML) and sets the page title and meta description. **Implemented (Phase 2)** |
| GET | `/certificates/verify/:code` | public | Certificate verification (details below) |

`GET /settings/public` response:
```json
{ "data": { "company": { "name": "Alpha Recover", "email": "info@alpharecover.com", "phone": "+916355197917",
  "whatsapp": "https://wa.me/916355197917", "address": "…", "hours": "Mon – Sat, 9:00 AM – 6:00 PM" },
  "socialLinks": [{ "platform": "youtube", "url": "…" }] } }
```
Cache: `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`.

### `GET /certificates/verify/:code`
Validation: `code` matches `^AR-\d{4}-\d{5}$` (case-insensitive, normalized to upper case).
Response `200`:
```json
{ "data": { "code": "AR-2026-00421", "status": "valid", "recipientName": "Ravi Patel",
  "programTitle": "Professional Data Recovery Training", "issuedAt": "2026-10-02" } }
```
`status` is `valid` or `revoked` (revoked also returns `revokedAt`; never the reason). Errors: 404 (same body for malformed and unknown codes), 429. No email or phone is ever returned.

---

## 3. Student APIs

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/me` | user | Profile |
| PATCH | `/me` | user | Update firstName, lastName, certificateName, phone, country, whatsappOptIn |
| GET | `/me/dashboard` | student | Enrolled courses with progress %, "continue learning" lesson, certificates |
| GET | `/me/enrollments` | student | Active and past enrollments |
| GET | `/me/orders` | user | Order history |
| GET | `/me/orders/:orderNumber` | user | Order detail (used by the checkout success page) |
| GET | `/me/certificates` | student | Own certificates |
| GET | `/me/certificates/:id/download` | student | 302 to a signed PDF URL (5 min) |
| GET | `/me/sessions` | user | Active sessions (device, IP, last seen) |
| DELETE | `/me/sessions/:id` | user | Revoke one session |

`GET /me/dashboard` response:
```json
{ "data": {
  "courses": [{ "slug": "logical", "title": "Logical Failure Data Recovery", "lessonsTotal": 26, "lessonsCompleted": 9, "progressPct": 35 }],
  "continue": { "courseSlug": "logical", "lessonId": "…", "lessonTitle": "Raw Partition / Drive Recovery", "positionSeconds": 312 },
  "certificates": [{ "code": "AR-2026-00421", "issuedAt": "…" }],
  "hasActiveEnrollment": true } }
```
DB: `enrollments` + `lessons` count + `lesson_progress` aggregate. Ownership is always scoped to `session.userId`.

---

## 4. Courses & Training APIs

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/courses` | public | Published tracks: slug, title, summary, imageUrl, moduleCount, lessonCount, totalDurationSeconds. `?include=outline` adds modules → lessons (used by the site to render the whole catalog in one request). Cached `s-maxage=300`. **Implemented (Phase 2)** |
| GET | `/courses/:slug` | public (enriched if logged in, Phase 3–4) | Track → modules → lessons (`id`, `slug`, `title`, `durationSeconds`, `isPreview`, `hasVideo`; `locked` / `completed` arrive with auth). **Implemented (Phase 2)** without the logged-in fields |
| POST | `/lessons/:id/playback` | public for preview lessons; student + access for others | Returns a short-lived signed playback URL |
| PUT | `/me/progress/:lessonId` | student + access | Save position / completion |
| GET | `/me/progress?course=:slug` | student | Progress map for a course |

### `GET /courses/:slug`
Response:
```json
{ "data": { "slug": "logical", "title": "…", "summary": "…",
  "modules": [{ "slug": "logical-core", "title": "Logical (Software) Level",
    "lessons": [{ "id": "…", "slug": "l1", "title": "Introduction", "durationSeconds": 420, "isPreview": true, "hasVideo": true, "locked": false, "completed": true }] }],
  "access": { "enrolled": true } } }
```
**Never includes `videoId`.** Errors: 404.

### `POST /lessons/:id/playback`
Response `200`: `{ "data": { "embedUrl": "https://iframe.mediadelivery.net/embed/…?token=…&expires=…", "expiresAt": "…", "resumeAt": 312 } }`
Logic: lesson published → if `isPreview` allow; else require a session, and an active enrollment granting the lesson's course. Sign a Bunny token URL (TTL 2h, optionally bound to the client IP).
Errors: 401 `UNAUTHENTICATED`, 403 `NOT_ENROLLED`, 403 `EMAIL_NOT_VERIFIED` (if configured), 404.
DB: read `lessons`, `course_modules`, `enrollments`, `plan_courses`, `lesson_progress`.

### `PUT /me/progress/:lessonId`
Request: `{ "positionSeconds": 312, "watchedSeconds": 300, "completed": false }`
Validation: integers 0 ≤ x ≤ duration + 60. `watchedSeconds` only increases (server keeps the max).
Response `200`: `{ "data": { "completedAt": null, "courseProgressPct": 36 } }`
Side effect: when every lesson in the plan's courses is complete (per `certificate_criteria`), issue a certificate (§ certificates service) and enqueue `certificate_issued`.

---

## 5. Training Plan APIs

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/plans` | public | Published plans with the effective price. **Implemented (Phase 2)** |
| GET | `/plans/:slug` | public | One plan (Professional Plan section, countdown). **Implemented (Phase 2)** |

`GET /plans/professional` response:
```json
{ "data": { "slug": "professional", "name": "Professional Plan", "description": null, "currency": "INR",
  "pricePaise": 599900, "effectivePricePaise": 250000, "comparePricePaise": 599900, "discountPct": 58,
  "promotion": { "label": "Festival Sale – Up to 60% Off", "startsAt": "2026-10-31T18:30:00.000Z", "endsAt": "2026-11-30T18:29:59.000Z" },
  "features": ["20+ hours of self-study video training", "…"], "mobileFeatureOrder": [0, 2, 4, 6, 8, 10, 12, 14, 16],
  "accessDays": null } }
```
`promotion` is `null` when none is active: the frontend then hides the kicker, countdown and sale line, and shows `comparePricePaise` (the struck-through price) only when it's set. A promotion applies while `is_active`, not deleted and `startsAt ≤ now < endsAt`. Prices come from `priceFor()` / `loadPlans()` in [`server/services/pricing.ts`](../server/services/pricing.ts), which checkout must reuse (never trust a client amount). Short cache (`s-maxage=60`) because the price changes the moment a sale starts or ends. *Planned (Phase 3+):* a `viewer: { enrolled }` field when the request has a session.

---

## 6. Enrollment APIs

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/me/enrollments` | student | (listed in §3) |
| GET | `/me/access/courses/:slug` | user | `{ enrolled: boolean }` quick check for the UI |

Enrollments are **created only** by the payment service (purchase) or admins (manual/complimentary). There is no public create endpoint.

---

## 7. Payment APIs

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/checkout/orders` | user (verified email if configured) | Create or reuse an order + Razorpay order |
| POST | `/checkout/verify` | user | Verify the Razorpay Checkout handler response |
| POST | `/checkout/orders/:orderNumber/cancel` | user | User closed checkout (optional) |
| POST | `/webhooks/razorpay` | Razorpay signature | Source of truth for payment state |

### `POST /checkout/orders`
Request: `{ "planSlug": "professional", "billing": { "name": "Ravi Patel", "phone": "+91…", "country": "IN", "gstin": null } }`
Logic: plan published → user not already enrolled (409) → compute the effective price server-side → reuse an open order (same amount, unexpired) or create one → `razorpay.orders.create({ amount, currency: 'INR', receipt: order_number, notes: { orderId } })`.
Response `201`:
```json
{ "data": { "orderNumber": "AR-ORD-2026-000123", "amountPaise": 250000, "currency": "INR",
  "razorpay": { "keyId": "rzp_live_…", "orderId": "order_…", "prefill": { "name": "…", "email": "…", "contact": "…" } } } }
```
Errors: 401, 403 `EMAIL_NOT_VERIFIED`, 404 plan, 409 already enrolled, 502 `UPSTREAM_ERROR`.
DB: insert `orders` (status `created`).

### `POST /checkout/verify`
Request: `{ "razorpayOrderId": "order_…", "razorpayPaymentId": "pay_…", "razorpaySignature": "…" }`
Logic: HMAC-SHA256(`order_id|payment_id`, key secret) compared in constant time → fetch the payment from the Razorpay API → if `captured` and the amount matches, run `activateOrder(orderId)` (idempotent, same function as the webhook).
Response `200`: `{ "data": { "orderNumber": "…", "status": "paid", "enrollment": { "planSlug": "professional", "status": "active" } } }`
Errors: 400 `VALIDATION_ERROR` (bad signature), 404, 422 `BUSINESS_RULE` (amount mismatch; flagged for review).

### `POST /webhooks/razorpay`
Headers: `X-Razorpay-Signature`, `X-Razorpay-Event-Id`. The raw body is verified with HMAC-SHA256 using the webhook secret.
Events handled: `payment.authorized` (record), `payment.captured` / `order.paid` → `activateOrder`, `payment.failed` → mark failed, `refund.processed` → update the refund and revoke access if configured.
Idempotency: insert `payment_webhook_events(event_id)`; on a unique violation return `200` immediately.
Response: `200 { "ok": true }` quickly (heavy work in the same transaction is fine; it's small). Signature failure → `400`, logged.

**`activateOrder(orderId)` (single transaction):** lock the order `FOR UPDATE` → if already `paid` return → upsert `payments` → `orders.status='paid', paid_at` → insert `enrollments` (unique on `order_id` guarantees once) → enqueue `order_receipt` + `enrollment_welcome` → `activity_logs(order.paid)`.

---

## 8. Leads & Contact APIs

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/leads` | public + captcha | Contact form and callback submissions. **Implemented (Phase 2)** |

### `POST /leads`
Request (contact form):
```json
{ "source": "contact_form", "name": "Ravi", "email": "ravi@example.com", "phone": "+916355197917",
  "reason": "training", "message": "…", "whatsappConsent": true,
  "pagePath": "/contact", "utm": { "source": "google" }, "captchaToken": "…", "website": "" }
```
Request (callback CTA): `{ "source": "callback", "phone": "+91 98250 12345", "email": "… (optional)", "pagePath": "/", "captchaToken": "…" }`
Validation: `source` ∈ {contact_form, callback}; for `contact_form`, `name`, `email`, `phone`, `message` are required and `reason` ∈ the 5 values in [`shared/leads.ts`](../shared/leads.ts) (UI labels map to them there); for `callback`, **`phone` is required** and `email` is optional; `phone` is normalized to E.164 (a bare 10-digit number is treated as Indian, `+91`); `email` is lower-cased; `message` ≤ 5000; `website` is a honeypot and must be empty (if filled: stored as `spam`, `201` returned, no emails). Rate limit: 5 per hour per IP. Turnstile is checked when `TURNSTILE_SECRET_KEY` is set (required in production).
Response `201`: `{ "data": { "ok": true } }` (no ID echoed).
Side effects: insert `leads`; enqueue `lead_alert` to `lead_notification_emails` and `lead_ack` to the submitter (if email); optional WhatsApp alert to staff.
Errors: 400, 400 `CAPTCHA_FAILED`, 429.

---

## 9. Demo Video APIs

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/demo-videos` | public | Catalog: `?category=logical&q=bitlocker&page=1&pageSize=12` (pageSize ≤ 100). **Implemented (Phase 2)** |
| GET | `/demo-videos/featured` | public | The featured video (Demos hero, home preview); `data: null` if none. **Implemented** |
| GET | `/demo-videos/:slug` | public | Detail; `embedUrl` is `null` until video hosting arrives (Phase 4). **Implemented** |
| POST | `/demo-videos/:slug/view` | public | Count a view: at most once per IP per video per 30 min (repeats return `counted: false`). **Implemented**; the site calls it once a real player exists |

`GET /demo-videos` response:
```json
{ "data": [{ "slug": "d2", "title": "…", "tag": "Logical", "category": "logical", "level": "beginner",
  "durationSeconds": 728, "tags": ["Partition Recovery"], "description": "…", "thumbnailUrl": "…",
  "viewCount": 9240, "publishedAt": "…" }],
  "meta": { "page": 1, "pageSize": 12, "total": 23, "counts": { "all": 23, "logical": 8, "electrical": 6, "mechanical": 4, "firmware": 5 } } }
```
The featured video is excluded from the list and from `counts` (matching current UI behaviour); `counts` ignore `category` and `q`, so the filter tabs always show totals. Search is a case-insensitive `LIKE` on title, tag and tags (wildcards in `q` are escaped); the catalog is small, so the site currently loads it whole (`pageSize=100`) and filters in the browser, while the server-side filtering is ready for when it grows. Each item has `hasVideo` (`false` = "coming soon") and never the video id. Cache `s-maxage=120`.

---

## 10. Admin Panel APIs (`/admin/*`, all `staff:*`)

Every admin mutation writes `activity_logs`. Lists support `page`, `pageSize`, `q`, `sort`, and the filters shown.

| Method | Endpoint | Permission | Purpose / filters |
|---|---|---|---|
| GET | `/admin/dashboard` | `dashboard.view` | KPIs: revenue (today/7d/30d), orders, new students, new leads by status, conversion, top demo videos |
| GET | `/admin/students` | `students.read` | `?status&country&enrolled&q` |
| GET | `/admin/students/:id` | `students.read` | Profile, enrollments, orders, progress, certificates, sessions |
| PATCH | `/admin/students/:id` | `students.write` | Edit name, phone, country, certificateName |
| POST | `/admin/students/:id/suspend` · `/unsuspend` | `students.write` | Suspend revokes all sessions |
| POST | `/admin/students/:id/sessions/revoke` | `students.write` | Force logout |
| POST | `/admin/students/:id/password-reset` | `students.write` | Send a reset email |
| GET/POST | `/admin/courses` | `courses.read` / `courses.write` | List / create track |
| GET/PATCH/DELETE | `/admin/courses/:id` | `courses.*` | Detail / update / soft delete (blocked if it has enrollments' progress, otherwise archived) |
| POST | `/admin/courses/:id/modules` | `courses.write` | Create module |
| PATCH/DELETE | `/admin/modules/:id` | `courses.write` | |
| POST | `/admin/modules/:id/lessons` | `courses.write` | Create lesson |
| PATCH/DELETE | `/admin/lessons/:id` | `courses.write` | Title, description, isPreview, status, videoId |
| PUT | `/admin/courses/:id/order` | `courses.write` | Reorder modules/lessons `{ modules: [{ id, lessonIds: [] }] }` |
| POST | `/admin/videos/upload-url` | `courses.write` / `demos.write` | Create a Bunny video + direct-upload (TUS) credentials; returns `videoId` |
| GET/POST | `/admin/plans` | `plans.*` | |
| PATCH | `/admin/plans/:id` | `plans.write` | Price, features, mobileFeatureOrder, status |
| GET/POST | `/admin/plans/:id/promotions` | `plans.*` | Create a promotion (overlap → 422) |
| PATCH/DELETE | `/admin/promotions/:id` | `plans.write` | Edit / end now / soft delete |
| GET/POST | `/admin/demo-videos` | `demos.*` | |
| PATCH/DELETE | `/admin/demo-videos/:id` | `demos.write` | Includes setting `isFeatured` (unsets the previous one) |
| GET | `/admin/enrollments` | `enrollments.read` | `?status&source&planId` |
| POST | `/admin/enrollments` | `enrollments.write` | Manual / complimentary grant `{ userId, planId, source, expiresAt?, reason }` |
| POST | `/admin/enrollments/:id/revoke` | `enrollments.write` | `{ reason }` |
| GET | `/admin/orders` | `orders.read` | `?status&from&to&q(orderNumber/email)` |
| GET | `/admin/orders/:id` | `orders.read` | Order + payments + webhook events |
| POST | `/admin/orders/:id/refund` | `orders.refund` | `{ amountPaise?, reason }` → Razorpay refund API |
| POST | `/admin/orders/:id/reconcile` | `orders.refund` | Re-fetch from Razorpay and re-run `activateOrder` (for missed webhooks) |
| GET | `/admin/leads` | `leads.read` | `?status&reason&source&assignedTo&from&to&q` |
| GET | `/admin/leads/:id` | `leads.read` | Lead + notes |
| PATCH | `/admin/leads/:id` | `leads.write` | `{ status?, assignedTo? }` (status change auto-adds a note) |
| POST | `/admin/leads/:id/notes` | `leads.write` | `{ type, body }` |
| GET | `/admin/leads/export.csv` | `leads.export` | CSV export (filters as list) |
| GET/POST | `/admin/certificates` | `certificates.*` | List / manual issue `{ userId, planId|courseId, recipientName? }` |
| POST | `/admin/certificates/:id/revoke` | `certificates.write` | `{ reason }` |
| POST | `/admin/certificates/:id/regenerate-pdf` | `certificates.write` | After a name correction |
| GET/POST | `/admin/users` | `admins.manage` | Staff accounts (invite by email) |
| PATCH | `/admin/users/:id/role` | `admins.manage` | Change role (can't demote the last super_admin) |
| GET | `/admin/activity-logs` | `audit.read` | `?actorId&action&entityType&entityId&from&to` |

## 11. CMS APIs

| Method | Endpoint | Permission | Purpose |
|---|---|---|---|
| GET/POST | `/admin/blog` | `blog.*` | List / create post |
| GET/PATCH/DELETE | `/admin/blog/:id` | `blog.write` | Edit / soft delete |
| POST | `/admin/blog/:id/publish` · `/unpublish` | `blog.publish` | Sets `published_at` |
| POST | `/admin/media/upload-url` | `blog.write` / `demos.write` | Signed upload for images (thumbnails, covers) to Bunny Storage; returns a public CDN URL |

Validation: unique slug (`^[a-z0-9-]{3,120}$`), title ≤ 200, excerpt ≤ 400, SEO lengths. Markdown is sanitized on render (no raw HTML).

## 12. Reports & Analytics APIs

| Method | Endpoint | Permission | Purpose |
|---|---|---|---|
| GET | `/admin/reports/revenue` | `reports.view` | `?from&to&groupBy=day|week|month`: gross, refunds, net, order count |
| GET | `/admin/reports/leads` | `reports.view` | Leads by source/reason/status over time; conversion rate |
| GET | `/admin/reports/students` | `reports.view` | Signups, buyers, country split |
| GET | `/admin/reports/learning` | `reports.view` | Course completion rates, most-watched lessons, drop-off |
| GET | `/admin/reports/demo-videos` | `reports.view` | Views per video |
| GET | `/admin/reports/:type/export.csv` | `reports.export` | CSV |

All read-only aggregates over existing tables (no separate analytics store at this scale).

## 13. Notifications APIs

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/admin/notifications` | `notifications.read` | Outbox log `?status&template&channel` |
| POST | `/admin/notifications/:id/retry` | `notifications.write` | Retry a failed/dead job |
| POST | `/internal/cron/notifications` (**implemented**) | `Authorization: Bearer $CRON_SECRET` (called by host cron via `curl`) | Drain the outbox (batch of 50, backoff) |
| POST | `/internal/cron/maintenance` (**implemented**) | `Authorization: Bearer $CRON_SECRET` (host cron) | Expire orders, delete expired sessions and verifications, end promotions |
| POST | `/webhooks/postmark` | Postmark basic-auth | Bounce/spam complaints → mark email undeliverable |

Templates: `verify_email`, `password_reset`, `order_receipt`, `enrollment_welcome`, `lead_ack`, `lead_alert`, `certificate_issued`, `refund_processed`. WhatsApp templates are added when the BSP is onboarded.

## 14. Settings APIs

| Method | Endpoint | Permission | Purpose |
|---|---|---|---|
| GET | `/settings/public` | public | (listed in §2) |
| GET | `/admin/settings` | `settings.read` | All keys |
| PUT | `/admin/settings/:key` | `settings.write` | Value validated by a per-key Zod schema; audit logged |

---

## Frontend interaction → API coverage checklist

| Existing interaction | API |
|---|---|
| Login form submit | `POST /auth/login` |
| "Lost your password?" | `POST /auth/password/forgot` (+ new reset page → `POST /auth/password/reset`) |
| Register form submit | `POST /auth/register` |
| Header account CTA state | `GET /auth/session` |
| Contact form submit | `POST /leads` (`contact_form`) |
| Request callback | `POST /leads` (`callback`) |
| Services "Request service" | → `/contact` → `POST /leads` (`data_recovery_service`) |
| Verify certificate submit | `GET /certificates/verify/:code` |
| Buy Now (`/pricing`) | `POST /checkout/orders` → Razorpay Checkout → `POST /checkout/verify` (+ webhook) |
| Price, sale label, countdown | `GET /plans/professional` |
| Training explorer, track pages, header dropdown | `GET /courses`, `GET /courses/:slug` |
| Lesson click | `POST /lessons/:id/playback` (new player page) |
| Demo filters, search, pagination, featured | `GET /demo-videos`, `GET /demo-videos/featured` |
| Demo play | `GET /demo-videos/:slug` + `POST /demo-videos/:id/view` |
| Blog list / post | `GET /blog`, `GET /blog/:slug` |
| Footer contact and social links | `GET /settings/public` |
| Ask on WhatsApp / floating WhatsApp | none (client link) |

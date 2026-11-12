# Alpha Recover — Product Requirements (PRD)

**Last reviewed:** 2026-11-12 · **Status:** Draft for approval
**Related:** [ARCHITECTURE.md](ARCHITECTURE.md) · [DATABASE.md](DATABASE.md) · [API.md](API.md) · [SECURITY.md](SECURITY.md) · [TESTING.md](TESTING.md) · [PLAN.md](PLAN.md) · audit snapshot: [archive/2026-11-12-backend-audit.md](archive/2026-11-12-backend-audit.md)

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
See Phase 6 in [PLAN.md](PLAN.md) and the `/admin` API group in [API.md](API.md). Modules: dashboard, students, courses, plans and promotions, demo videos, enrollments, orders and payments, leads, blog, certificates, notifications log, admin users and roles, reports, activity logs, settings.

---

## 4. Architecture

Moved to [ARCHITECTURE.md](ARCHITECTURE.md): backend stack (§2), hosting requirements checklist (§3), repository layout (§4) and request flow (§5). The API response envelope is defined in [API.md](API.md) §0.

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
5. ✅ **Answered 2026-11-12: the callback form collects a phone number (required); email is optional.** Original question — **Callback form:** collect a phone number instead of (or in addition to) email?
6. **Session limit:** 2 concurrent devices acceptable?
7. **International pricing:** INR only via Razorpay, or add USD via Stripe?
8. **GST invoices:** timing (GSTIN "Pending").
9. **Demo video hosting:** Bunny (consistent) or YouTube unlisted (free, discoverable on your YouTube channel)?
10. **Languages:** marketing mentions 4 languages. Are lessons multilingual (per-language video variants)? This affects the lesson model.
11. **Production hosting:** a VPS (recommended) or a shared cPanel plan that meets every row of the hosting checklist in [ARCHITECTURE.md](ARCHITECTURE.md) §3. Needed before launch (Phase 7); development doesn't depend on it.

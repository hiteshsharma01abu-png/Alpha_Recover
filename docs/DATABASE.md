# Alpha Recover — Database Schema

**Last reviewed:** 2026-11-13 · Related: [ARCHITECTURE.md](ARCHITECTURE.md) · [API.md](API.md)

**Database:** MySQL 8.0+ (MariaDB 10.6+ compatible subset) · **Engine:** InnoDB, `utf8mb4` · **ORM:** Drizzle (`mysql2`) · **Status:** Proposal, nothing created

> **Why MySQL:** hosting is undecided and cPanel shared hosting is a likely target. MySQL/MariaDB is available on every cPanel host and every VPS; PostgreSQL usually isn't on shared hosting. The design avoids Postgres-only features so it also runs on a VPS or managed MySQL.
**Date:** 2026-11-12

## Conventions

- **Primary keys:** `id char(36)` holding a UUIDv7 (time-ordered, generated in the app), unless noted.
- **Timestamps:** `created_at datetime(3) not null default current_timestamp(3)`, `updated_at datetime(3) not null default current_timestamp(3) on update current_timestamp(3)` on every mutable table. **All datetimes are UTC** (connection `time_zone = '+00:00'`); the API returns ISO-8601 with `Z`.
- **Soft delete:** `deleted_at datetime(3) null` where noted. Default queries filter `deleted_at is null`. Money and audit tables are **never** deleted.
- **Money:** integer **paise** (`amount_paise integer`), plus `currency char(3)` (default `'INR'`). Never floats.
- **Emails:** `varchar(254)`, normalized to lower case in the app; case-insensitive collation `utf8mb4_0900_ai_ci` (MariaDB: `utf8mb4_unicode_ci`).
- **JSON:** native `json` columns (arrays such as `tags` and `features` are JSON arrays).
- **Enums:** MySQL `ENUM` columns, values listed per table.
- **No partial indexes in MySQL.** Where a uniqueness rule applies to only some rows (e.g. one *active* enrollment), a **stored generated column** that is `NULL` for the other rows carries the unique index (MySQL allows many `NULL`s in a unique index). **MariaDB forbids `CHAR` columns inside generated-column expressions** (error 1901), so keep the generated column a flag (`if(condition, 1, null)`) and put the id columns in the composite unique index instead of concatenating them.
- **Soft delete + unique slugs/emails:** on soft delete the app rewrites the unique value (`slug` → `slug~deleted~<id>`, `email` → `deleted+<id>@invalid`) so a plain unique index still works and the value can be reused.
- **Naming:** `snake_case` tables (plural) and columns. Foreign keys are `<entity>_id`.
- **Slugs:** existing frontend IDs are kept as slugs (`logical`, `firmware-basic`, `mrt`, `d1`…), so current URLs like `/training/logical` keep working.

## Entity overview

| # | Table | Purpose | Soft delete |
|---|---|---|---|
| 1 | `users` | Students and staff accounts | yes |
| 2 | `accounts` | Credential storage (password hash) — Better Auth | no |
| 3 | `sessions` | Login sessions (cookie-backed) — Better Auth | no (expire) |
| 4 | `verifications` | Email-verify and password-reset tokens — Better Auth | no (expire) |
| 5 | `courses` | Training tracks (9 today) | yes |
| 6 | `course_modules` | Modules within a track (16 today) | yes |
| 7 | `lessons` | Lessons (117 today) | yes |
| 8 | `lesson_progress` | Per-student lesson progress | no |
| 9 | `plans` | Purchasable plans ("Professional Plan") | yes |
| 10 | `plan_courses` | Which courses a plan grants | no |
| 11 | `promotions` | Time-boxed sale prices (drives the countdown) | yes |
| 12 | `orders` | Purchase intents and their lifecycle | **never** |
| 13 | `payments` | Gateway payment records | **never** |
| 14 | `payment_webhook_events` | Raw webhook log, used for idempotency | **never** |
| 15 | `enrollments` | Access grants (purchase or manual) | no (status) |
| 16 | `leads` | Contact form and callback inquiries | yes |
| 17 | `lead_notes` | Follow-up notes and status history | no |
| 18 | `demo_videos` | Public demo video catalog | yes |
| 19 | `certificates` | Issued certificates and verification | no (status) |
| 20 | `certificate_sequences` | Per-year counter for certificate codes | no |
| 21 | `blog_posts` | Blog CMS | yes |
| 22 | `site_settings` | Key/value public and operational settings | no |
| 23 | `notification_jobs` | Email/WhatsApp outbox with retries | no |
| 24 | `activity_logs` | Audit trail of admin and security events | **never** |
| 25 | `rate_limit_buckets` | Request counters for rate limiting (replaces Redis, so no extra service is needed on any host) | no (expire) |

**Deliberately not created** (no UI or flow needs them yet): `coupons` (no coupon field; extension point described in §Future), `learning_materials` (no UI; see §Future), in-app `notifications` (no notification UI), a separate `students` table (a role on `users` is enough), and a separate `admin_users` table (same reason).

---

## 1. `users`

> **Implemented (Phase 1)** together with `accounts`, `sessions`, `verifications`, `site_settings`, `notification_jobs`, `activity_logs` and `rate_limit_buckets`. For these tables, [`server/db/schema.ts`](../server/db/schema.ts) is now the source of truth for columns; this doc keeps the rules and relationships. Better Auth fields are mapped to these columns (its `name` → `first_name`).

| Column | Type | Constraints / notes |
|---|---|---|
| id | char(36) | PK |
| email | varchar(254) | not null, **unique** |
| email_verified | boolean | not null default false |
| first_name | varchar(80) | not null (register form) |
| last_name | varchar(80) | null (not in UI yet; for certificates) |
| certificate_name | varchar(160) | null; full name to print on certificates (falls back to first + last) |
| image | varchar(500) | null; avatar URL (required column for Better Auth; unused by the UI) |
| phone | varchar(20) | null; stored E.164 (`+916355197917`) |
| country | varchar(2) | not null; ISO-3166 alpha-2 (`IN`, `US`, `GB`, `AE`, `ZZ` for "Other") |
| role | enum `user_role` | not null default `'student'`; `student`, `support`, `content_manager`, `admin`, `super_admin` |
| status | enum `user_status` | not null default `'active'`; `active`, `suspended` |
| terms_accepted_at | datetime(3) | not null (register requires the terms checkbox) |
| whatsapp_opt_in_at | datetime(3) | null (consent timestamp) |
| last_login_at | datetime(3) | null |
| created_at / updated_at / deleted_at | datetime(3) | |

**Indexes:** unique(`email`) (soft delete rewrites the email, see Conventions); (`role`); (`created_at`).
**Validation:** valid email ≤ 254 chars; first_name 1–80 chars after trim; phone matches E.164 if present; country in allowed list.
**Relationships:** 1–N `sessions`, `accounts`, `enrollments`, `orders`, `lesson_progress`, `certificates`; staff 1–N `leads.assigned_to`, `activity_logs.actor_id`.

## 2. `accounts` (Better Auth)

| Column | Type | Notes |
|---|---|---|
| id | char(36) | PK |
| user_id | char(36) | FK → users.id, on delete cascade |
| provider_id | varchar(32) | `'credential'` (future: `'google'`) |
| account_id | varchar(255) | provider's account ID (equals user ID for credentials) |
| password | text | **scrypt hash** (Better Auth); null for OAuth |
| created_at / updated_at | datetime(3) | |

**Indexes:** unique(`provider_id`, `account_id`); (`user_id`).

## 3. `sessions` (Better Auth)

| Column | Type | Notes |
|---|---|---|
| id | char(36) | PK |
| user_id | char(36) | FK → users.id, on delete cascade |
| token | varchar(255) | **unique**; random. Only a hash is stored when the library supports it |
| expires_at | datetime(3) | not null (12h, or 30d with "remember me") |
| ip_address | varchar(45) | null |
| user_agent | text | null |
| created_at / updated_at | datetime(3) | |

**Indexes:** unique(`token`); (`user_id`, `created_at`) for the session-limit eviction query; (`expires_at`) for cleanup.
**Rule:** on login, if a student has ≥ `max_student_sessions` (setting, default 2) live sessions, delete the oldest.

## 4. `verifications` (Better Auth)

| Column | Type | Notes |
|---|---|---|
| id | char(36) | PK |
| identifier | varchar(255) | e.g. `email-verify:<email>`, `reset:<email>` |
| value | varchar(255) | token (hashed) |
| expires_at | datetime(3) | verify 24h, reset 1h |
| created_at / updated_at | datetime(3) | |

**Indexes:** (`identifier`); (`expires_at`).

## 5. `courses`

> **Implemented (Phase 2)** with `course_modules` and `lessons`. Seeded insert-only from `src/data/content.ts` by `server/db/seed.ts` (`npm run db:seed`): existing slugs are never updated, so admin edits survive re-runs.

| Column | Type | Constraints / notes |
|---|---|---|
| id | char(36) | PK |
| slug | varchar(64) | **unique**; `logical`, `electrical`, `mechanical`, `firmware-basic`, `mrt`, `media`, `electronics`, `basics`, `bitlocker` |
| title | varchar(160) | not null |
| summary | text | not null |
| image_url | text | null (currently `trainingTrackImages`) |
| sort_order | integer | not null default 0 |
| status | enum `publish_status` | `draft`, `published`, `archived`; default `draft` |
| created_at / updated_at / deleted_at | datetime(3) | |

**Indexes:** unique(`slug`) (soft delete rewrites the slug); (`status`, `sort_order`).

## 6. `course_modules`

| Column | Type | Notes |
|---|---|---|
| id | char(36) | PK |
| course_id | char(36) | FK → courses.id, on delete restrict |
| slug | varchar(64) | e.g. `logical-core`, `expert`; unique per course |
| title | varchar(160) | not null |
| sort_order | integer | not null default 0 |
| created_at / updated_at / deleted_at | datetime(3) | |

**Indexes:** unique(`course_id`, `slug`); (`course_id`, `sort_order`).

## 7. `lessons`

| Column | Type | Notes |
|---|---|---|
| id | char(36) | PK |
| module_id | char(36) | FK → course_modules.id, on delete restrict |
| slug | varchar(64) | existing IDs (`l1`, `e1`…); unique per module |
| title | varchar(200) | not null |
| description | text | null |
| video_provider | enum `video_provider` | `bunny` (future: `youtube`) |
| video_id | varchar(128) | null until uploaded; **never returned by public APIs** |
| duration_seconds | integer | null; ≥ 0 |
| is_preview | boolean | not null default false; playable without enrollment |
| sort_order | integer | not null default 0 |
| status | enum `publish_status` | default `draft` |
| created_at / updated_at / deleted_at | datetime(3) | |

**Indexes:** unique(`module_id`, `slug`); (`module_id`, `sort_order`); (`status`).
**Rule:** `published` controls visibility in the catalog. A published lesson without `video_id` is listed as "coming soon" (`hasVideo: false` in the API) and can't be played. That matches the current site, which lists all 117 lesson titles before any video exists.

## 8. `lesson_progress`

| Column | Type | Notes |
|---|---|---|
| user_id | char(36) | FK → users.id, cascade |
| lesson_id | char(36) | FK → lessons.id, cascade |
| position_seconds | integer | not null default 0 (resume point) |
| watched_seconds | integer | not null default 0 (monotonic max) |
| completed_at | datetime(3) | null; set when watched ≥ 90% of duration or marked complete |
| updated_at | datetime(3) | |

**PK:** (`user_id`, `lesson_id`). **Indexes:** (`user_id`, `updated_at desc`) for "continue learning".

## 9. `plans`

> **Implemented (Phase 2)** with `plan_courses` and `promotions`. Seeded insert-only: the Professional Plan at ₹5,999, plus the Festival Sale promotion (₹2,500, 1 Nov – 30 Nov 2026 11:59 PM IST), created only together with a new plan so re-runs never duplicate it. The sale dates live in `pricing.saleStartsAt` / `saleEndsAt` in `src/data/content.ts`, which also drives the offline fallback.

| Column | Type | Notes |
|---|---|---|
| id | char(36) | PK |
| slug | varchar(64) | **unique**; `professional` |
| name | varchar(120) | "Professional Plan" |
| description | text | null |
| price_paise | integer | not null, > 0 (base price; ₹5,999 = 599900) |
| compare_at_paise | integer | null (strike-through "was" price when no promotion is active) |
| currency | char(3) | default `'INR'` |
| features | json | ordered string array (the 17 features) |
| mobile_feature_order | json | null; index list for the mobile preview (currently `pricingMobileFeatureIndexes`) |
| grants_all_courses | boolean | not null default true ("All upcoming course access") |
| access_days | integer | null = lifetime |
| status | enum `publish_status` | |
| sort_order | integer | |
| created_at / updated_at / deleted_at | datetime(3) | |

**Indexes:** unique(`slug`); (`status`, `sort_order`).

## 10. `plan_courses`

| Column | Type | Notes |
|---|---|---|
| plan_id | char(36) | FK → plans.id, cascade |
| course_id | char(36) | FK → courses.id, cascade |

**PK:** (`plan_id`, `course_id`). Used only when `plans.grants_all_courses = false`.

## 11. `promotions`

| Column | Type | Notes |
|---|---|---|
| id | char(36) | PK |
| plan_id | char(36) | FK → plans.id |
| label | varchar(120) | "Festival Sale – Up to 60% Off" |
| sale_price_paise | integer | not null, > 0, < plan price |
| starts_at | datetime(3) | not null |
| ends_at | datetime(3) | not null, > starts_at (countdown target) |
| is_active | boolean | not null default true (kill switch) |
| created_by | char(36) | FK → users.id |
| created_at / updated_at / deleted_at | datetime(3) | |

**Indexes:** (`plan_id`, `is_active`, `starts_at`, `ends_at`).
**Rule:** at most one active promotion per plan at any instant. Enforced in the service: inside a transaction, lock the plan row (`SELECT … FROM plans WHERE id = ? FOR UPDATE`), then reject (422) if any active, non-deleted promotion overlaps `[starts_at, ends_at)`.

## 12. `orders`

| Column | Type | Notes |
|---|---|---|
| id | char(36) | PK |
| order_number | varchar(24) | **unique**, human-readable `AR-ORD-2026-000123` |
| user_id | char(36) | FK → users.id, restrict |
| plan_id | char(36) | FK → plans.id, restrict |
| promotion_id | char(36) | FK → promotions.id, null |
| amount_paise | integer | not null; **server-computed** at creation |
| currency | char(3) | `'INR'` |
| status | enum `order_status` | `created`, `paid`, `failed`, `cancelled`, `refunded`, `partially_refunded` |
| provider | enum `payment_provider` | `razorpay` |
| provider_order_id | varchar(64) | **unique**; Razorpay `order_…` |
| billing_name | varchar(160) | snapshot |
| billing_email | varchar(254) | snapshot |
| billing_phone | varchar(20) | null |
| billing_country | varchar(2) | |
| gstin | varchar(15) | null (B2B buyer GST) |
| paid_at | datetime(3) | null |
| expires_at | datetime(3) | created + 30 min; stale `created` orders become `cancelled` |
| created_at / updated_at | datetime(3) | |

**Indexes:** unique(`order_number`), unique(`provider_order_id`), (`user_id`, `created_at desc`), (`status`, `created_at`).
**Rule:** one open (`created`, unexpired) order per user per plan. A repeat checkout reuses it. A user with an active enrollment for the plan can't create an order (409).

## 13. `payments`

| Column | Type | Notes |
|---|---|---|
| id | char(36) | PK |
| order_id | char(36) | FK → orders.id, restrict |
| provider_payment_id | varchar(64) | **unique**; Razorpay `pay_…` |
| amount_paise | integer | not null |
| status | enum `payment_status` | `authorized`, `captured`, `failed`, `refunded`, `partially_refunded` |
| method | varchar(32) | `upi`, `card`, `netbanking`, `wallet`… |
| refunded_paise | integer | not null default 0 |
| refunded_at | datetime(3) | null |
| error_code / error_description | varchar(64) / text | null |
| raw | json | last gateway payload (no card data is ever sent by Razorpay) |
| captured_at | datetime(3) | null |
| created_at / updated_at | datetime(3) | |

**Indexes:** unique(`provider_payment_id`), (`order_id`).

## 14. `payment_webhook_events`

| Column | Type | Notes |
|---|---|---|
| id | char(36) | PK |
| provider | enum `payment_provider` | |
| event_id | varchar(128) | **unique** (`x-razorpay-event-id` header): idempotency key |
| event_type | varchar(64) | `payment.captured`, `order.paid`, `payment.failed`, `refund.processed` |
| payload | json | full body |
| signature_valid | boolean | not null |
| processed_at | datetime(3) | null |
| status | enum `webhook_status` | `received`, `processed`, `ignored`, `failed` |
| error | text | null |
| created_at | datetime(3) | |

**Indexes:** unique(`provider`, `event_id`), (`status`, `created_at`).

## 15. `enrollments`

> **Implemented (Phase 3)** with `server/services/enrollments.ts`: `grantEnrollment()` (idempotent per order and per user + plan, safe under concurrency), `revokeEnrollment()`, `accessibleCourseIds()` / `canAccessCourse()` (the access rule below) and `expireEnrollments()` (run by the maintenance cron). **Pending:** the foreign key `order_id → orders.id` is added together with the `orders` table in Phase 5.

| Column | Type | Notes |
|---|---|---|
| id | char(36) | PK |
| user_id | char(36) | FK → users.id, restrict |
| plan_id | char(36) | FK → plans.id, restrict |
| order_id | char(36) | FK → orders.id, null (null for manual grants) |
| source | enum `enrollment_source` | `purchase`, `manual`, `complimentary` |
| status | enum `enrollment_status` | `active`, `revoked`, `expired` |
| starts_at | datetime(3) | not null |
| expires_at | datetime(3) | null = lifetime |
| revoked_at / revoked_reason | datetime(3) / text | null |
| granted_by | char(36) | FK → users.id, null (admin for manual grants) |
| created_at / updated_at | datetime(3) | |

**Generated column:** `active_flag tinyint as (if(status = 'active', 1, null)) stored`.
**Indexes:** unique(`order_id`) (NULLs allowed for manual grants; **idempotent activation**); unique(`active_flag`, `user_id`, `plan_id`) (one active enrollment per user + plan: inactive rows have a NULL flag and never collide); (`user_id`, `status`).
**Access rule:** a user can access course C if an `active`, unexpired enrollment exists for a plan with `grants_all_courses` or a `plan_courses` row for C.

## 16. `leads`

> **Implemented (Phase 2).** `lead_notes` (§17) is implemented with the admin Leads module (migration `0010`).

| Column | Type | Notes |
|---|---|---|
| id | char(36) | PK |
| source | enum `lead_source` | `contact_form`, `callback`, `whatsapp`, `manual` |
| name | varchar(120) | null for callback (email only today) |
| email | varchar(254) | null if phone given (at least one required) |
| phone | varchar(20) | null |
| reason | enum `lead_reason` | `technical_support`, `software_hardware_sale`, `data_recovery_service`, `training`, `other` (exactly the contact form options) |
| message | text | null; ≤ 5000 chars |
| whatsapp_consent | boolean | not null default false |
| status | enum `lead_status` | `new`, `contacted`, `qualified`, `converted`, `closed`, `spam`; default `new` |
| assigned_to | char(36) | FK → users.id (staff), null |
| user_id | char(36) | FK → users.id, null (if submitted while logged in or matched later) |
| page_path | varchar(255) | where it was submitted |
| utm | json | null (`source`, `medium`, `campaign`, …) |
| ip_hash | char(64) | SHA-256 of IP + secret salt (abuse control without storing raw IP) |
| user_agent | text | null |
| created_at / updated_at / deleted_at | datetime(3) | |

**Indexes:** (`status`, `created_at desc`), (`assigned_to`, `status`), (`email`), (`phone`), (`created_at`).

## 17. `lead_notes`

| Column | Type | Notes |
|---|---|---|
| id | char(36) | PK |
| lead_id | char(36) | FK → leads.id, cascade |
| author_id | char(36) | FK → users.id (null for system notes) |
| type | enum | `note`, `call`, `email`, `whatsapp`, `status_change`, `assignment` |
| body | text | |
| from_status / to_status | `lead_status` | null unless `status_change` |
| created_at | datetime(3) | |

**Indexes:** (`lead_id`, `created_at`). **Implemented** (migration `0010_lead_notes`).

## 18. `demo_videos`

> **Implemented (Phase 2)**, seeded insert-only with the six videos from `content.ts` (no video files yet). Search uses `LIKE` instead of FULLTEXT: the catalog is tiny, and FULLTEXT behaves differently on MySQL and MariaDB. `tags_text` was therefore not needed.

| Column | Type | Notes |
|---|---|---|
| id | char(36) | PK |
| slug | varchar(64) | **unique** (`d1`…) |
| title | varchar(200) | not null |
| tag | varchar(40) | display label ("Native Solution", "Logical") |
| category | enum `demo_category` | `logical`, `electrical`, `mechanical`, `firmware` |
| description | text | |
| tags | json | search chips |
| level | enum `skill_level` | `beginner`, `intermediate`, `advanced` |
| duration_seconds | integer | not null |
| video_provider | enum `video_provider` | `bunny` or `youtube` |
| video_id | varchar(128) | not null when published |
| thumbnail_url | text | own storage (replaces Unsplash hotlinks) |
| view_count | integer | not null default 0 |
| is_featured | boolean | not null default false; at most one (partial unique index) |
| status | enum `publish_status` | |
| published_at | datetime(3) | drives the "2 months ago" display |
| sort_order | integer | |
| created_at / updated_at / deleted_at | datetime(3) | |

**Generated columns:** `featured_key tinyint as (if(is_featured and deleted_at is null, 1, null)) stored`; `tags_text varchar(500) as (json_unquote(tags)) stored` (search text).
**Indexes:** unique(`slug`); unique(`featured_key`) (at most one featured video; `featured_key` = `if(is_featured and deleted_at is null, 1, null)` stored); (`status`, `category`, `published_at`).

## 19. `certificates`

> **Implemented (Phase 2)** with `certificate_sequences`: public verification works; issuing (eligibility, PDF, numbering via `allocateCertificateCode()` in `server/services/certificates.ts`) arrives in Phase 4. "plan_id and course_id not both null" is enforced by the issuing service rather than a CHECK constraint.

| Column | Type | Notes |
|---|---|---|
| id | char(36) | PK |
| code | varchar(20) | **unique**, `AR-2026-00421` |
| user_id | char(36) | FK → users.id, restrict |
| plan_id | char(36) | FK → plans.id, null |
| course_id | char(36) | FK → courses.id, null (per-course certificates, if chosen) |
| recipient_name | varchar(160) | snapshot at issue (immutable) |
| program_title | varchar(200) | snapshot ("Professional Data Recovery Training") |
| issued_at | datetime(3) | not null |
| status | enum `certificate_status` | `valid`, `revoked` |
| revoked_at / revoked_reason | datetime(3) / text | null |
| pdf_storage_key | text | null until generated |
| issued_by | char(36) | FK → users.id, null (null = automatic) |
| created_at / updated_at | datetime(3) | |

**Indexes:** unique(`code`), (`user_id`).
**Validation:** `code` matches `^AR-\d{4}-\d{5}$`; plan_id and course_id are not both null.

## 20. `certificate_sequences`

| Column | Type | Notes |
|---|---|---|
| year | integer | PK |
| last_number | integer | not null default 0 (not `last_value`: reserved in MySQL 8) |

Incremented inside the issuing transaction with
``INSERT INTO certificate_sequences (`year`, last_number) VALUES (?, LAST_INSERT_ID(1)) ON DUPLICATE KEY UPDATE last_number = LAST_INSERT_ID(last_number + 1);`` then `SELECT LAST_INSERT_ID();` (row-locked, so it's gap-free and safe under concurrency; works on MySQL and MariaDB).

## 21. `blog_posts`

> **Implemented (Phase 2)**, seeded insert-only with the three posts from `content.ts`. Only excerpts exist, so each `body_markdown` starts as the excerpt until the article is written. `author_id` is nullable (seeded posts have no author).

| Column | Type | Notes |
|---|---|---|
| id | char(36) | PK |
| slug | varchar(120) | **unique** |
| title | varchar(200) | |
| excerpt | varchar(400) | |
| body_markdown | text | rendered and sanitized on the client or server |
| cover_image_url | text | null |
| seo_title / seo_description | varchar(70) / varchar(160) | null |
| author_id | char(36) | FK → users.id |
| status | enum `publish_status` | |
| published_at | datetime(3) | null until published |
| created_at / updated_at / deleted_at | datetime(3) | |

**Indexes:** unique(`slug`) (soft delete rewrites the slug); (`status`, `published_at`).

## 22. `site_settings`

> **Implemented (Phase 1–2).** Live keys: `lead_notification_emails` (private, seeded by migration), `company` and `social_links` (public, seeded insert-only by `server/db/seed.ts` from `content.ts`). Values are validated per key by `settingSchemas` in `server/settings.ts`. The social links are placeholders until the owner provides real profile URLs.

| Column | Type | Notes |
|---|---|---|
| key | varchar(64) | PK |
| value | json | not null |
| is_public | boolean | not null default false |
| updated_by | char(36) | FK → users.id |
| updated_at | datetime(3) | |

**Seed keys:** `company` (public: name, email, phone, whatsapp, address, hours, replyNote, visitNote), `social_links` (public), `max_student_sessions` (2), `certificate_criteria` (`{ "type": "all_lessons_completed" }`), `refund_revokes_access` (true), `lead_notification_emails` (array), `require_verified_email_for_purchase` (true).
Values are validated per key with Zod.

## 23. `notification_jobs`

| Column | Type | Notes |
|---|---|---|
| id | char(36) | PK |
| channel | enum `notification_channel` | `email`, `whatsapp` |
| template | varchar(64) | `verify_email`, `password_reset`, `order_receipt`, `enrollment_welcome`, `lead_ack`, `lead_alert`, `certificate_issued`, `refund_processed` |
| to_address | varchar(254) | email or E.164 phone |
| payload | json | template variables |
| status | enum `job_status` | `pending`, `sending`, `sent`, `failed`, `dead` |
| attempts | smallint | default 0; max 5, exponential backoff |
| next_attempt_at | datetime(3) | |
| provider_message_id | varchar(128) | null |
| last_error | text | null |
| created_at / updated_at / sent_at | datetime(3) | |

**Indexes:** (`status`, `next_attempt_at`); (`template`, `created_at`).

## 24. `activity_logs`

| Column | Type | Notes |
|---|---|---|
| id | bigint unsigned | PK (AUTO_INCREMENT) |
| actor_id | char(36) | FK → users.id, null (system/webhook) |
| actor_role | `user_role` | snapshot |
| action | varchar(64) | `enrollment.grant`, `order.refund`, `certificate.revoke`, `user.suspend`, `auth.login_failed`, `settings.update`… |
| entity_type | varchar(32) | |
| entity_id | varchar(64) | |
| metadata | json | before/after diff (no secrets, no password hashes) |
| ip_hash | char(64) | |
| request_id | varchar(40) | |
| created_at | datetime(3) | |

**Indexes:** (`entity_type`, `entity_id`, `created_at desc`), (`actor_id`, `created_at desc`), (`action`, `created_at desc`). Append-only: the app's repository layer exposes insert/select only. On a VPS, also revoke UPDATE/DELETE on this table from the app's DB user (cPanel only grants privileges per database, so there it's app-enforced).

## 25. `rate_limit_buckets`

| Column | Type | Notes |
|---|---|---|
| bucket_key | varchar(191) | PK, e.g. `login:<ipHash>:<emailHash>`, `leads:<ipHash>` |
| window_start | datetime(3) | start of the fixed window |
| hits | int unsigned | |
| expires_at | datetime(3) | |

Updated atomically with `INSERT … ON DUPLICATE KEY UPDATE hits = IF(window_start < ?, 1, hits + 1), window_start = …`. Expired rows are deleted by the maintenance cron. **Indexes:** (`expires_at`).
If traffic outgrows this (thousands of requests a second), swap in Redis behind the same `rateLimit()` interface.

---

## Relationship diagram

```
users ─┬─< sessions / accounts
       ├─< enrollments >── plans ──< plan_courses >── courses ──< course_modules ──< lessons
       ├─< orders ──< payments                │                                       │
       │     └──────────── enrollments.order_id                                       │
       ├─< lesson_progress >──────────────────────────────────────────────────────────┘
       ├─< certificates >── plans / courses
       ├─< leads (assigned_to, user_id) ──< lead_notes
       ├─< blog_posts (author)
       └─< activity_logs (actor)
plans ──< promotions          orders >── promotions
demo_videos, site_settings, notification_jobs, payment_webhook_events, certificate_sequences, rate_limit_buckets (standalone)
```

## Seed / migration-from-static plan

A one-time seed script (written in Phase 2, run only after approval) imports the current `src/data/content.ts`:
- 9 `courses`, 16 `course_modules`, 117 `lessons`, all `published` (lesson videos are attached later; until then they show as "coming soon"). **Done (Phase 2).**
- 1 `plan` (`professional`, ₹5,999 base) plus 1 `promotion` (₹2,500, "Festival Sale – Up to 60% Off", with real start/end dates you supply).
- 6 `demo_videos` (thumbnails re-hosted; video IDs added when uploaded).
- 3 `blog_posts` (excerpt only; body to be written).
- `site_settings.company`, `social_links`.

## Future extensions (not in scope; reserved)

- **`coupons`** (`code` unique, `type` percent|flat, `value`, `max_redemptions`, `per_user_limit`, `valid_from/to`, `plan_ids`) plus `orders.coupon_id`. Add when a coupon field is designed.
- **`learning_materials`** (`course_id` / `lesson_id`, `title`, `storage_key`, `mime`, `size_bytes`, `access` = enrolled). Add when the lesson page UI includes downloads or for "firmware software access".
- **`lesson_video_variants`** (`lesson_id`, `language`, `video_id`) if lessons are recorded in multiple languages.

# Alpha Recover — Backend Database Schema (Proposal)

**Database:** PostgreSQL 16 (Neon) · **ORM:** Drizzle · **Status:** Proposal, nothing created
**Date:** 2026-11-12

## Conventions

- **Primary keys:** `id uuid` (UUIDv7, time-ordered), unless noted.
- **Timestamps:** `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` (updated by the app) on every mutable table.
- **Soft delete:** `deleted_at timestamptz null` where noted. Default queries filter `deleted_at is null`. Money and audit tables are **never** deleted.
- **Money:** integer **paise** (`amount_paise integer`), plus `currency char(3)` (default `'INR'`). Never floats.
- **Emails:** `citext` (case-insensitive unique).
- **Enums:** Postgres enums, listed per table.
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
| 6 | `course_modules` | Modules within a track (21 today) | yes |
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

**Deliberately not created** (no UI or flow needs them yet): `coupons` (no coupon field; extension point described in §Future), `learning_materials` (no UI; see §Future), in-app `notifications` (no notification UI), a separate `students` table (a role on `users` is enough), and a separate `admin_users` table (same reason).

---

## 1. `users`

| Column | Type | Constraints / notes |
|---|---|---|
| id | uuid | PK |
| email | citext | not null, **unique** |
| email_verified | boolean | not null default false |
| first_name | varchar(80) | not null (register form) |
| last_name | varchar(80) | null (not in UI yet; for certificates) |
| certificate_name | varchar(160) | null; full name to print on certificates (falls back to first + last) |
| phone | varchar(20) | null; stored E.164 (`+916355197917`) |
| country | varchar(2) | not null; ISO-3166 alpha-2 (`IN`, `US`, `GB`, `AE`, `ZZ` for "Other") |
| role | enum `user_role` | not null default `'student'`; `student`, `support`, `content_manager`, `admin`, `super_admin` |
| status | enum `user_status` | not null default `'active'`; `active`, `suspended` |
| terms_accepted_at | timestamptz | not null (register requires the terms checkbox) |
| whatsapp_opt_in_at | timestamptz | null (consent timestamp) |
| last_login_at | timestamptz | null |
| created_at / updated_at / deleted_at | timestamptz | |

**Indexes:** unique(`email`) where `deleted_at is null`; (`role`) where `role <> 'student'`; (`created_at`).
**Validation:** valid email ≤ 254 chars; first_name 1–80 chars after trim; phone matches E.164 if present; country in allowed list.
**Relationships:** 1–N `sessions`, `accounts`, `enrollments`, `orders`, `lesson_progress`, `certificates`; staff 1–N `leads.assigned_to`, `activity_logs.actor_id`.

## 2. `accounts` (Better Auth)

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, on delete cascade |
| provider_id | varchar(32) | `'credential'` (future: `'google'`) |
| account_id | varchar(255) | provider's account ID (equals user ID for credentials) |
| password | text | **argon2id hash**; null for OAuth |
| created_at / updated_at | timestamptz | |

**Indexes:** unique(`provider_id`, `account_id`); (`user_id`).

## 3. `sessions` (Better Auth)

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, on delete cascade |
| token | varchar(255) | **unique**; random. Only a hash is stored when the library supports it |
| expires_at | timestamptz | not null (12h, or 30d with "remember me") |
| ip_address | inet | null |
| user_agent | text | null |
| created_at / updated_at | timestamptz | |

**Indexes:** unique(`token`); (`user_id`, `created_at`) for the session-limit eviction query; (`expires_at`) for cleanup.
**Rule:** on login, if a student has ≥ `max_student_sessions` (setting, default 2) live sessions, delete the oldest.

## 4. `verifications` (Better Auth)

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| identifier | varchar(255) | e.g. `email-verify:<email>`, `reset:<email>` |
| value | varchar(255) | token (hashed) |
| expires_at | timestamptz | verify 24h, reset 1h |
| created_at / updated_at | timestamptz | |

**Indexes:** (`identifier`); (`expires_at`).

## 5. `courses`

| Column | Type | Constraints / notes |
|---|---|---|
| id | uuid | PK |
| slug | varchar(64) | **unique**; `logical`, `electrical`, `mechanical`, `firmware-basic`, `mrt`, `media`, `electronics`, `basics`, `bitlocker` |
| title | varchar(160) | not null |
| summary | text | not null |
| image_url | text | null (currently `trainingTrackImages`) |
| sort_order | integer | not null default 0 |
| status | enum `publish_status` | `draft`, `published`, `archived`; default `draft` |
| created_at / updated_at / deleted_at | timestamptz | |

**Indexes:** unique(`slug`) where `deleted_at is null`; (`status`, `sort_order`).

## 6. `course_modules`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| course_id | uuid | FK → courses.id, on delete restrict |
| slug | varchar(64) | e.g. `logical-core`, `expert`; unique per course |
| title | varchar(160) | not null |
| sort_order | integer | not null default 0 |
| created_at / updated_at / deleted_at | timestamptz | |

**Indexes:** unique(`course_id`, `slug`); (`course_id`, `sort_order`).

## 7. `lessons`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| module_id | uuid | FK → course_modules.id, on delete restrict |
| slug | varchar(64) | existing IDs (`l1`, `e1`…); unique per module |
| title | varchar(200) | not null |
| description | text | null |
| video_provider | enum `video_provider` | `bunny` (future: `youtube`) |
| video_id | varchar(128) | null until uploaded; **never returned by public APIs** |
| duration_seconds | integer | null; ≥ 0 |
| is_preview | boolean | not null default false; playable without enrollment |
| sort_order | integer | not null default 0 |
| status | enum `publish_status` | default `draft` |
| created_at / updated_at / deleted_at | timestamptz | |

**Indexes:** unique(`module_id`, `slug`); (`module_id`, `sort_order`); (`status`).
**Validation:** a lesson can be `published` only if `video_id` is set.

## 8. `lesson_progress`

| Column | Type | Notes |
|---|---|---|
| user_id | uuid | FK → users.id, cascade |
| lesson_id | uuid | FK → lessons.id, cascade |
| position_seconds | integer | not null default 0 (resume point) |
| watched_seconds | integer | not null default 0 (monotonic max) |
| completed_at | timestamptz | null; set when watched ≥ 90% of duration or marked complete |
| updated_at | timestamptz | |

**PK:** (`user_id`, `lesson_id`). **Indexes:** (`user_id`, `updated_at desc`) for "continue learning".

## 9. `plans`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| slug | varchar(64) | **unique**; `professional` |
| name | varchar(120) | "Professional Plan" |
| description | text | null |
| price_paise | integer | not null, > 0 (base price; ₹5,999 = 599900) |
| compare_at_paise | integer | null (strike-through "was" price when no promotion is active) |
| currency | char(3) | default `'INR'` |
| features | jsonb | ordered string array (the 17 features) |
| mobile_feature_order | jsonb | null; index list for the mobile preview (currently `pricingMobileFeatureIndexes`) |
| grants_all_courses | boolean | not null default true ("All upcoming course access") |
| access_days | integer | null = lifetime |
| status | enum `publish_status` | |
| sort_order | integer | |
| created_at / updated_at / deleted_at | timestamptz | |

**Indexes:** unique(`slug`); (`status`, `sort_order`).

## 10. `plan_courses`

| Column | Type | Notes |
|---|---|---|
| plan_id | uuid | FK → plans.id, cascade |
| course_id | uuid | FK → courses.id, cascade |

**PK:** (`plan_id`, `course_id`). Used only when `plans.grants_all_courses = false`.

## 11. `promotions`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| plan_id | uuid | FK → plans.id |
| label | varchar(120) | "Festival Sale – Up to 60% Off" |
| sale_price_paise | integer | not null, > 0, < plan price |
| starts_at | timestamptz | not null |
| ends_at | timestamptz | not null, > starts_at (countdown target) |
| is_active | boolean | not null default true (kill switch) |
| created_by | uuid | FK → users.id |
| created_at / updated_at / deleted_at | timestamptz | |

**Indexes:** (`plan_id`, `starts_at`, `ends_at`) where `is_active and deleted_at is null`.
**Rule:** at most one active promotion per plan at any instant. Enforce with an exclusion constraint on `tstzrange(starts_at, ends_at)` per `plan_id` (needs `btree_gist`), or validate in the service.

## 12. `orders`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| order_number | varchar(24) | **unique**, human-readable `AR-ORD-2026-000123` |
| user_id | uuid | FK → users.id, restrict |
| plan_id | uuid | FK → plans.id, restrict |
| promotion_id | uuid | FK → promotions.id, null |
| amount_paise | integer | not null; **server-computed** at creation |
| currency | char(3) | `'INR'` |
| status | enum `order_status` | `created`, `paid`, `failed`, `cancelled`, `refunded`, `partially_refunded` |
| provider | enum `payment_provider` | `razorpay` |
| provider_order_id | varchar(64) | **unique**; Razorpay `order_…` |
| billing_name | varchar(160) | snapshot |
| billing_email | citext | snapshot |
| billing_phone | varchar(20) | null |
| billing_country | varchar(2) | |
| gstin | varchar(15) | null (B2B buyer GST) |
| paid_at | timestamptz | null |
| expires_at | timestamptz | created + 30 min; stale `created` orders become `cancelled` |
| created_at / updated_at | timestamptz | |

**Indexes:** unique(`order_number`), unique(`provider_order_id`), (`user_id`, `created_at desc`), (`status`, `created_at`).
**Rule:** one open (`created`, unexpired) order per user per plan. A repeat checkout reuses it. A user with an active enrollment for the plan can't create an order (409).

## 13. `payments`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| order_id | uuid | FK → orders.id, restrict |
| provider_payment_id | varchar(64) | **unique**; Razorpay `pay_…` |
| amount_paise | integer | not null |
| status | enum `payment_status` | `authorized`, `captured`, `failed`, `refunded`, `partially_refunded` |
| method | varchar(32) | `upi`, `card`, `netbanking`, `wallet`… |
| refunded_paise | integer | not null default 0 |
| refunded_at | timestamptz | null |
| error_code / error_description | varchar(64) / text | null |
| raw | jsonb | last gateway payload (no card data is ever sent by Razorpay) |
| captured_at | timestamptz | null |
| created_at / updated_at | timestamptz | |

**Indexes:** unique(`provider_payment_id`), (`order_id`).

## 14. `payment_webhook_events`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| provider | enum `payment_provider` | |
| event_id | varchar(128) | **unique** (`x-razorpay-event-id` header): idempotency key |
| event_type | varchar(64) | `payment.captured`, `order.paid`, `payment.failed`, `refund.processed` |
| payload | jsonb | full body |
| signature_valid | boolean | not null |
| processed_at | timestamptz | null |
| status | enum `webhook_status` | `received`, `processed`, `ignored`, `failed` |
| error | text | null |
| created_at | timestamptz | |

**Indexes:** unique(`provider`, `event_id`), (`status`, `created_at`).

## 15. `enrollments`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users.id, restrict |
| plan_id | uuid | FK → plans.id, restrict |
| order_id | uuid | FK → orders.id, null (null for manual grants) |
| source | enum `enrollment_source` | `purchase`, `manual`, `complimentary` |
| status | enum `enrollment_status` | `active`, `revoked`, `expired` |
| starts_at | timestamptz | not null |
| expires_at | timestamptz | null = lifetime |
| revoked_at / revoked_reason | timestamptz / text | null |
| granted_by | uuid | FK → users.id, null (admin for manual grants) |
| created_at / updated_at | timestamptz | |

**Indexes:** unique(`order_id`) where not null (**idempotent activation**); unique(`user_id`, `plan_id`) where `status = 'active'`; (`user_id`, `status`).
**Access rule:** a user can access course C if an `active`, unexpired enrollment exists for a plan with `grants_all_courses` or a `plan_courses` row for C.

## 16. `leads`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| source | enum `lead_source` | `contact_form`, `callback`, `whatsapp`, `manual` |
| name | varchar(120) | null for callback (email only today) |
| email | citext | null if phone given (at least one required) |
| phone | varchar(20) | null |
| reason | enum `lead_reason` | `technical_support`, `software_hardware_sale`, `data_recovery_service`, `training`, `other` (exactly the contact form options) |
| message | text | null; ≤ 5000 chars |
| whatsapp_consent | boolean | not null default false |
| status | enum `lead_status` | `new`, `contacted`, `qualified`, `converted`, `closed`, `spam`; default `new` |
| assigned_to | uuid | FK → users.id (staff), null |
| user_id | uuid | FK → users.id, null (if submitted while logged in or matched later) |
| page_path | varchar(255) | where it was submitted |
| utm | jsonb | null (`source`, `medium`, `campaign`, …) |
| ip_hash | char(64) | SHA-256 of IP + secret salt (abuse control without storing raw IP) |
| user_agent | text | null |
| created_at / updated_at / deleted_at | timestamptz | |

**Indexes:** (`status`, `created_at desc`), (`assigned_to`, `status`), (`email`), (`phone`), (`created_at`).

## 17. `lead_notes`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| lead_id | uuid | FK → leads.id, cascade |
| author_id | uuid | FK → users.id |
| type | enum `lead_note_type` | `note`, `status_change`, `call`, `email`, `whatsapp` |
| body | text | |
| from_status / to_status | `lead_status` | null unless `status_change` |
| created_at | timestamptz | |

**Indexes:** (`lead_id`, `created_at`).

## 18. `demo_videos`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| slug | varchar(64) | **unique** (`d1`…) |
| title | varchar(200) | not null |
| tag | varchar(40) | display label ("Native Solution", "Logical") |
| category | enum `demo_category` | `logical`, `electrical`, `mechanical`, `firmware` |
| description | text | |
| tags | text[] | search chips |
| level | enum `skill_level` | `beginner`, `intermediate`, `advanced` |
| duration_seconds | integer | not null |
| video_provider | enum `video_provider` | `bunny` or `youtube` |
| video_id | varchar(128) | not null when published |
| thumbnail_url | text | own storage (replaces Unsplash hotlinks) |
| view_count | integer | not null default 0 |
| is_featured | boolean | not null default false; at most one (partial unique index) |
| status | enum `publish_status` | |
| published_at | timestamptz | drives the "2 months ago" display |
| sort_order | integer | |
| created_at / updated_at / deleted_at | timestamptz | |

**Indexes:** unique(`slug`); unique(`is_featured`) where `is_featured and deleted_at is null`; (`status`, `category`, `published_at desc`); GIN full-text on `to_tsvector('simple', title || ' ' || tag || ' ' || array_to_string(tags,' '))`.

## 19. `certificates`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| code | varchar(20) | **unique**, `AR-2026-00421` |
| user_id | uuid | FK → users.id, restrict |
| plan_id | uuid | FK → plans.id, null |
| course_id | uuid | FK → courses.id, null (per-course certificates, if chosen) |
| recipient_name | varchar(160) | snapshot at issue (immutable) |
| program_title | varchar(200) | snapshot ("Professional Data Recovery Training") |
| issued_at | timestamptz | not null |
| status | enum `certificate_status` | `valid`, `revoked` |
| revoked_at / revoked_reason | timestamptz / text | null |
| pdf_storage_key | text | null until generated |
| issued_by | uuid | FK → users.id, null (null = automatic) |
| created_at / updated_at | timestamptz | |

**Indexes:** unique(`code`), (`user_id`).
**Validation:** `code` matches `^AR-\d{4}-\d{5}$`; plan_id and course_id are not both null.

## 20. `certificate_sequences`

| Column | Type | Notes |
|---|---|---|
| year | integer | PK |
| last_value | integer | not null default 0 |

Incremented with `UPDATE … SET last_value = last_value + 1 RETURNING last_value` inside the issuing transaction, giving gap-free per-year numbering.

## 21. `blog_posts`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| slug | varchar(120) | **unique** |
| title | varchar(200) | |
| excerpt | varchar(400) | |
| body_markdown | text | rendered and sanitized on the client or server |
| cover_image_url | text | null |
| seo_title / seo_description | varchar(70) / varchar(160) | null |
| author_id | uuid | FK → users.id |
| status | enum `publish_status` | |
| published_at | timestamptz | null until published |
| created_at / updated_at / deleted_at | timestamptz | |

**Indexes:** unique(`slug`) where `deleted_at is null`; (`status`, `published_at desc`).

## 22. `site_settings`

| Column | Type | Notes |
|---|---|---|
| key | varchar(64) | PK |
| value | jsonb | not null |
| is_public | boolean | not null default false |
| updated_by | uuid | FK → users.id |
| updated_at | timestamptz | |

**Seed keys:** `company` (public: name, email, phone, whatsapp, address, hours, replyNote, visitNote), `social_links` (public), `max_student_sessions` (2), `certificate_criteria` (`{ "type": "all_lessons_completed" }`), `refund_revokes_access` (true), `lead_notification_emails` (array), `require_verified_email_for_purchase` (true).
Values are validated per key with Zod.

## 23. `notification_jobs`

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| channel | enum `notification_channel` | `email`, `whatsapp` |
| template | varchar(64) | `verify_email`, `password_reset`, `order_receipt`, `enrollment_welcome`, `lead_ack`, `lead_alert`, `certificate_issued`, `refund_processed` |
| to_address | varchar(254) | email or E.164 phone |
| payload | jsonb | template variables |
| status | enum `job_status` | `pending`, `sending`, `sent`, `failed`, `dead` |
| attempts | smallint | default 0; max 5, exponential backoff |
| next_attempt_at | timestamptz | |
| provider_message_id | varchar(128) | null |
| last_error | text | null |
| created_at / updated_at / sent_at | timestamptz | |

**Indexes:** (`status`, `next_attempt_at`); (`template`, `created_at`).

## 24. `activity_logs`

| Column | Type | Notes |
|---|---|---|
| id | bigint | PK (identity) |
| actor_id | uuid | FK → users.id, null (system/webhook) |
| actor_role | `user_role` | snapshot |
| action | varchar(64) | `enrollment.grant`, `order.refund`, `certificate.revoke`, `user.suspend`, `auth.login_failed`, `settings.update`… |
| entity_type | varchar(32) | |
| entity_id | varchar(64) | |
| metadata | jsonb | before/after diff (no secrets, no password hashes) |
| ip_hash | char(64) | |
| request_id | varchar(40) | |
| created_at | timestamptz | |

**Indexes:** (`entity_type`, `entity_id`, `created_at desc`), (`actor_id`, `created_at desc`), (`action`, `created_at desc`). Append-only (no UPDATE/DELETE grants for the app role).

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
demo_videos, site_settings, notification_jobs, payment_webhook_events, certificate_sequences (standalone)
```

## Seed / migration-from-static plan

A one-time seed script (written in Phase 2, run only after approval) imports the current `src/data/content.ts`:
- 9 `courses`, 21 `course_modules`, 117 `lessons` (`status=draft` until videos are attached; title-only listing stays public).
- 1 `plan` (`professional`, ₹5,999 base) plus 1 `promotion` (₹2,500, "Festival Sale – Up to 60% Off", with real start/end dates you supply).
- 6 `demo_videos` (thumbnails re-hosted; video IDs added when uploaded).
- 3 `blog_posts` (excerpt only; body to be written).
- `site_settings.company`, `social_links`.

## Future extensions (not in scope; reserved)

- **`coupons`** (`code` unique, `type` percent|flat, `value`, `max_redemptions`, `per_user_limit`, `valid_from/to`, `plan_ids`) plus `orders.coupon_id`. Add when a coupon field is designed.
- **`learning_materials`** (`course_id` / `lesson_id`, `title`, `storage_key`, `mime`, `size_bytes`, `access` = enrolled). Add when the lesson page UI includes downloads or for "firmware software access".
- **`lesson_video_variants`** (`lesson_id`, `language`, `video_id`) if lessons are recorded in multiple languages.

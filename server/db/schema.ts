/**
 * Database schema (MySQL 8.0+ / MariaDB 10.6+). Source of truth for columns; docs/DATABASE.md
 * documents relationships and rules. Phase 1 tables only — later phases add their own.
 *
 * Conventions: char(36) UUIDv7 ids, datetime(3) in UTC, snake_case columns.
 * The four auth tables use the JS keys Better Auth expects (see server/auth/auth.ts).
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  datetime,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  smallint,
  text,
  tinyint,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/mysql-core';
import { uuidv7 } from '../lib/ids';

const id = () => char('id', { length: 36 }).primaryKey().$defaultFn(uuidv7);
const ts = (name: string) => datetime(name, { mode: 'date', fsp: 3 });
const createdAt = () => ts('created_at').notNull().default(sql`CURRENT_TIMESTAMP(3)`);
const updatedAt = () =>
  ts('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP(3)`)
    .$onUpdate(() => new Date());

export const USER_ROLES = ['student', 'support', 'content_manager', 'admin', 'super_admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// ── Auth (Better Auth models: user, account, session, verification) ──────────

export const users = mysqlTable(
  'users',
  {
    id: id(),
    email: varchar('email', { length: 254 }).notNull(),
    emailVerified: boolean('email_verified').notNull().default(false),
    /** Better Auth's required `name` field is mapped to this column. */
    firstName: varchar('first_name', { length: 80 }).notNull(),
    lastName: varchar('last_name', { length: 80 }),
    certificateName: varchar('certificate_name', { length: 160 }),
    image: varchar('image', { length: 500 }),
    phone: varchar('phone', { length: 20 }),
    country: varchar('country', { length: 2 }).notNull(),
    role: mysqlEnum('role', USER_ROLES).notNull().default('student'),
    status: mysqlEnum('status', ['active', 'suspended']).notNull().default('active'),
    termsAcceptedAt: ts('terms_accepted_at').notNull(),
    whatsappOptInAt: ts('whatsapp_opt_in_at'),
    lastLoginAt: ts('last_login_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [uniqueIndex('users_email_uq').on(t.email), index('users_role_idx').on(t.role), index('users_created_idx').on(t.createdAt)],
);

export const accounts = mysqlTable(
  'accounts',
  {
    id: id(),
    userId: char('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerId: varchar('provider_id', { length: 32 }).notNull(),
    accountId: varchar('account_id', { length: 255 }).notNull(),
    /** Password hash (scrypt, by Better Auth). Null for OAuth accounts. */
    password: text('password'),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: ts('access_token_expires_at'),
    refreshTokenExpiresAt: ts('refresh_token_expires_at'),
    scope: varchar('scope', { length: 255 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('accounts_provider_uq').on(t.providerId, t.accountId), index('accounts_user_idx').on(t.userId)],
);

export const sessions = mysqlTable(
  'sessions',
  {
    id: id(),
    userId: char('user_id', { length: 36 })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: varchar('token', { length: 255 }).notNull(),
    expiresAt: ts('expires_at').notNull(),
    ipAddress: varchar('ip_address', { length: 45 }),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('sessions_token_uq').on(t.token),
    index('sessions_user_created_idx').on(t.userId, t.createdAt),
    index('sessions_expires_idx').on(t.expiresAt),
  ],
);

export const verifications = mysqlTable(
  'verifications',
  {
    id: id(),
    identifier: varchar('identifier', { length: 255 }).notNull(),
    value: varchar('value', { length: 255 }).notNull(),
    expiresAt: ts('expires_at').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier), index('verifications_expires_idx').on(t.expiresAt)],
);

// ── Platform ─────────────────────────────────────────────────────────────────

export const siteSettings = mysqlTable('site_settings', {
  key: varchar('key', { length: 64 }).primaryKey(),
  value: json('value').notNull(),
  isPublic: boolean('is_public').notNull().default(false),
  updatedBy: char('updated_by', { length: 36 }).references(() => users.id),
  updatedAt: updatedAt(),
});

export const notificationJobs = mysqlTable(
  'notification_jobs',
  {
    id: id(),
    channel: mysqlEnum('channel', ['email', 'whatsapp']).notNull(),
    template: varchar('template', { length: 64 }).notNull(),
    toAddress: varchar('to_address', { length: 254 }).notNull(),
    payload: json('payload').notNull(),
    status: mysqlEnum('status', ['pending', 'sending', 'sent', 'failed', 'dead']).notNull().default('pending'),
    attempts: smallint('attempts').notNull().default(0),
    nextAttemptAt: ts('next_attempt_at').notNull().default(sql`CURRENT_TIMESTAMP(3)`),
    providerMessageId: varchar('provider_message_id', { length: 128 }),
    lastError: text('last_error'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    sentAt: ts('sent_at'),
  },
  (t) => [
    index('notification_jobs_due_idx').on(t.status, t.nextAttemptAt),
    index('notification_jobs_template_idx').on(t.template, t.createdAt),
  ],
);

export const activityLogs = mysqlTable(
  'activity_logs',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    actorId: char('actor_id', { length: 36 }).references(() => users.id),
    actorRole: mysqlEnum('actor_role', USER_ROLES),
    action: varchar('action', { length: 64 }).notNull(),
    entityType: varchar('entity_type', { length: 32 }),
    entityId: varchar('entity_id', { length: 64 }),
    metadata: json('metadata'),
    ipHash: char('ip_hash', { length: 64 }),
    requestId: varchar('request_id', { length: 40 }),
    createdAt: createdAt(),
  },
  (t) => [
    index('activity_logs_entity_idx').on(t.entityType, t.entityId, t.createdAt),
    index('activity_logs_actor_idx').on(t.actorId, t.createdAt),
    index('activity_logs_action_idx').on(t.action, t.createdAt),
  ],
);

// ── Catalog (Phase 2) ────────────────────────────────────────────────────────

export const PUBLISH_STATUSES = ['draft', 'published', 'archived'] as const;

export const courses = mysqlTable(
  'courses',
  {
    id: id(),
    /** Existing frontend ids are kept as slugs, so /training/logical keeps working. */
    slug: varchar('slug', { length: 64 }).notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    summary: text('summary').notNull(),
    imageUrl: varchar('image_url', { length: 500 }),
    sortOrder: int('sort_order').notNull().default(0),
    status: mysqlEnum('status', PUBLISH_STATUSES).notNull().default('draft'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [uniqueIndex('courses_slug_uq').on(t.slug), index('courses_status_sort_idx').on(t.status, t.sortOrder)],
);

export const courseModules = mysqlTable(
  'course_modules',
  {
    id: id(),
    courseId: char('course_id', { length: 36 })
      .notNull()
      .references(() => courses.id, { onDelete: 'restrict' }),
    slug: varchar('slug', { length: 64 }).notNull(),
    title: varchar('title', { length: 160 }).notNull(),
    sortOrder: int('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [uniqueIndex('course_modules_course_slug_uq').on(t.courseId, t.slug), index('course_modules_course_sort_idx').on(t.courseId, t.sortOrder)],
);

export const lessons = mysqlTable(
  'lessons',
  {
    id: id(),
    moduleId: char('module_id', { length: 36 })
      .notNull()
      .references(() => courseModules.id, { onDelete: 'restrict' }),
    slug: varchar('slug', { length: 64 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    videoProvider: mysqlEnum('video_provider', ['bunny', 'youtube']),
    /** Never returned by public APIs; playback goes through signed URLs (Phase 4). */
    videoId: varchar('video_id', { length: 128 }),
    durationSeconds: int('duration_seconds', { unsigned: true }),
    isPreview: boolean('is_preview').notNull().default(false),
    sortOrder: int('sort_order').notNull().default(0),
    status: mysqlEnum('status', PUBLISH_STATUSES).notNull().default('draft'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    uniqueIndex('lessons_module_slug_uq').on(t.moduleId, t.slug),
    index('lessons_module_sort_idx').on(t.moduleId, t.sortOrder),
    index('lessons_status_idx').on(t.status),
  ],
);

// ── Plans & promotions (Phase 2) ─────────────────────────────────────────────

export const plans = mysqlTable(
  'plans',
  {
    id: id(),
    slug: varchar('slug', { length: 64 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    /** Base price in paise (₹5,999 = 599900). Money is never stored as a float. */
    pricePaise: int('price_paise', { unsigned: true }).notNull(),
    /** Optional strike-through "was" price when no promotion is active. */
    compareAtPaise: int('compare_at_paise', { unsigned: true }),
    currency: char('currency', { length: 3 }).notNull().default('INR'),
    features: json('features').$type<string[]>().notNull(),
    mobileFeatureOrder: json('mobile_feature_order').$type<number[]>(),
    grantsAllCourses: boolean('grants_all_courses').notNull().default(true),
    /** null = lifetime access */
    accessDays: int('access_days', { unsigned: true }),
    status: mysqlEnum('status', PUBLISH_STATUSES).notNull().default('draft'),
    sortOrder: int('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [uniqueIndex('plans_slug_uq').on(t.slug), index('plans_status_sort_idx').on(t.status, t.sortOrder)],
);

export const planCourses = mysqlTable(
  'plan_courses',
  {
    planId: char('plan_id', { length: 36 })
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    courseId: char('course_id', { length: 36 })
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.planId, t.courseId] })],
);

export const promotions = mysqlTable(
  'promotions',
  {
    id: id(),
    planId: char('plan_id', { length: 36 })
      .notNull()
      .references(() => plans.id),
    label: varchar('label', { length: 120 }).notNull(),
    salePricePaise: int('sale_price_paise', { unsigned: true }).notNull(),
    startsAt: ts('starts_at').notNull(),
    endsAt: ts('ends_at').notNull(),
    /** Kill switch: end a sale early without deleting it. */
    isActive: boolean('is_active').notNull().default(true),
    createdBy: char('created_by', { length: 36 }).references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [index('promotions_plan_window_idx').on(t.planId, t.isActive, t.startsAt, t.endsAt)],
);

// ── Demo videos (Phase 2) ────────────────────────────────────────────────────

export const DEMO_CATEGORIES = ['logical', 'electrical', 'mechanical', 'firmware'] as const;
export const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

export const demoVideos = mysqlTable(
  'demo_videos',
  {
    id: id(),
    slug: varchar('slug', { length: 64 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    /** Display label on the card, e.g. "Native Solution". */
    tag: varchar('tag', { length: 40 }).notNull(),
    category: mysqlEnum('category', DEMO_CATEGORIES).notNull(),
    description: text('description').notNull(),
    tags: json('tags').$type<string[]>().notNull(),
    level: mysqlEnum('level', SKILL_LEVELS).notNull(),
    durationSeconds: int('duration_seconds', { unsigned: true }).notNull(),
    videoProvider: mysqlEnum('video_provider', ['bunny', 'youtube']),
    videoId: varchar('video_id', { length: 128 }),
    thumbnailUrl: varchar('thumbnail_url', { length: 500 }),
    viewCount: int('view_count', { unsigned: true }).notNull().default(0),
    isFeatured: boolean('is_featured').notNull().default(false),
    /** 1 for the featured, non-deleted video, else NULL: the unique index allows only one featured video. */
    featuredKey: tinyint('featured_key').generatedAlwaysAs(sql`if(is_featured and deleted_at is null, 1, null)`, { mode: 'stored' }),
    status: mysqlEnum('status', PUBLISH_STATUSES).notNull().default('draft'),
    publishedAt: ts('published_at'),
    sortOrder: int('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    uniqueIndex('demo_videos_slug_uq').on(t.slug),
    uniqueIndex('demo_videos_featured_uq').on(t.featuredKey),
    index('demo_videos_list_idx').on(t.status, t.category, t.publishedAt),
  ],
);

// ── Leads (Phase 2) ──────────────────────────────────────────────────────────

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'converted', 'closed', 'spam'] as const;

export const leads = mysqlTable(
  'leads',
  {
    id: id(),
    source: mysqlEnum('source', ['contact_form', 'callback', 'whatsapp', 'manual']).notNull(),
    name: varchar('name', { length: 120 }),
    email: varchar('email', { length: 254 }),
    phone: varchar('phone', { length: 20 }),
    reason: mysqlEnum('reason', ['technical_support', 'software_hardware_sale', 'data_recovery_service', 'training', 'other']),
    message: text('message'),
    whatsappConsent: boolean('whatsapp_consent').notNull().default(false),
    status: mysqlEnum('status', LEAD_STATUSES).notNull().default('new'),
    assignedTo: char('assigned_to', { length: 36 }).references(() => users.id),
    userId: char('user_id', { length: 36 }).references(() => users.id),
    pagePath: varchar('page_path', { length: 255 }),
    utm: json('utm'),
    ipHash: char('ip_hash', { length: 64 }),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: ts('deleted_at'),
  },
  (t) => [
    index('leads_status_created_idx').on(t.status, t.createdAt),
    index('leads_assigned_status_idx').on(t.assignedTo, t.status),
    index('leads_email_idx').on(t.email),
    index('leads_phone_idx').on(t.phone),
    index('leads_created_idx').on(t.createdAt),
  ],
);

export const rateLimitBuckets = mysqlTable(
  'rate_limit_buckets',
  {
    bucketKey: varchar('bucket_key', { length: 191 }).primaryKey(),
    windowStart: ts('window_start').notNull(),
    hits: int('hits', { unsigned: true }).notNull(),
    expiresAt: ts('expires_at').notNull(),
  },
  (t) => [index('rate_limit_buckets_expires_idx').on(t.expiresAt)],
);

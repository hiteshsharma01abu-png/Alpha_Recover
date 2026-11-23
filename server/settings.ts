import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from './db';
import { siteSettings } from './db/schema';

const text = z.string().max(300);
/** Rendered as links on the public site, so only https (no javascript:/data: URLs). */
const httpsUrl = z.url({ protocol: /^https$/, error: 'Use an https:// link' });

/** Per-key schemas for `site_settings` values (docs/DATABASE.md §22). */
export const settingSchemas = {
  lead_notification_emails: z.array(z.email()).min(1, 'Add at least one address').max(10),
  /** Concurrent sessions a student may keep; the oldest is signed out beyond this. */
  max_student_sessions: z.number().int().min(1).max(10),
  /** Public contact details (same shape as `company` in src/data/content.ts). */
  company: z.object({
    name: text,
    shortName: text,
    tagline: text,
    email: z.email(),
    phone: text,
    phoneDisplay: text,
    phoneHref: z.string().regex(/^tel:\+?\d{6,15}$/, 'Use tel: followed by the number, e.g. tel:+916355197917'),
    whatsapp: httpsUrl,
    address: text,
    addressFull: text,
    hours: text,
    replyNote: text,
    visitNote: text,
    cin: text,
    gst: text,
  }),
  /** When certificates are issued: automatically once every lesson of a course is complete, or only by staff. */
  certificate_criteria: z.object({ type: z.enum(['all_lessons_completed', 'manual']) }),
  social_links: z.array(
    z.object({ platform: z.enum(['youtube', 'linkedin', 'facebook', 'instagram']), url: httpsUrl }),
  ),
} as const;

export type SettingKey = keyof typeof settingSchemas;

/** Keys the public site reads through GET /settings/public. */
export const PUBLIC_SETTING_KEYS: readonly SettingKey[] = ['company', 'social_links'];
/** Keys that change access rules: editing them needs settings.edit_policies (Super Admin). */
export const POLICY_SETTING_KEYS: readonly SettingKey[] = ['max_student_sessions', 'certificate_criteria'];

/** Default until a Super Admin changes it (owner decision 2026-11-20). */
export const DEFAULT_CERTIFICATE_CRITERIA: SettingValue<'certificate_criteria'> = { type: 'all_lessons_completed' };
export type SettingValue<K extends SettingKey> = z.infer<(typeof settingSchemas)[K]>;

/** Reads and validates a setting; returns `fallback` if it's missing or invalid. */
export async function getSetting<K extends SettingKey>(db: Database, key: K, fallback: SettingValue<K>): Promise<SettingValue<K>> {
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, key));
  const schema = settingSchemas[key] as unknown as z.ZodType<SettingValue<K>>;
  const parsed = schema.safeParse(row?.value);
  return parsed.success ? parsed.data : fallback;
}

/** Public settings for the site (only keys marked is_public, each validated; invalid ones are skipped). */
export async function getPublicSettings(db: Database) {
  const rows = await db
    .select({ key: siteSettings.key, value: siteSettings.value })
    .from(siteSettings)
    .where(inArray(siteSettings.key, ['company', 'social_links']));
  const out: { company?: SettingValue<'company'>; socialLinks?: SettingValue<'social_links'> } = {};
  for (const row of rows) {
    if (row.key === 'company') {
      const p = settingSchemas.company.safeParse(row.value);
      if (p.success) out.company = p.data;
    } else if (row.key === 'social_links') {
      const p = settingSchemas.social_links.safeParse(row.value);
      if (p.success) out.socialLinks = p.data;
    }
  }
  return out;
}

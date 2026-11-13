import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from './db';
import { siteSettings } from './db/schema';

const text = z.string().max(300);

/** Per-key schemas for `site_settings` values (docs/DATABASE.md §22). */
export const settingSchemas = {
  lead_notification_emails: z.array(z.email()).min(1),
  /** Public contact details (same shape as `company` in src/data/content.ts). */
  company: z.object({
    name: text,
    shortName: text,
    tagline: text,
    email: z.email(),
    phone: text,
    phoneDisplay: text,
    phoneHref: text,
    whatsapp: z.url(),
    address: text,
    addressFull: text,
    hours: text,
    replyNote: text,
    visitNote: text,
    cin: text,
    gst: text,
  }),
  social_links: z.array(
    z.object({ platform: z.enum(['youtube', 'linkedin', 'facebook', 'instagram']), url: z.url() }),
  ),
} as const;

export type SettingKey = keyof typeof settingSchemas;
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

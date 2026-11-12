import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from './db';
import { siteSettings } from './db/schema';

/** Per-key schemas for `site_settings` values (docs/DATABASE.md §22). */
export const settingSchemas = {
  lead_notification_emails: z.array(z.email()).min(1),
} as const;

export type SettingKey = keyof typeof settingSchemas;

/** Reads and validates a setting; returns `fallback` if it's missing or invalid. */
export async function getSetting<K extends SettingKey>(
  db: Database,
  key: K,
  fallback: z.infer<(typeof settingSchemas)[K]>,
): Promise<z.infer<(typeof settingSchemas)[K]>> {
  const [row] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, key));
  const parsed = settingSchemas[key].safeParse(row?.value);
  return parsed.success ? parsed.data : fallback;
}

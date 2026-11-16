import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import { can } from '../../../shared/permissions';
import { logActivity } from '../../audit';
import { requireStaff } from '../../auth/middleware';
import { siteSettings, users } from '../../db/schema';
import { AppError } from '../../lib/errors';
import { validate } from '../../lib/validate';
import { POLICY_SETTING_KEYS, PUBLIC_SETTING_KEYS, settingSchemas, type SettingKey } from '../../settings';
import type { AppEnv } from '../../types';

const KEYS = Object.keys(settingSchemas) as [SettingKey, ...SettingKey[]];

/** Policy keys also need settings.edit_policies; checked before the body so the answer is always 403. */
const requirePolicyRight = createMiddleware<AppEnv>(async (c, next) => {
  const key = c.req.param('key') as SettingKey;
  if (POLICY_SETTING_KEYS.includes(key) && !can(c.get('user')!.role, 'settings.edit_policies')) throw new AppError('FORBIDDEN', 'Only a Super Admin can change policies');
  await next();
});

/** JSON with object keys sorted: MySQL reorders keys inside stored JSON, so plain stringify can't compare. */
const canonical = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) =>
    x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x,
  );

/**
 * Settings admin module (docs/admin/NAVIGATION.md §3). Each key has its own schema in
 * server/settings.ts; a missing key means the code default applies (the UI shows that default).
 */
export const adminSettingsRoutes = new Hono<AppEnv>()
  .get('/settings', requireStaff('settings.view'), async (c) => {
    const { db } = c.get('deps');
    const rows = await db
      .select({ key: siteSettings.key, value: siteSettings.value, updatedAt: siteSettings.updatedAt, updatedById: siteSettings.updatedBy, updatedByName: users.firstName })
      .from(siteSettings)
      .leftJoin(users, eq(users.id, siteSettings.updatedBy));
    const data = Object.fromEntries(
      KEYS.map((key) => {
        const row = rows.find((r) => r.key === key);
        // An invalid stored value is reported as unset, matching what the site falls back to.
        const parsed = row ? settingSchemas[key].safeParse(row.value) : null;
        return [
          key,
          {
            value: parsed?.success ? parsed.data : null,
            isPublic: PUBLIC_SETTING_KEYS.includes(key),
            isPolicy: POLICY_SETTING_KEYS.includes(key),
            updatedAt: row?.updatedAt.toISOString() ?? null,
            updatedBy: row?.updatedById ? { id: row.updatedById, firstName: row.updatedByName } : null,
          },
        ];
      }),
    );
    return c.json({ data });
  })

  .put('/settings/:key', requireStaff('settings.edit'), validate('param', z.object({ key: z.enum(KEYS) })), requirePolicyRight, validate('json', z.object({ value: z.unknown() }).strict()), async (c) => {
    const { key } = c.req.valid('param');
    const user = c.get('user')!;
    const parsed = settingSchemas[key].safeParse(c.req.valid('json').value);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => ({ path: ['value', ...i.path].join('.'), message: i.message }));
      throw new AppError('VALIDATION_ERROR', details[0]?.message ?? 'Invalid value', { details });
    }
    const { db } = c.get('deps');
    const [before] = await db.select({ value: siteSettings.value }).from(siteSettings).where(eq(siteSettings.key, key));
    if (before && canonical(before.value) === canonical(parsed.data)) return c.json({ data: { ok: true, changed: false } });

    await db
      .insert(siteSettings)
      .values({ key, value: parsed.data, isPublic: PUBLIC_SETTING_KEYS.includes(key), updatedBy: user.id })
      .onDuplicateKeyUpdate({ set: { value: parsed.data, updatedBy: user.id } });
    await logActivity(c, { action: 'settings.update', entityType: 'setting', entityId: key, metadata: { before: before?.value ?? null, after: parsed.data } });
    return c.json({ data: { ok: true, changed: true } });
  });

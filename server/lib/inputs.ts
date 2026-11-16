/** Shared zod fields for staff-entered values. */
import { z } from 'zod';

/**
 * Staff-entered image the site renders: a bundled site image ("/assets/…") or an https URL (Bunny CDN
 * once uploads exist). Never javascript:/data:/http:.
 */
export const siteImageUrl = z
  .string()
  .trim()
  .max(500)
  .regex(/^(\/assets\/[\w./-]+|https:\/\/[^\s"'<>]+)$/, 'Use a /assets/… path or an https:// URL');

/** "2026-11-30T23:59" in India time. The admin UI always works in IST (docs/admin/UI_UX.md). */
export const istDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Use YYYY-MM-DDTHH:mm (IST)')
  .transform((s, ctx) => {
    const d = new Date(`${s}:00+05:30`);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Not a valid date' });
      return z.NEVER;
    }
    return d;
  });

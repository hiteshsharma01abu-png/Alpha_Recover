/** Pure unit tests — no database needed. */
import { describe, expect, it } from 'vitest';
import { can, isStaff, PERMISSIONS } from './auth/permissions';
import { USER_ROLES } from './db/schema';
import { parseEnv } from './env';
import { uuidv7 } from './lib/ids';
import { backoffMs, MAX_ATTEMPTS } from './notifications/outbox';
import { templates } from './notifications/templates';

describe('uuidv7', () => {
  it('produces RFC 9562 version-7 UUIDs', () => {
    const id = uuidv7();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('is time-ordered and unique', async () => {
    const a = uuidv7();
    await new Promise((r) => setTimeout(r, 2));
    const b = uuidv7();
    expect(a < b).toBe(true);
    expect(new Set(Array.from({ length: 1000 }, uuidv7)).size).toBe(1000);
  });
});

describe('permissions (docs/SECURITY.md §2)', () => {
  it('gives students no permissions', () => {
    expect(PERMISSIONS.some((p) => can('student', p))).toBe(false);
    expect(isStaff('student')).toBe(false);
  });

  it('gives super_admin every permission', () => {
    expect(PERMISSIONS.every((p) => can('super_admin', p))).toBe(true);
  });

  it('keeps settings.write and admins.manage for super_admin only', () => {
    for (const role of USER_ROLES.filter((r) => r !== 'super_admin')) {
      expect(can(role, 'settings.write')).toBe(false);
      expect(can(role, 'admins.manage')).toBe(false);
    }
  });

  it('matches the documented matrix for key cells', () => {
    expect(can('support', 'leads.write')).toBe(true);
    expect(can('support', 'leads.export')).toBe(false);
    expect(can('support', 'orders.refund')).toBe(false);
    expect(can('content_manager', 'courses.write')).toBe(true);
    expect(can('content_manager', 'students.read')).toBe(false);
    expect(can('admin', 'orders.refund')).toBe(true);
    expect(can('admin', 'audit.read')).toBe(true);
  });
});

describe('parseEnv', () => {
  const base = {
    APP_URL: 'http://localhost:5173',
    DATABASE_URL: 'mysql://u:p@localhost/db',
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    CRON_SECRET: 'y'.repeat(32),
    IP_HASH_SALT: 'z'.repeat(32),
  };

  it('accepts a valid configuration and applies defaults', () => {
    const env = parseEnv(base);
    expect(env.PORT).toBe(8787);
    expect(env.NODE_ENV).toBe('development');
    expect(env.POSTMARK_SERVER_TOKEN).toBeUndefined();
  });

  it('lists every problem at once', () => {
    expect(() => parseEnv({ ...base, BETTER_AUTH_SECRET: 'short', DATABASE_URL: 'postgres://x' })).toThrow(
      /BETTER_AUTH_SECRET[\s\S]*DATABASE_URL|DATABASE_URL[\s\S]*BETTER_AUTH_SECRET/,
    );
  });

  it('requires a Postmark token in production', () => {
    expect(() => parseEnv({ ...base, NODE_ENV: 'production' })).toThrow(/POSTMARK_SERVER_TOKEN/);
  });
});

describe('outbox backoff', () => {
  it('doubles from one minute', () => {
    expect([1, 2, 3, 4].map(backoffMs)).toEqual([60_000, 120_000, 240_000, 480_000]);
    expect(MAX_ATTEMPTS).toBe(5);
  });
});

describe('email templates', () => {
  it('escapes user-provided values in HTML', () => {
    const out = templates.verify_email({ firstName: '<script>x</script>', url: 'https://a.test/v?t=1&u=2' });
    expect(out.html).not.toContain('<script>');
    expect(out.html).toContain('&lt;script&gt;');
    expect(out.text).toContain('https://a.test/v?t=1&u=2');
  });
});

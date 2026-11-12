import { z } from 'zod';

const secret = z.string().min(32, 'must be at least 32 characters (use `openssl rand -base64 32`)');
const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),
  APP_URL: z.url(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().startsWith('mysql://'),
  BETTER_AUTH_SECRET: secret,
  CRON_SECRET: secret,
  IP_HASH_SALT: secret,
  TRUSTED_PROXY_HEADER: optional,
  POSTMARK_SERVER_TOKEN: optional,
  EMAIL_FROM: z.string().default('Alpha Recover <info@alpharecover.com>'),
  SENTRY_DSN: optional,
  /** Cloudflare Turnstile (bot protection on public forms). Optional in development. */
  TURNSTILE_SECRET_KEY: optional,
});

export type Env = z.infer<typeof envSchema>;

/** Parses and validates environment variables; throws a readable error listing every problem. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  if (result.data.NODE_ENV === 'production') {
    const missing = (['POSTMARK_SERVER_TOKEN', 'TURNSTILE_SECRET_KEY'] as const).filter((k) => !result.data[k]);
    if (missing.length) {
      throw new Error(`Invalid environment configuration:\n${missing.map((k) => `  - ${k}: required in production`).join('\n')}`);
    }
  }
  return result.data;
}

let cached: Env | undefined;

/** Validated environment, parsed once on first use. */
export function env(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

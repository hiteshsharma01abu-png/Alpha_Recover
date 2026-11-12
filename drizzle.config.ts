import { defineConfig } from 'drizzle-kit';

// `npm run db:generate` turns schema changes into SQL migrations (no database needed).
export default defineConfig({
  dialect: 'mysql',
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL ?? '' },
});

/** Applies pending migrations: `npm run db:migrate` (dev) or `node dist-server/migrate.mjs` (production). */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { createDb } from './index';

export async function runMigrations(databaseUrl: string, migrationsFolder = defaultMigrationsFolder()) {
  const { db, pool } = createDb(databaseUrl);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}

/** `migrations/` next to this file: server/db/migrations in source, dist-server/migrations in the bundle. */
function defaultMigrationsFolder() {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
}

const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntry) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  runMigrations(url)
    .then(() => console.log('Migrations applied'))
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}

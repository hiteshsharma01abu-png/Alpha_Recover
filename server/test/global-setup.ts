import mysql from 'mysql2/promise';
import type { TestProject } from 'vitest/node';
import { runMigrations } from '../db/migrate';
import { testDatabaseUrl } from './helpers';

declare module 'vitest' {
  export interface ProvidedContext {
    dbAvailable: boolean;
  }
}

/**
 * Wipes the test database and applies all migrations once per run.
 * Locally, DB tests are skipped (with a warning) when MySQL isn't running; in CI they must run.
 */
export default async function setup(project: TestProject) {
  const url = testDatabaseUrl();
  let conn: mysql.Connection;
  try {
    conn = await mysql.createConnection({ uri: url, multipleStatements: true });
  } catch (err) {
    if (process.env.CI) throw err;
    console.warn(`\n⚠️  MySQL not reachable at ${url.replace(/\/\/.*@/, '//***@')}; skipping database tests. Run \`npm run db:up\`.\n`);
    project.provide('dbAvailable', false);
    return;
  }
  const [rows] = await conn.query<mysql.RowDataPacket[]>(
    'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()',
  );
  if (rows.length) {
    await conn.query(
      `SET FOREIGN_KEY_CHECKS = 0; ${rows.map((r) => `DROP TABLE IF EXISTS \`${r.name}\``).join('; ')}; SET FOREIGN_KEY_CHECKS = 1;`,
    );
  }
  await conn.end();
  await runMigrations(url);
  project.provide('dbAvailable', true);
}

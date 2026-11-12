import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema';

export type Database = ReturnType<typeof createDb>['db'];

/** Connection pool + Drizzle instance. All datetimes are read and written as UTC. */
export function createDb(databaseUrl: string) {
  const pool = mysql.createPool({
    uri: databaseUrl,
    timezone: 'Z',
    connectionLimit: 5, // shared hosting caps connections; raise on a VPS
    waitForConnections: true,
    enableKeepAlive: true,
  });
  const db = drizzle(pool, { schema, mode: 'default' });
  return { db, pool };
}

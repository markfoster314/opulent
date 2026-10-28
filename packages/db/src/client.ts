import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { databaseUrl, postgresSsl } from './connection-string';
import * as schema from './schema';

export type Database = ReturnType<typeof createDatabase>;

export interface DatabaseOptions {
  connectionString: string;
  /** One connection per Lambda copy. The function concurrency cap keeps the total under the database limit. */
  maxConnections?: number;
  /** On for a direct session. Turn off only if a pool may move the next query to another session. */
  usePreparedStatements?: boolean;
}

export function createDatabase(options: DatabaseOptions) {
  const sql = postgres(options.connectionString, {
    max: options.maxConnections ?? 1,
    prepare: options.usePreparedStatements ?? true,
    idle_timeout: 20,
    connect_timeout: 10,
    ...postgresSsl(options.connectionString),
  });

  return drizzle(sql, { schema, logger: process.env.DB_LOG === 'true' });
}

/** Ends the pool so a one-shot job can exit. An open pool keeps the process alive. */
export async function closeDatabase(db: Database): Promise<void> {
  await db.$client.end({ timeout: 5 });
}

let cached: Database | undefined;

/** Reuses one handle across warm Lambda invocations; a fresh pool per request is how connections get exhausted. */
export function getDatabase(): Database {
  if (!cached) {
    cached = createDatabase({ connectionString: databaseUrl() });
  }
  return cached;
}

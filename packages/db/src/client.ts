import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = ReturnType<typeof createDatabase>;

export interface DatabaseOptions {
  connectionString: string;
  /** Keep at 1 in Lambda: each warm copy holds its own pool, and RDS Proxy shares the connections. */
  maxConnections?: number;
  /** Must be false through RDS Proxy, which may hand the next query to a different backend session. */
  usePreparedStatements?: boolean;
}

export function createDatabase(options: DatabaseOptions) {
  const sql = postgres(options.connectionString, {
    max: options.maxConnections ?? 1,
    prepare: options.usePreparedStatements ?? false,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return drizzle(sql, { schema, logger: process.env.DB_LOG === 'true' });
}

let cached: Database | undefined;

/** Reuses one handle across warm Lambda invocations; a fresh pool per request is how connections get exhausted. */
export function getDatabase(): Database {
  if (!cached) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }
    cached = createDatabase({ connectionString });
  }
  return cached;
}

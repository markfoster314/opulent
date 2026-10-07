import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Database = ReturnType<typeof createDatabase>;

export interface DatabaseOptions {
  connectionString: string;
  /**
   * Keep this at 1 inside AWS Lambda. Every warm Lambda copy holds its own pool,
   * so a large pool multiplied by hundreds of copies exhausts Postgres.
   * Amazon RDS Proxy is what actually shares connections between them.
   */
  maxConnections?: number;
  /**
   * Prepared statements must be off when traffic goes through RDS Proxy, because
   * the proxy may hand the next query to a different backend session.
   */
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

/**
 * Reuses one database handle across warm Lambda invocations. Creating a fresh
 * pool on every request is the most common cause of connection exhaustion.
 */
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

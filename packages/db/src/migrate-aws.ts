import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { applyBootstrap } from './bootstrap-sql';
import { ensureDatabaseUrl, postgresSsl } from './connection-string';

/** Extensions, schema, then indexes. Indexes need the tables, so bootstrap runs twice. */
export async function handler(): Promise<void> {
  const connectionString = await ensureDatabaseUrl();

  await applyBootstrap(connectionString);

  const sql = postgres(connectionString, {
    max: 1,
    prepare: false,
    onnotice: () => {},
    ...postgresSsl(connectionString),
  });
  try {
    await migrate(drizzle(sql), { migrationsFolder: '/var/task/migrations' });
  } finally {
    await sql.end();
  }

  await applyBootstrap(connectionString);
}

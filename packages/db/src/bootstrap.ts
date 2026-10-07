import postgres from 'postgres';
import { loadEnv } from './load-env';

loadEnv();

/**
 * Runs the pieces of schema that drizzle-kit cannot express: extensions and the
 * trigram index used for fuzzy card-name search.
 *
 * Safe to run repeatedly. Run it once before the first `db:migrate`.
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  // This script is built to be re-run, so "already exists, skipping" notices
  // are the expected case rather than something worth printing.
  const sql = postgres(connectionString, { max: 1, onnotice: () => {} });

  try {
    // gen_random_uuid() and gen_random_bytes() come from pgcrypto.
    await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
    // pg_trgm makes "lighning bolt" still find "Lightning Bolt".
    await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
    console.log('extensions ready: pgcrypto, pg_trgm');

    const cardsTableExists = await sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'cards'
      ) AS exists
    `;

    if (cardsTableExists[0]?.exists) {
      await sql`
        CREATE INDEX IF NOT EXISTS cards_name_trgm_idx
        ON cards USING gin (name gin_trgm_ops)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS cards_name_lower_idx
        ON cards (lower(name))
      `;
      console.log('indexes ready: cards_name_trgm_idx, cards_name_lower_idx');
    } else {
      console.log('cards table not found yet. Run db:migrate, then run bootstrap again.');
    }
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

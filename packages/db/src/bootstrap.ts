import postgres from 'postgres';
import { loadEnv } from './load-env';

loadEnv();

/**
 * Runs the pieces of schema that drizzle-kit cannot express: extensions, the
 * PostGIS geography column on cities, and the trigram index used for fuzzy
 * card-name search.
 *
 * Safe to run repeatedly. Run it once before the first `db:migrate`, and again
 * after migrate so the indexes that depend on tables can be built.
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
    // ST_DWithin measures radius in meters on a geography column.
    try {
      await sql`CREATE EXTENSION IF NOT EXISTS postgis`;
    } catch (error) {
      throw new Error(
        'PostGIS could not be created. Start the database with docker compose up -d postgres so it uses the PostGIS image, then run this again.',
        { cause: error },
      );
    }
    console.log('extensions ready: pgcrypto, pg_trgm, postgis');

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
      // Want tiles read the oldest picture for a card. This order lets that
      // read stop at the first matching row instead of sorting every printing.
      // CONCURRENTLY keeps the build from blocking card search while it runs.
      await sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_oracle_oldest_image_idx
        ON cards (
          oracle_id,
          released_at,
          (lang = 'en') DESC,
          scryfall_id
        )
        WHERE image_uris IS NOT NULL
          AND layout IS DISTINCT FROM 'art_series'
      `;
      console.log(
        'indexes ready: cards_name_trgm_idx, cards_name_lower_idx, cards_oracle_oldest_image_idx',
      );
    } else {
      console.log('cards table not found yet. Run db:migrate, then run bootstrap again.');
    }

    const placesTableExists = await sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'places'
      ) AS exists
    `;

    if (placesTableExists[0]?.exists) {
      // Stored so every insert and update keeps the point in step with lat/lon.
      // Queries ask ST_DWithin on this column and never select it.
      await sql`
        ALTER TABLE places
        ADD COLUMN IF NOT EXISTS location geography(Point, 4326)
        GENERATED ALWAYS AS (
          ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
        ) STORED
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS places_location_gix
        ON places USING gist (location)
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS places_name_lower_idx
        ON places (lower(name))
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS places_ascii_name_lower_idx
        ON places (lower(ascii_name))
      `;
      console.log(
        'indexes ready: places_location_gix, places_name_lower_idx, places_ascii_name_lower_idx',
      );
    } else {
      console.log('places table not found yet. Run db:migrate, then run bootstrap again.');
    }
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

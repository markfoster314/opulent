import postgres from 'postgres';
import { postgresSsl } from './connection-string';

/** Raw SQL drizzle-kit cannot express; safe to re-run, and run again after migrations. */
export async function applyBootstrap(connectionString: string): Promise<void> {
  // Re-runnable by design, so "already exists, skipping" notices are expected noise.
  const sql = postgres(connectionString, {
    max: 1,
    onnotice: () => {},
    ...postgresSsl(connectionString),
  });

  try {
    // pgcrypto supplies gen_random_uuid() and gen_random_bytes().
    await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
    // pg_trgm keeps a typo like "lighning bolt" matching "Lightning Bolt".
    await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
    // A geography column makes ST_DWithin measure meters, not degrees.
    try {
      await sql`CREATE EXTENSION IF NOT EXISTS postgis`;
    } catch (error) {
      throw new Error(
        'PostGIS could not be created. Local databases need the PostGIS image. RDS for PostgreSQL must allow the postgis extension.',
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
      // Set search matches fragments, so set name and code need trigrams too.
      await sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_set_name_trgm_idx
        ON cards USING gin (set_name gin_trgm_ops)
      `;
      await sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_set_code_trgm_idx
        ON cards USING gin (set_code gin_trgm_ops)
      `;
      // Covering index in picker order lets DISTINCT ON walk it without sorting wide rows.
      await sql`
        CREATE INDEX CONCURRENTLY IF NOT EXISTS cards_printings_order_idx
        ON cards (
          oracle_id,
          set_code,
          collector_number,
          (lang = 'en') DESC,
          released_at DESC NULLS LAST,
          scryfall_id
        )
        WHERE jsonb_exists(raw->'games', 'paper')
          AND layout IS DISTINCT FROM 'art_series'
      `;
      // Oldest-image reads for want tiles stop at the first row; CONCURRENTLY avoids blocking search.
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
      console.log('indexes ready: cards name/set trigram, oracle oldest image, printings order');
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
      // Generated so the point tracks lat/lon; queries only pass it to ST_DWithin.
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

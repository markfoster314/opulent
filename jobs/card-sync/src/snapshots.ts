import { type Database } from '@opulent/db';
import { CARD_GAME } from '@opulent/shared';
import { sql } from 'drizzle-orm';

/**
 * Freeze today's asking value for every person who owns cards.
 *
 * The pricing rule mirrors apps/api/src/modules/collection/value.ts: custom
 * amount, percent of market, or market, with the English printing as fallback.
 * The job cannot import the API, so the rule is repeated here; keep them equal.
 */
export async function snapshotCollectionValues(db: Database): Promise<number> {
  const day = new Date().toISOString().slice(0, 10);
  const rows = await db.execute(sql`
    WITH priced AS (
      SELECT
        ci.user_id,
        ci.quantity,
        ci.price_kind,
        ci.price_percent,
        ci.price_amount,
        COALESCE(
          CASE ci.finish::text
            WHEN 'foil' THEN NULLIF(c.prices->>'usd_foil', '')::numeric
            WHEN 'etched' THEN NULLIF(c.prices->>'usd_etched', '')::numeric
            ELSE NULLIF(c.prices->>'usd', '')::numeric
          END,
          CASE ci.finish::text
            WHEN 'foil' THEN NULLIF(e.prices->>'usd_foil', '')::numeric
            WHEN 'etched' THEN NULLIF(e.prices->>'usd_etched', '')::numeric
            ELSE NULLIF(e.prices->>'usd', '')::numeric
          END
        ) AS market
      FROM collection_items ci
      INNER JOIN cards c ON c.scryfall_id = ci.scryfall_id
      LEFT JOIN cards e
        ON e.set_code = c.set_code
        AND e.collector_number = c.collector_number
        AND e.lang = 'en'
        AND jsonb_exists(e.raw->'games', 'paper')
        AND e.layout IS DISTINCT FROM 'art_series'
      WHERE c.game = ${CARD_GAME}
    )
    INSERT INTO collection_value_snapshots (user_id, day, value)
    SELECT
      user_id,
      ${day}::date,
      COALESCE(
        SUM(
          CASE price_kind::text
            WHEN 'custom' THEN COALESCE(NULLIF(price_amount, '')::numeric, 0)
            WHEN 'percent' THEN ROUND(market * price_percent / 100.0, 2)
            ELSE market
          END * quantity
        ),
        0
      )
    FROM priced
    GROUP BY user_id
    ON CONFLICT (user_id, day) DO UPDATE SET value = EXCLUDED.value
    RETURNING user_id
  `);

  return rows.length;
}

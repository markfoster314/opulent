import type { Database } from '@opulent/db';
import { ensurePricePartitions, pricePartitionWindow } from '@opulent/db';
import { sql } from 'drizzle-orm';

/**
 * Writes a price row only where the price changed.
 *
 * History is a list of change points, not a row per day: a card that held the
 * same price for a month has one row covering that month. Readers carry the
 * newest row forward to fill the days in between, so the table stays small and
 * still answers "what was this worth on that day".
 *
 * The newest row per card comes from one pass over the history table rather than
 * a lookup per card, so the cost follows the size of the history, not the size of
 * the catalog.
 *
 * Prices arrive from the card row as JSON and are cast once here. Comparing the
 * six numbers, rather than two JSON objects, means "2.30" and "2.3" are the same
 * price and a missing key is the same as a null.
 *
 * `CURRENT_DATE` is the database server's date, which keeps every row on one
 * clock. A second run on the same day corrects that day instead of adding a row.
 */
export async function recordDailyPrices(db: Database): Promise<number> {
  // An insert with no partition to land in fails, so make the months first.
  const window = pricePartitionWindow();
  await ensurePricePartitions(db, window.from, window.to);

  const result = await db.execute(sql`
    WITH latest AS (
      SELECT DISTINCT ON (scryfall_id)
        scryfall_id, usd, usd_foil, usd_etched, eur, eur_foil, tix
      FROM card_price_history
      ORDER BY scryfall_id, recorded_on DESC
    ),
    priced AS (
      SELECT
        scryfall_id,
        NULLIF(prices->>'usd', '')::numeric(10,2) AS usd,
        NULLIF(prices->>'usd_foil', '')::numeric(10,2) AS usd_foil,
        NULLIF(prices->>'usd_etched', '')::numeric(10,2) AS usd_etched,
        NULLIF(prices->>'eur', '')::numeric(10,2) AS eur,
        NULLIF(prices->>'eur_foil', '')::numeric(10,2) AS eur_foil,
        NULLIF(prices->>'tix', '')::numeric(10,2) AS tix
      FROM cards
      WHERE prices IS NOT NULL
    )
    INSERT INTO card_price_history (
      scryfall_id, recorded_on, usd, usd_foil, usd_etched, eur, eur_foil, tix
    )
    SELECT
      p.scryfall_id, CURRENT_DATE, p.usd, p.usd_foil, p.usd_etched, p.eur, p.eur_foil, p.tix
    FROM priced p
    LEFT JOIN latest l ON l.scryfall_id = p.scryfall_id
    WHERE l.scryfall_id IS NULL
      OR (l.usd, l.usd_foil, l.usd_etched, l.eur, l.eur_foil, l.tix)
        IS DISTINCT FROM
        (p.usd, p.usd_foil, p.usd_etched, p.eur, p.eur_foil, p.tix)
    ON CONFLICT (scryfall_id, recorded_on) DO UPDATE SET
      usd = excluded.usd,
      usd_foil = excluded.usd_foil,
      usd_etched = excluded.usd_etched,
      eur = excluded.eur,
      eur_foil = excluded.eur_foil,
      tix = excluded.tix
  `);

  return Number((result as unknown as { count?: number }).count ?? 0);
}

import {
  ensurePricePartitions,
  heavyStatementTimeout,
  pricePartitionWindow,
  type Database,
} from '@opulent/db';
import { sql } from 'drizzle-orm';

/** Change points only; cast numerics compare by value and CURRENT_DATE makes reruns idempotent. */
export async function recordDailyPrices(db: Database): Promise<number> {
  // An insert with no partition to land in fails, so make the months first.
  const window = pricePartitionWindow();
  await ensurePricePartitions(db, window.from, window.to);

  return db.transaction(async (tx) => {
    await tx.execute(heavyStatementTimeout);
    const result = await tx.execute(sql`
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
  });
}

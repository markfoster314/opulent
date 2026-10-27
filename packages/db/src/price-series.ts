import type { CardPrices } from '@opulent/shared';
import { sql } from 'drizzle-orm';
import type { Database } from './client';

export interface DailyPrice {
  /** The day, as YYYY-MM-DD. */
  recordedOn: string;
  prices: CardPrices;
}

interface DailyPriceRow {
  recordedOn: string;
  usd: string | null;
  usdFoil: string | null;
  usdEtched: string | null;
  eur: string | null;
  eurFoil: string | null;
  tix: string | null;
}

/**
 * A daily price line for one printing, with the last stored price carried forward.
 *
 * History holds a row only where the price changed, so most days have no row of
 * their own. For each day in the range the lateral join takes the newest row on
 * or before that day, which is the price that was in force. Days before the first
 * stored row produce nothing, so a caller never sees a price from before the card
 * existed.
 *
 * The stored columns are numeric, which the driver returns as strings, so putting
 * the `CardPrices` object back together needs no rounding.
 *
 * The two date arguments are YYYY-MM-DD strings, which avoids any timezone
 * question about what "a day" means.
 */
export async function cardPriceSeries(
  db: Database,
  scryfallId: string,
  from: string,
  to: string,
): Promise<DailyPrice[]> {
  const rows = (await db.execute(sql`
    SELECT
      to_char(d.day, 'YYYY-MM-DD') AS "recordedOn",
      h.usd,
      h.usd_foil AS "usdFoil",
      h.usd_etched AS "usdEtched",
      h.eur,
      h.eur_foil AS "eurFoil",
      h.tix
    FROM generate_series(${from}::date, ${to}::date, INTERVAL '1 day') AS d(day)
    JOIN LATERAL (
      SELECT usd, usd_foil, usd_etched, eur, eur_foil, tix
      FROM card_price_history
      WHERE scryfall_id = ${scryfallId}::uuid
        AND recorded_on <= d.day::date
      ORDER BY recorded_on DESC
      LIMIT 1
    ) h ON true
    ORDER BY d.day
  `)) as unknown as DailyPriceRow[];

  return rows.map((row) => ({
    recordedOn: row.recordedOn,
    prices: {
      usd: row.usd,
      usd_foil: row.usdFoil,
      usd_etched: row.usdEtched,
      eur: row.eur,
      eur_foil: row.eurFoil,
      tix: row.tix,
    },
  }));
}

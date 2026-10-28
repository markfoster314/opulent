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

/** History holds only change rows, so each day takes the newest row on or before it; days before the first row are absent, and YYYY-MM-DD strings avoid timezone questions. */
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

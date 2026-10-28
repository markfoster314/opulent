import { and, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { CARD_GAME } from '@opulent/shared';
import type { Database } from './client';
import { cards, collectionItems } from './schema';

/** The price scan and the value snapshot read every card. A stuck query must end the task. */
export const heavyStatementTimeout = sql`SET LOCAL statement_timeout = '15min'`;

/** The English printing, used for a price when the owned printing has none. */
export const englishValueCards = alias(cards, 'english_value_card');

export function englishMatch() {
  return and(
    eq(englishValueCards.setCode, cards.setCode),
    eq(englishValueCards.collectorNumber, cards.collectorNumber),
    eq(englishValueCards.lang, 'en'),
    sql`jsonb_exists(${englishValueCards.raw}->'games', 'paper')`,
    sql`${englishValueCards.layout} IS DISTINCT FROM 'art_series'`,
  );
}

/** Per-stack asking value in SQL, including the English price fallback. */
export function askingValueSql() {
  const marketPrice = sql`CASE ${collectionItems.finish}::text
    WHEN 'foil' THEN NULLIF(${cards.prices}->>'usd_foil', '')::numeric
    WHEN 'etched' THEN NULLIF(${cards.prices}->>'usd_etched', '')::numeric
    ELSE NULLIF(${cards.prices}->>'usd', '')::numeric END`;
  const englishPrice = sql`CASE ${collectionItems.finish}::text
    WHEN 'foil' THEN NULLIF(${englishValueCards.prices}->>'usd_foil', '')::numeric
    WHEN 'etched' THEN NULLIF(${englishValueCards.prices}->>'usd_etched', '')::numeric
    ELSE NULLIF(${englishValueCards.prices}->>'usd', '')::numeric END`;
  const market = sql`COALESCE(${marketPrice}, ${englishPrice})`;
  const asking = sql`CASE ${collectionItems.priceKind}::text
    WHEN 'custom' THEN NULLIF(${collectionItems.priceAmount}, '')::numeric
    WHEN 'percent' THEN ROUND(${market} * ${collectionItems.pricePercent} / 100.0, 2)
    ELSE ${market} END`;
  return sql<string>`COALESCE(${asking}, 0) * ${collectionItems.quantity}`;
}

function todayUtcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function snapshotCollectionValues(db: Database, day = todayUtcDay()): Promise<number> {
  return db.transaction(async (tx) => {
    await tx.execute(heavyStatementTimeout);
    const rows = await tx.execute(sql`
      INSERT INTO collection_value_snapshots (user_id, day, value)
      SELECT collection_items.user_id, ${day}::date, COALESCE(SUM(${askingValueSql()}), 0)
      FROM collection_items
      INNER JOIN cards ON cards.scryfall_id = collection_items.scryfall_id
      LEFT JOIN cards AS english_value_card ON ${englishMatch()}
      WHERE cards.game = ${CARD_GAME}
      GROUP BY collection_items.user_id
      ON CONFLICT (user_id, day) DO UPDATE SET value = EXCLUDED.value
      RETURNING user_id
    `);
    return rows.length;
  });
}

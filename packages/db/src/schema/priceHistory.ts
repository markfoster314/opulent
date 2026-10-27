import { date, index, numeric, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { cards } from './cards';

/**
 * One price change for one printing.
 *
 * A row marks a change, not a day. The nightly card sync writes one here only
 * when the price differs from the newest row for that card, so a card that held
 * one price for a month is one row covering that month. Readers carry the newest
 * row forward; `cardPriceSeries` does that for a date range.
 *
 * Money is six numeric columns rather than a JSON object. The shape never
 * varies, `numeric` is the exact type for money, and six values cost about half
 * the space of the same object repeated on every row. It also makes the change
 * test exact: "2.30" and "2.3" are the same number, and a missing key and a null
 * are the same absence.
 *
 * The pair of columns is the primary key: a second run on the same day corrects
 * that day instead of adding a duplicate row.
 *
 * The table is partitioned by month on `recorded_on` (migration 0020). Each month
 * holds its own small indexes, an old month can be dropped in one step, and a
 * date range reads only the months it touches. `ensurePricePartitions` makes the
 * months before a writer needs them.
 */
export const cardPriceHistory = pgTable(
  'card_price_history',
  {
    scryfallId: uuid('scryfall_id')
      .notNull()
      .references(() => cards.scryfallId, { onDelete: 'cascade' }),

    /** The day this price belongs to, from the database server's clock. */
    recordedOn: date('recorded_on').notNull(),

    /** Dollars for the non-foil printing. */
    usd: numeric('usd', { precision: 10, scale: 2 }),
    /** Dollars for the foil printing. */
    usdFoil: numeric('usd_foil', { precision: 10, scale: 2 }),
    /** Dollars for the etched printing. */
    usdEtched: numeric('usd_etched', { precision: 10, scale: 2 }),
    /** Euros for the non-foil printing. */
    eur: numeric('eur', { precision: 10, scale: 2 }),
    /** Euros for the foil printing. */
    eurFoil: numeric('eur_foil', { precision: 10, scale: 2 }),
    /** Magic Online tickets. */
    tix: numeric('tix', { precision: 10, scale: 2 }),
  },
  (table) => [
    primaryKey({ columns: [table.scryfallId, table.recordedOn] }),
    // "What moved since last week" reads across cards, not down one card.
    index('card_price_history_recorded_on_idx').on(table.recordedOn),
  ],
);

export type CardPriceHistoryRow = typeof cardPriceHistory.$inferSelect;
export type NewCardPriceHistoryRow = typeof cardPriceHistory.$inferInsert;

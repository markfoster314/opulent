import { date, index, numeric, pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';
import { cards } from './cards';

/** One row per price change, not per day; six numeric columns beat JSON for exactness and half the space, and monthly partitions (migration 0020) make retention a DROP. */
export const cardPriceHistory = pgTable(
  'card_price_history',
  {
    scryfallId: uuid('scryfall_id')
      .notNull()
      .references(() => cards.scryfallId, { onDelete: 'cascade' }),

    /** The day this price belongs to, from the database server's clock. */
    recordedOn: date('recorded_on').notNull(),

    usd: numeric('usd', { precision: 10, scale: 2 }),
    usdFoil: numeric('usd_foil', { precision: 10, scale: 2 }),
    usdEtched: numeric('usd_etched', { precision: 10, scale: 2 }),
    eur: numeric('eur', { precision: 10, scale: 2 }),
    eurFoil: numeric('eur_foil', { precision: 10, scale: 2 }),
    /** Magic Online tickets. */
    tix: numeric('tix', { precision: 10, scale: 2 }),
  },
  (table) => [
    primaryKey({ columns: [table.scryfallId, table.recordedOn] }),
    // Cross-card "what moved" scans read by day, not by card.
    index('card_price_history_recorded_on_idx').on(table.recordedOn),
  ],
);

export type CardPriceHistoryRow = typeof cardPriceHistory.$inferSelect;
export type NewCardPriceHistoryRow = typeof cardPriceHistory.$inferInsert;

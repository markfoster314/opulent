import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { tradeSide, tradeStatus } from './enums';
import { cards } from './cards';
import { users } from './users';

/**
 * Phase 7 of the roadmap. The tables exist now so migrations stay additive,
 * but no API route reads them yet.
 */
export const trades = pgTable(
  'trades',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    proposerId: uuid('proposer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    receiverId: uuid('receiver_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    status: tradeStatus('status').notNull().default('draft'),
    message: text('message'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('trades_proposer_id_idx').on(table.proposerId),
    index('trades_receiver_id_idx').on(table.receiverId),
  ],
);

export const tradeItems = pgTable(
  'trade_items',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    tradeId: uuid('trade_id')
      .notNull()
      .references(() => trades.id, { onDelete: 'cascade' }),

    /** Which direction this card moves: offered by the proposer, or requested from the receiver. */
    side: tradeSide('side').notNull(),

    scryfallId: uuid('scryfall_id')
      .notNull()
      .references(() => cards.scryfallId, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull().default(1),
  },
  (table) => [index('trade_items_trade_id_idx').on(table.tradeId)],
);

export type TradeRow = typeof trades.$inferSelect;
export type TradeItemRow = typeof tradeItems.$inferSelect;

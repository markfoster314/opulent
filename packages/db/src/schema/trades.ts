import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tradeSide, tradeStatus } from './enums';
import { cards } from './cards';
import { users } from './users';

/**
 * One trade between two people.
 *
 * The proposer opened it. The receiver is the other person. `turnUserId` is
 * whose move it is. A finalize time is set when that person says yes to the
 * current cards. Both times must be set before the trade is complete. Changing
 * the cards clears both times.
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
    /** Whose move it is. Always one of the two people on the trade. */
    turnUserId: uuid('turn_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    status: tradeStatus('status').notNull().default('draft'),
    message: text('message'),
    proposerFinalizedAt: timestamp('proposer_finalized_at', { withTimezone: true }),
    receiverFinalizedAt: timestamp('receiver_finalized_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('trades_proposer_id_idx').on(table.proposerId),
    index('trades_receiver_id_idx').on(table.receiverId),
    index('trades_turn_user_id_idx').on(table.turnUserId),
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
  (table) => [
    index('trade_items_trade_id_idx').on(table.tradeId),
    uniqueIndex('trade_items_printing_key').on(table.tradeId, table.side, table.scryfallId),
  ],
);

export type TradeRow = typeof trades.$inferSelect;
export type TradeItemRow = typeof tradeItems.$inferSelect;

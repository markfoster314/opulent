import { sql } from 'drizzle-orm';
import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * What a user is hunting for.
 *
 * Keyed on `oracleId`, not a printing, because a trader who wants Lightning Bolt
 * almost always accepts any printing of it. Matching a want list against someone
 * else's binder is the core query of the product.
 */
export const wantItems = pgTable(
  'want_items',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    oracleId: uuid('oracle_id').notNull(),

    quantity: integer('quantity').notNull().default(1),

    /** 1 high, 2 medium, 3 low. Drives sort order in match results. */
    priority: integer('priority').notNull().default(2),
    notes: text('notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('want_items_user_oracle_key').on(table.userId, table.oracleId),
    index('want_items_oracle_id_idx').on(table.oracleId),
  ],
);

export type WantItemRow = typeof wantItems.$inferSelect;
export type NewWantItemRow = typeof wantItems.$inferInsert;

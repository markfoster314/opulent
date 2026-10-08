import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { binderVisibility, cardCondition, cardFinish, itemPriceKind } from './enums';
import { cards } from './cards';
import { users } from './users';

export const binders = pgTable(
  'binders',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Combined with the owner username to form /u/:username/:slug. */
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),

    visibility: binderVisibility('visibility').notNull().default('private'),

    /**
     * Secret second door. An unlisted binder is reachable only with this token,
     * so the owner can share a link without making the binder public.
     * Rotating the token revokes every link that was handed out before.
     */
    shareToken: text('share_token')
      .notNull()
      .default(sql`encode(gen_random_bytes(16), 'hex')`),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('binders_user_slug_key').on(table.userId, table.slug),
    uniqueIndex('binders_share_token_key').on(table.shareToken),
    index('binders_user_id_idx').on(table.userId),
  ],
);

export const binderItems = pgTable(
  'binder_items',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    binderId: uuid('binder_id')
      .notNull()
      .references(() => binders.id, { onDelete: 'cascade' }),

    /** Restricted, not cascaded: deleting a mirrored card must never eat a user's row. */
    scryfallId: uuid('scryfall_id')
      .notNull()
      .references(() => cards.scryfallId, { onDelete: 'restrict' }),

    quantity: integer('quantity').notNull().default(1),
    finish: cardFinish('finish').notNull().default('nonfoil'),
    condition: cardCondition('condition').notNull().default('NM'),
    language: text('language').notNull().default('en'),
    /** Marks on this physical copy. Each one trades as its own stack. */
    signed: boolean('signed').notNull().default(false),
    altered: boolean('altered').notNull().default(false),
    misprint: boolean('misprint').notNull().default(false),
    miscut: boolean('miscut').notNull().default(false),
    notes: text('notes'),

    /** Lets an owner park a card in a binder without offering it yet. */
    forTrade: boolean('for_trade').notNull().default(true),

    /**
     * Market stores percent 100 and an empty amount. A percent price stores 0–100
     * and an empty amount. Custom stores percent 0 and a dollar string such as "4.50".
     * The kind column keeps 100% distinct from market, and 0% distinct from a custom price.
     */
    priceKind: itemPriceKind('price_kind').notNull().default('market'),
    pricePercent: integer('price_percent').notNull().default(100),
    priceAmount: text('price_amount').notNull().default(''),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Same printing at a different condition, finish, language, price, or mark
    // is a separate stack, because those trade at different values.
    uniqueIndex('binder_items_stack_key').on(
      table.binderId,
      table.scryfallId,
      table.finish,
      table.condition,
      table.language,
      table.signed,
      table.altered,
      table.misprint,
      table.miscut,
      table.priceKind,
      table.pricePercent,
      table.priceAmount,
    ),
    index('binder_items_binder_id_idx').on(table.binderId),
    index('binder_items_scryfall_id_idx').on(table.scryfallId),
  ],
);

export type BinderRow = typeof binders.$inferSelect;
export type NewBinderRow = typeof binders.$inferInsert;
export type BinderItemRow = typeof binderItems.$inferSelect;
export type NewBinderItemRow = typeof binderItems.$inferInsert;

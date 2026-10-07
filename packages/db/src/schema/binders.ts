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
import { binderVisibility, cardCondition, cardFinish } from './enums';
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

    /** Combined with the owner handle to form /u/:handle/:slug. */
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
    notes: text('notes'),

    /** Lets an owner park a card in a binder without offering it yet. */
    forTrade: boolean('for_trade').notNull().default(true),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Same printing in a different condition or finish is a separate stack,
    // because those trade at different values.
    uniqueIndex('binder_items_stack_key').on(
      table.binderId,
      table.scryfallId,
      table.finish,
      table.condition,
      table.language,
    ),
    index('binder_items_binder_id_idx').on(table.binderId),
    index('binder_items_scryfall_id_idx').on(table.scryfallId),
  ],
);

export type BinderRow = typeof binders.$inferSelect;
export type NewBinderRow = typeof binders.$inferInsert;
export type BinderItemRow = typeof binderItems.$inferSelect;
export type NewBinderItemRow = typeof binderItems.$inferInsert;

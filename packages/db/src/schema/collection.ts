import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { cards } from './cards';
import { cardCondition, cardFinish, itemPriceKind } from './enums';
import { users } from './users';

/** A private label over items: a card may sit in several groups or none, and the only public surface is the trade binder. */
export const cardGroups = pgTable(
  'card_groups',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    description: text('description'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Group names are unique per owner, ignoring case.
    uniqueIndex('card_groups_user_name_key').on(table.userId, sql`lower(${table.name})`),
    // Composite FK target, so a membership cannot point at another owner's group.
    uniqueIndex('card_groups_user_id_id_key').on(table.userId, table.id),
    index('card_groups_user_id_idx').on(table.userId),
  ],
);

/** One stack a person owns; the binder is the rows marked for trade, and groups join through groupMemberships so they never own a card. */
export const collectionItems = pgTable(
  'collection_items',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Restricted, not cascaded: deleting a mirrored card must never eat a user's row. */
    scryfallId: uuid('scryfall_id')
      .notNull()
      .references(() => cards.scryfallId, { onDelete: 'restrict' }),

    quantity: integer('quantity').notNull().default(1),
    finish: cardFinish('finish').notNull().default('nonfoil'),
    condition: cardCondition('condition').notNull().default('NM'),
    language: text('language').notNull().default('en'),
    /** Marks on this copy; each one trades as its own stack. */
    signed: boolean('signed').notNull().default(false),
    altered: boolean('altered').notNull().default(false),
    misprint: boolean('misprint').notNull().default(false),
    miscut: boolean('miscut').notNull().default(false),
    /** A proof copy for the artist; it trades as its own stack. */
    artistProof: boolean('artist_proof').notNull().default(false),
    notes: text('notes'),
    /** Photos of this copy; not part of the stack key. */
    photoUrl: text('photo_url'),

    /** Puts the stack in the public trade binder. */
    forTrade: boolean('for_trade').notNull().default(false),

    /** Kind separates the columns: market is percent 100 with no amount, percent is 0-100 with no amount, custom is percent 0 with a dollar string like "4.50". */
    priceKind: itemPriceKind('price_kind').notNull().default('market'),
    pricePercent: integer('price_percent').notNull().default(100),
    priceAmount: text('price_amount').notNull().default(''),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One row per physical stack; price is an attribute, so editing it updates the same row.
    uniqueIndex('collection_items_stack_key').on(
      table.userId,
      table.scryfallId,
      table.finish,
      table.condition,
      table.language,
      table.signed,
      table.altered,
      table.misprint,
      table.miscut,
      table.artistProof,
    ),
    // Composite FK target, so a membership cannot point at another owner's card.
    uniqueIndex('collection_items_user_id_id_key').on(table.userId, table.id),
    index('collection_items_user_id_idx').on(table.userId),
    index('collection_items_scryfall_id_idx').on(table.scryfallId),
    /** Partial index for trade search, which only walks for-trade stacks. */
    index('collection_items_trade_scryfall_idx')
      .on(table.scryfallId)
      .where(sql`${table.forTrade}`),
  ],
);

/** One card in one group; the card lives in collectionItems, so deleting either side removes only the membership. */
export const groupMemberships = pgTable(
  'group_memberships',
  {
    itemId: uuid('item_id').notNull(),
    groupId: uuid('group_id').notNull(),
    /** Owner of both rows; the composite foreign keys keep both owners in step. */
    userId: uuid('user_id').notNull(),

    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.itemId, table.groupId] }),
    // Reverse lookup for every card in a group, the opposite of the primary key.
    index('group_memberships_group_id_idx').on(table.groupId),
    foreignKey({
      name: 'group_memberships_item_fk',
      columns: [table.userId, table.itemId],
      foreignColumns: [collectionItems.userId, collectionItems.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'group_memberships_group_fk',
      columns: [table.userId, table.groupId],
      foreignColumns: [cardGroups.userId, cardGroups.id],
    }).onDelete('cascade'),
  ],
);

export type CardGroupRow = typeof cardGroups.$inferSelect;
export type NewCardGroupRow = typeof cardGroups.$inferInsert;
export type CollectionItemRow = typeof collectionItems.$inferSelect;

/** One frozen value per user per day, so history need not re-price today's holdings; today is still computed live. */
export const collectionValueSnapshots = pgTable(
  'collection_value_snapshots',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    value: numeric('value', { precision: 14, scale: 2 }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.day] }),
    index('collection_value_snapshots_user_day_idx').on(table.userId, table.day),
  ],
);

export type CollectionValueSnapshotRow = typeof collectionValueSnapshots.$inferSelect;
export type NewCollectionItemRow = typeof collectionItems.$inferInsert;
export type GroupMembershipRow = typeof groupMemberships.$inferSelect;
export type NewGroupMembershipRow = typeof groupMemberships.$inferInsert;

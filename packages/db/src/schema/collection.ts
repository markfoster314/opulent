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

/**
 * A named lump of cards from someone's collection.
 *
 * A group is a label, not a home: a card can sit in several groups or in none,
 * and a group can be empty. Groups are private to their owner, so there is no
 * slug, visibility, or share link. The only public surface is the trade binder,
 * which is every collection item marked for trade.
 */
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
    // "One group cannot share a name with another of yours", ignoring case.
    uniqueIndex('card_groups_user_name_key').on(table.userId, sql`lower(${table.name})`),
    // Lets a membership prove the group belongs to the same person as the card.
    uniqueIndex('card_groups_user_id_id_key').on(table.userId, table.id),
    index('card_groups_user_id_idx').on(table.userId),
  ],
);

/**
 * One stack of cards a person owns.
 *
 * The collection is every row with their user id. The trade binder is the rows
 * marked for trade. Groups are joined through `groupMemberships`, so a stack is
 * never tied to a single folder and a group never owns the card.
 */
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
    /** Marks on this physical copy. Each one trades as its own stack. */
    signed: boolean('signed').notNull().default(false),
    altered: boolean('altered').notNull().default(false),
    misprint: boolean('misprint').notNull().default(false),
    miscut: boolean('miscut').notNull().default(false),
    /** A proof copy given to the artist. It trades as its own stack. */
    artistProof: boolean('artist_proof').notNull().default(false),
    notes: text('notes'),
    /** A link to photos of this physical copy. Not part of the stack key. */
    photoUrl: text('photo_url'),

    /** Puts the stack in the public trade binder. A personal collection starts private. */
    forTrade: boolean('for_trade').notNull().default(false),

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
    // One stack per physical kind. Price is an attribute of the stack, not part
    // of what makes it distinct, so editing a price updates the same row.
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
    // Lets a membership prove the card and the group share one owner.
    uniqueIndex('collection_items_user_id_id_key').on(table.userId, table.id),
    index('collection_items_user_id_idx').on(table.userId),
    index('collection_items_scryfall_id_idx').on(table.scryfallId),
    /** Find trades walks for-trade stacks by printing, and ignores the rest. */
    index('collection_items_trade_scryfall_idx')
      .on(table.scryfallId)
      .where(sql`${table.forTrade}`),
  ],
);

/**
 * One card in one group.
 *
 * A row exists only while the card is lumped into that group; the card itself
 * lives in `collection_items`. Deleting a group or a card removes the membership
 * and nothing else.
 */
export const groupMemberships = pgTable(
  'group_memberships',
  {
    itemId: uuid('item_id').notNull(),
    groupId: uuid('group_id').notNull(),
    /** Owner of both rows. The two foreign keys below keep the owners in step. */
    userId: uuid('user_id').notNull(),

    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.itemId, table.groupId] }),
    // "Every card in this group" walks by group, the reverse of the primary key.
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

/**
 * One frozen collection value per person per day.
 *
 * The value history reads these for past days instead of re-pricing today's
 * holdings across the whole window. Today is still computed live.
 */
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

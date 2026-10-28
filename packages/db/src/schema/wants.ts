import { sql } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { binderVisibility } from './enums';
import { users } from './users';

/** A named group of wants with binder-like visibility; matching still reads every list the viewer owns. */
export const wantLists = pgTable(
  'want_lists',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Forms /u/:username/wants/:slug with the owner's username. */
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),

    visibility: binderVisibility('visibility').notNull().default('private'),

    /** Secret second door for unlisted lists; rotating it revokes every link already handed out. */
    shareToken: text('share_token')
      .notNull()
      .default(sql`encode(gen_random_bytes(16), 'hex')`),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('want_lists_user_id_idx').on(table.userId),
    uniqueIndex('want_lists_user_slug_key').on(table.userId, table.slug),
    uniqueIndex('want_lists_user_id_id_key').on(table.userId, table.id),
    uniqueIndex('want_lists_share_token_key').on(table.shareToken),
  ],
);

/** One card the owner hunts for; an empty choice list means any value. */
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

    /** 1 high, 2 medium, 3 low; drives match sort order. */
    priority: integer('priority').notNull().default(2),
    notes: text('notes'),

    wantedLanguages: text('wanted_languages')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    wantedFinishes: text('wanted_finishes')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    wantedConditions: text('wanted_conditions')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    wantedSets: text('wanted_sets')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    /** Normalized filters; equal keys mean the same want. */
    scopeKey: text('scope_key').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('want_items_user_oracle_scope_key').on(
      table.userId,
      table.oracleId,
      table.scopeKey,
    ),
    uniqueIndex('want_items_user_id_id_key').on(table.userId, table.id),
    index('want_items_oracle_id_idx').on(table.oracleId),
    index('want_items_user_id_idx').on(table.userId),
  ],
);

/** A label only: removing the label or its list leaves the global want in All wants. */
export const wantListItems = pgTable(
  'want_list_items',
  {
    wantListId: uuid('want_list_id').notNull(),
    wantItemId: uuid('want_item_id').notNull(),
    userId: uuid('user_id').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.wantListId, table.wantItemId] }),
    index('want_list_items_item_id_idx').on(table.wantItemId),
    index('want_list_items_user_id_idx').on(table.userId),
    foreignKey({
      name: 'want_list_items_list_fk',
      columns: [table.userId, table.wantListId],
      foreignColumns: [wantLists.userId, wantLists.id],
    }).onDelete('cascade'),
    foreignKey({
      name: 'want_list_items_item_fk',
      columns: [table.userId, table.wantItemId],
      foreignColumns: [wantItems.userId, wantItems.id],
    }).onDelete('cascade'),
  ],
);

/** A wide interest with no single card; a false mark is not a filter, and matchKey blocks duplicates. */
export const genericWants = pgTable(
  'generic_wants',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    languages: text('languages')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    finishes: text('finishes')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    conditions: text('conditions')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    sets: text('sets')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    signed: boolean('signed').notNull().default(false),
    altered: boolean('altered').notNull().default(false),
    misprint: boolean('misprint').notNull().default(false),
    miscut: boolean('miscut').notNull().default(false),
    artistProof: boolean('artist_proof').notNull().default(false),

    matchKey: text('match_key').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('generic_wants_user_id_idx').on(table.userId),
    uniqueIndex('generic_wants_user_match_key').on(table.userId, table.matchKey),
  ],
);

export type WantListRow = typeof wantLists.$inferSelect;
export type NewWantListRow = typeof wantLists.$inferInsert;
export type WantItemRow = typeof wantItems.$inferSelect;
export type NewWantItemRow = typeof wantItems.$inferInsert;
export type WantListItemRow = typeof wantListItems.$inferSelect;
export type NewWantListItemRow = typeof wantListItems.$inferInsert;
export type GenericWantRow = typeof genericWants.$inferSelect;
export type NewGenericWantRow = typeof genericWants.$inferInsert;

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
import { binderVisibility } from './enums';
import { users } from './users';

/**
 * A named group of wants, the same way a binder groups cards for trade.
 *
 * Visibility matches a binder: private, unlisted with a share token, or public.
 * Matching still reads every list the viewer owns.
 */
export const wantLists = pgTable(
  'want_lists',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Combined with the owner username to form /u/:username/wants/:slug. */
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    description: text('description'),

    visibility: binderVisibility('visibility').notNull().default('private'),

    /**
     * Secret second door. An unlisted list is reachable only with this token.
     * Rotating the token revokes every link that was handed out before.
     */
    shareToken: text('share_token')
      .notNull()
      .default(sql`encode(gen_random_bytes(16), 'hex')`),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('want_lists_user_id_idx').on(table.userId),
    uniqueIndex('want_lists_user_slug_key').on(table.userId, table.slug),
    uniqueIndex('want_lists_share_token_key').on(table.shareToken),
  ],
);

/**
 * One card the owner is hunting for, inside one list.
 *
 * Keyed on the card concept. Empty choice lists mean any language, printing,
 * condition, or set. A filled list keeps only those values, or skips them.
 */
export const wantItems = pgTable(
  'want_items',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    wantListId: uuid('want_list_id')
      .notNull()
      .references(() => wantLists.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    oracleId: uuid('oracle_id').notNull(),

    quantity: integer('quantity').notNull().default(1),

    /** 1 high, 2 medium, 3 low. Drives sort order in match results. */
    priority: integer('priority').notNull().default(2),
    notes: text('notes'),

    wantedLanguages: text('wanted_languages')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    unwantedLanguages: text('unwanted_languages')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    wantedFinishes: text('wanted_finishes')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    unwantedFinishes: text('unwanted_finishes')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    wantedConditions: text('wanted_conditions')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    unwantedConditions: text('unwanted_conditions')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    wantedSets: text('wanted_sets')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),
    unwantedSets: text('unwanted_sets')
      .array()
      .notNull()
      .default(sql`ARRAY[]::text[]`),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('want_items_list_oracle_key').on(table.wantListId, table.oracleId),
    index('want_items_oracle_id_idx').on(table.oracleId),
    index('want_items_user_id_idx').on(table.userId),
    index('want_items_list_id_idx').on(table.wantListId),
  ],
);

/**
 * A wide interest with no one card.
 *
 * Empty lists mean any language, finish, condition, or set. A filled list
 * keeps cards that match one of those values. A mark set to true means the
 * copy must carry that mark. A mark left false is not a filter.
 * `matchKey` is the same choices in a fixed order, so the same mix cannot be saved twice.
 */
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
export type GenericWantRow = typeof genericWants.$inferSelect;
export type NewGenericWantRow = typeof genericWants.$inferInsert;

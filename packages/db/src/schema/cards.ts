import type { CardImageUris, CardPrices } from '@opulent/shared';
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/** Local mirror of Scryfall refilled nightly from the bulk file, so no user request calls Scryfall; raw keeps the untouched object for new fields. */
export const cards = pgTable(
  'cards',
  {
    /** Scryfall's id for this exact printing. */
    scryfallId: uuid('scryfall_id').primaryKey(),

    /** Shared across every printing of the same card; want lists point here. */
    oracleId: uuid('oracle_id').notNull(),

    /** Which catalog the row belongs to; a later game gets its own value, sync job, and list filter. */
    game: text('game').notNull().default('mtg'),

    name: text('name').notNull(),
    setCode: text('set_code').notNull(),
    setName: text('set_name'),
    collectorNumber: text('collector_number').notNull(),
    rarity: text('rarity'),
    lang: text('lang').notNull().default('en'),
    layout: text('layout'),
    typeLine: text('type_line'),
    manaCost: text('mana_cost'),

    finishes: jsonb('finishes').$type<string[]>().notNull().default([]),
    imageUris: jsonb('image_uris').$type<CardImageUris | null>(),
    prices: jsonb('prices').$type<CardPrices | null>(),

    scryfallUri: text('scryfall_uri'),
    releasedAt: text('released_at'),

    /** The Scryfall card object exactly as downloaded. */
    raw: jsonb('raw').notNull(),

    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('cards_oracle_id_idx').on(table.oracleId),
    index('cards_set_code_idx').on(table.setCode),
    index('cards_game_idx').on(table.game),
    // The oldest-picture expression index lives in src/bootstrap.ts, because drizzle-kit cannot store it.
    uniqueIndex('cards_printing_key').on(table.setCode, table.collectorNumber, table.lang),
    // The fuzzy-name trigram index lives in src/bootstrap.ts, because drizzle-kit cannot express gin_trgm_ops.
  ],
);

export type CardRow = typeof cards.$inferSelect;
export type NewCardRow = typeof cards.$inferInsert;

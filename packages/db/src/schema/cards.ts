import type { CardImageUris, CardPrices } from '@opulent/shared';
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

/**
 * Our local mirror of Scryfall. Refilled nightly by jobs/card-sync from the
 * Scryfall bulk data file, so no user request ever has to call Scryfall.
 *
 * One row per printing. `raw` keeps the untouched Scryfall object, which means
 * adding a new displayed field later needs no re-import.
 */
export const cards = pgTable(
  'cards',
  {
    /** Scryfall's id for this exact printing. Also our primary key. */
    scryfallId: uuid('scryfall_id').primaryKey(),

    /** Shared across every printing of the same card. Want lists point here. */
    oracleId: uuid('oracle_id').notNull(),

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

    /** The complete Scryfall card object exactly as downloaded. */
    raw: jsonb('raw').notNull(),

    syncedAt: timestamp('synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('cards_oracle_id_idx').on(table.oracleId),
    index('cards_set_code_idx').on(table.setCode),
    uniqueIndex('cards_printing_key').on(table.setCode, table.collectorNumber, table.lang),
    // The fuzzy-name trigram index is created in src/bootstrap.ts, because
    // drizzle-kit cannot express a gin_trgm_ops operator class.
  ],
);

export type CardRow = typeof cards.$inferSelect;
export type NewCardRow = typeof cards.$inferInsert;

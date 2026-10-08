import type { Database } from '@opulent/db';
import { cards } from '@opulent/db';
import type {
  Card,
  CardLanguage,
  CardPrintingsQuery,
  CardSearchQuery,
  CardSet,
  Page,
} from '@opulent/shared';
import { cardLanguageOrEnglish, cardLanguageSchema, marketPrices } from '@opulent/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import { ApiError } from '../../lib/http';

/** A printing that exists as a physical card. Arena-only and Magic Online-only rows are left out. */
const paperOnly = sql`jsonb_exists(${cards.raw}->'games', 'paper')`;

/**
 * Art Series cards are the extra art pieces in collector boosters. Scryfall
 * stores each one as its own card, named like "Dress Down // Dress Down", with
 * layout art_series. They are paper, so the paper check alone keeps them.
 * IS DISTINCT FROM also keeps rows whose layout is empty.
 */
const notArtSeries = sql`${cards.layout} IS DISTINCT FROM 'art_series'`;

const cardColumns = {
  scryfallId: cards.scryfallId,
  oracleId: cards.oracleId,
  name: cards.name,
  setCode: cards.setCode,
  setName: cards.setName,
  collectorNumber: cards.collectorNumber,
  rarity: cards.rarity,
  lang: cards.lang,
  layout: cards.layout,
  typeLine: cards.typeLine,
  manaCost: cards.manaCost,
  finishes: cards.finishes,
  imageUris: cards.imageUris,
  prices: cards.prices,
  scryfallUri: cards.scryfallUri,
  releasedAt: cards.releasedAt,
};

/**
 * Card name search against our local mirror. Never calls Scryfall.
 *
 * Two signals are combined: a substring match, which handles "bolt", and a
 * trigram similarity score, which handles typos like "lighning bolt". The `%`
 * operator is what lets the trigram index answer that fuzzy test. Its cutoff
 * is pg_trgm.similarity_threshold, which Postgres defaults to 0.3.
 *
 * `all_cards` stores every language as its own row, and each row keeps the
 * English name. A name dropdown therefore keeps one row per card concept
 * before the limit: the English printing when one exists, otherwise the
 * language the card was actually printed in. The limit then means names, so
 * a typo is not crowded out by ten copies of an exact match.
 */
export async function searchCards(db: Database, query: CardSearchQuery): Promise<Card[]> {
  const term = query.q.trim();
  const nameMatch = sql`(${cards.name} ILIKE ${`%${term}%`} OR ${cards.name} % ${term})`;

  if (!query.uniqueByOracle) {
    const rows = await db
      .select(cardColumns)
      .from(cards)
      .where(and(paperOnly, notArtSeries, nameMatch))
      .orderBy(
        sql`similarity(${cards.name}, ${term}) DESC`,
        sql`${cards.releasedAt} DESC NULLS LAST`,
      )
      .limit(query.limit);
    return rows as Card[];
  }

  const rows = await db.execute<Card>(sql`
    SELECT
      "scryfallId",
      "oracleId",
      name,
      "setCode",
      "setName",
      "collectorNumber",
      rarity,
      lang,
      layout,
      "typeLine",
      "manaCost",
      finishes,
      "imageUris",
      prices,
      "scryfallUri",
      "releasedAt"
    FROM (
      SELECT DISTINCT ON (${cards.oracleId})
        ${cards.scryfallId} AS "scryfallId",
        ${cards.oracleId} AS "oracleId",
        ${cards.name} AS name,
        ${cards.setCode} AS "setCode",
        ${cards.setName} AS "setName",
        ${cards.collectorNumber} AS "collectorNumber",
        ${cards.rarity} AS rarity,
        ${cards.lang} AS lang,
        ${cards.layout} AS layout,
        ${cards.typeLine} AS "typeLine",
        ${cards.manaCost} AS "manaCost",
        ${cards.finishes} AS finishes,
        ${cards.imageUris} AS "imageUris",
        ${cards.prices} AS prices,
        ${cards.scryfallUri} AS "scryfallUri",
        ${cards.releasedAt} AS "releasedAt",
        similarity(${cards.name}, ${term}) AS score
      FROM ${cards}
      WHERE ${paperOnly}
        AND ${notArtSeries}
        AND ${nameMatch}
        AND (
          ${cards.lang} = 'en'
          OR NOT EXISTS (
            SELECT 1
            FROM ${cards} AS english_card
            WHERE english_card.oracle_id = ${cards.oracleId}
              AND english_card.lang = 'en'
              AND jsonb_exists(english_card.raw->'games', 'paper')
          )
        )
      ORDER BY ${cards.oracleId}, (${cards.lang} = 'en') DESC, ${cards.releasedAt} DESC NULLS LAST
    ) AS one_per_card
    ORDER BY score DESC, "releasedAt" DESC NULLS LAST
    LIMIT ${query.limit}
  `);
  return rows as unknown as Card[];
}

export async function getCardById(db: Database, scryfallId: string): Promise<Card | undefined> {
  const rows = await db
    .select(cardColumns)
    .from(cards)
    .where(eq(cards.scryfallId, scryfallId))
    .limit(1);
  return rows[0] as Card | undefined;
}

/**
 * One tile per printing, for the set picker.
 *
 * The same set and collector number can exist in several languages. The grid
 * shows that printing once: the English copy when it was printed in English,
 * otherwise the language it was printed in. The next screen is where the owner
 * picks the language.
 *
 * English printings sort first because they are what most traders hold, but a
 * card that only ever shipped in Japanese still appears, or it would be unaddable.
 *
 * Paging is by offset, unlike binder items, which use a keyset cursor. Printings
 * are static reference data that only changes when the nightly sync runs, so
 * rows cannot shift underneath a reader mid-scroll. The offset still travels as
 * an opaque cursor so the response matches every other paged endpoint.
 */
export async function getPrintingsByOracleId(
  db: Database,
  oracleId: string,
  query: CardPrintingsQuery,
): Promise<Page<Card>> {
  const offset = decodeOffset(query.cursor);
  const term = query.q?.trim();
  const setMatch = term
    ? sql`AND (${cards.setName} ILIKE ${`%${term}%`} OR ${cards.setCode} ILIKE ${`%${term}%`})`
    : sql``;

  const rows = await db.execute<Card>(sql`
    SELECT
      "scryfallId",
      "oracleId",
      name,
      "setCode",
      "setName",
      "collectorNumber",
      rarity,
      lang,
      layout,
      "typeLine",
      "manaCost",
      finishes,
      "imageUris",
      prices,
      "scryfallUri",
      "releasedAt"
    FROM (
      SELECT DISTINCT ON (${cards.setCode}, ${cards.collectorNumber})
        ${cards.scryfallId} AS "scryfallId",
        ${cards.oracleId} AS "oracleId",
        ${cards.name} AS name,
        ${cards.setCode} AS "setCode",
        ${cards.setName} AS "setName",
        ${cards.collectorNumber} AS "collectorNumber",
        ${cards.rarity} AS rarity,
        ${cards.lang} AS lang,
        ${cards.layout} AS layout,
        ${cards.typeLine} AS "typeLine",
        ${cards.manaCost} AS "manaCost",
        ${cards.finishes} AS finishes,
        ${cards.imageUris} AS "imageUris",
        ${cards.prices} AS prices,
        ${cards.scryfallUri} AS "scryfallUri",
        ${cards.releasedAt} AS "releasedAt"
      FROM ${cards}
      WHERE ${cards.oracleId} = ${oracleId}
        AND ${paperOnly}
        AND ${notArtSeries}
        ${setMatch}
      ORDER BY
        ${cards.setCode},
        ${cards.collectorNumber},
        (${cards.lang} = 'en') DESC,
        ${cards.releasedAt} DESC NULLS LAST,
        ${cards.scryfallId}
    ) AS one_per_printing
    ORDER BY (lang = 'en') DESC, "releasedAt" DESC NULLS LAST, "collectorNumber", "scryfallId"
    LIMIT ${query.limit + 1}
    OFFSET ${offset}
  `);

  const items = rows as unknown as Card[];
  const hasMore = items.length > query.limit;
  return {
    items: hasMore ? items.slice(0, query.limit) : items,
    nextCursor: hasMore ? String(offset + query.limit) : null,
  };
}

/**
 * Paper printings of the same set and collector number, one per language.
 *
 * English and Japanese of one set are two rows. A language that was never
 * printed for that card is left out.
 */
export async function listLanguagePrintings(db: Database, scryfallId: string): Promise<Card[]> {
  const printing = await db
    .select({
      setCode: cards.setCode,
      collectorNumber: cards.collectorNumber,
    })
    .from(cards)
    .where(eq(cards.scryfallId, scryfallId))
    .limit(1);
  const row = printing[0];
  if (!row) return [];

  const langs = await db
    .select(cardColumns)
    .from(cards)
    .where(
      and(
        eq(cards.setCode, row.setCode),
        eq(cards.collectorNumber, row.collectorNumber),
        paperOnly,
        notArtSeries,
      ),
    );

  const byLanguage = new Map<CardLanguage, Card>();
  for (const item of langs) {
    const parsed = cardLanguageSchema.safeParse(item.lang);
    if (!parsed.success || byLanguage.has(parsed.data)) continue;
    byLanguage.set(parsed.data, item as Card);
  }
  const english = byLanguage.get('en');
  const ordered: Card[] = [];
  for (const code of cardLanguageSchema.options) {
    const card = byLanguage.get(code);
    if (!card) continue;
    ordered.push(
      code === 'en' || !english
        ? card
        : { ...card, prices: marketPrices(card.prices, english.prices) },
    );
  }
  return ordered;
}

/** Languages this exact printing was produced in, in a stable order. */
export async function listLanguagesForPrinting(
  db: Database,
  scryfallId: string,
): Promise<CardLanguage[]> {
  const printings = await listLanguagePrintings(db, scryfallId);
  if (printings.length > 0) {
    return printings.map((card) => cardLanguageOrEnglish(card.lang));
  }
  const own = await db
    .select({ lang: cards.lang })
    .from(cards)
    .where(eq(cards.scryfallId, scryfallId))
    .limit(1);
  const lang = own[0]?.lang;
  return lang ? [cardLanguageOrEnglish(lang)] : [];
}

/** Refuses a language this printing was never produced in. */
export async function assertPrintedLanguage(
  db: Database,
  scryfallId: string,
  language: CardLanguage,
): Promise<void> {
  const printed = await listLanguagesForPrinting(db, scryfallId);
  if (!printed.includes(language)) {
    throw ApiError.badRequest('This card was not printed in that language.');
  }
}

/**
 * The sets this card was printed in, once each.
 *
 * The choose-a-set box lists these and narrows them as the owner types. A card
 * such as Plains has hundreds of printings but far fewer sets, so one list is
 * enough and the dropdown does not depend on which page of tiles is loaded.
 */
export async function listSetsByOracleId(db: Database, oracleId: string): Promise<CardSet[]> {
  const rows = await db
    .select({
      setCode: cards.setCode,
      setName: cards.setName,
    })
    .from(cards)
    .where(and(eq(cards.oracleId, oracleId), paperOnly, notArtSeries))
    .groupBy(cards.setCode, cards.setName)
    .orderBy(sql`${cards.setName} ASC NULLS LAST`, asc(cards.setCode));

  return rows;
}

/**
 * Refuses a printing that was never released on paper, and an Art Series card.
 *
 * Search and the set list already hide those rows. This is the last gate, so a
 * direct add cannot put an Arena-only, Magic Online-only, or art card into a binder.
 */
export async function assertPaperPrinting(db: Database, scryfallId: string): Promise<void> {
  const rows = await db
    .select({ raw: cards.raw, layout: cards.layout })
    .from(cards)
    .where(eq(cards.scryfallId, scryfallId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw ApiError.badRequest('Unknown card. The local Scryfall mirror may be out of date.');
  }
  const raw = row.raw as { games?: unknown };
  if (row.layout === 'art_series') {
    throw ApiError.badRequest('Art cards cannot be added to a binder.');
  }
  const games = raw.games;
  if (!Array.isArray(games) || !games.includes('paper')) {
    throw ApiError.badRequest('Only paper cards can be added to a binder.');
  }
}

function decodeOffset(cursor?: string): number {
  if (!cursor) return 0;
  const offset = Number(cursor);
  if (!Number.isInteger(offset) || offset < 0) throw ApiError.badRequest('Malformed cursor');
  return offset;
}

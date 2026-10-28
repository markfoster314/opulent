import type { Database } from '@opulent/db';
import { cardPriceSeries, cards } from '@opulent/db';
import type {
  Card,
  CardChoices,
  CardFinish,
  CardLanguage,
  CardPriceSeries,
  CardPrintingsQuery,
  CardSearchQuery,
  CardSet,
  Page,
  PriceRange,
  SetSearchQuery,
} from '@opulent/shared';
import {
  CARD_GAME,
  cardFinishSchema,
  cardLanguageOrEnglish,
  cardLanguageSchema,
  marketPrices,
  priceRangeDays,
} from '@opulent/shared';
import { and, asc, eq, sql, type SQL } from 'drizzle-orm';
import { ApiError } from '../../lib/http';

/** Scryfall marks digital printings in games; binders keep only paper rows. */
const paperOnly = sql`(${cards.game} = ${CARD_GAME} AND jsonb_exists(${cards.raw}->'games', 'paper'))`;

/** Scryfall Art Series art uses layout art_series; IS DISTINCT FROM keeps null layouts. */
const notArtSeries = sql`${cards.layout} IS DISTINCT FROM 'art_series'`;

/** Scryfall shop links; a null link means that shop has no page for the card. */
const purchaseUrisSql = sql`jsonb_build_object(
  'tcgplayer', ${cards.raw}->'purchase_uris'->>'tcgplayer',
  'cardmarket', ${cards.raw}->'purchase_uris'->>'cardmarket',
  'cardhoarder', ${cards.raw}->'purchase_uris'->>'cardhoarder'
)`;

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
  purchaseUris: purchaseUrisSql,
  releasedAt: cards.releasedAt,
};

/** Local substring plus Postgres pg_trgm typo search (0.3 threshold), deduped per card before the limit. */
export async function searchCards(db: Database, query: CardSearchQuery): Promise<Card[]> {
  const term = query.q.trim();
  const substring = sql`${cards.name} ILIKE ${`%${term}%`}`;
  const fuzzy = sql`(${cards.name} ILIKE ${`%${term}%`} OR ${cards.name} % ${term})`;

  async function flat(match: SQL): Promise<Card[]> {
    const rows = await db
      .select(cardColumns)
      .from(cards)
      .where(and(paperOnly, notArtSeries, match))
      .orderBy(
        sql`similarity(${cards.name}, ${term}) DESC`,
        sql`${cards.releasedAt} DESC NULLS LAST`,
      )
      .limit(query.limit);
    return rows as Card[];
  }

  async function unique(match: SQL): Promise<Card[]> {
    const rows = await db.execute<Card>(sql`
      WITH one_per_card AS MATERIALIZED (
        SELECT DISTINCT ON (${cards.oracleId})
          ${cards.scryfallId} AS scryfall_id,
          ${cards.lang} AS lang,
          similarity(${cards.name}, ${term}) AS score,
          ${cards.releasedAt} AS released_at
        FROM ${cards}
        WHERE ${paperOnly}
          AND ${notArtSeries}
          AND ${match}
        -- The English row is already the first DISTINCT ON pick when it exists.
        ORDER BY ${cards.oracleId}, (${cards.lang} = 'en') DESC, ${cards.releasedAt} DESC NULLS LAST
      ),
      page AS (
        SELECT * FROM one_per_card
        ORDER BY score DESC, released_at DESC NULLS LAST
        LIMIT ${query.limit}
      )
      SELECT
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
        ${purchaseUrisSql} AS "purchaseUris",
        one.released_at AS "releasedAt"
      FROM page one
      JOIN ${cards} ON ${cards.scryfallId} = one.scryfall_id
      ORDER BY one.score DESC, one.released_at DESC NULLS LAST
    `);
    return rows as unknown as Card[];
  }

  // Substring is cheaper, so run the pg_trgm match only when it misses a full page.
  const first = query.uniqueByOracle ? await unique(substring) : await flat(substring);
  if (first.length >= query.limit) return first;
  return query.uniqueByOracle ? unique(fuzzy) : flat(fuzzy);
}

export async function getCardById(db: Database, scryfallId: string): Promise<Card | undefined> {
  const rows = await db
    .select(cardColumns)
    .from(cards)
    .where(eq(cards.scryfallId, scryfallId))
    .limit(1);
  return rows[0] as Card | undefined;
}

/** One tile per printing, English first; offset paging is safe because printings only change nightly. */
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
    WITH one_per_printing AS MATERIALIZED (
      SELECT DISTINCT ON (${cards.setCode}, ${cards.collectorNumber})
        ${cards.scryfallId} AS scryfall_id,
        ${cards.lang} AS lang,
        ${cards.releasedAt} AS released_at,
        ${cards.setCode} AS set_code,
        ${cards.collectorNumber} AS collector_number
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
    ),
    page AS (
      SELECT * FROM one_per_printing
      ORDER BY
        (lang = 'en') DESC,
        released_at DESC NULLS LAST,
        collector_number,
        scryfall_id
      LIMIT ${query.limit + 1}
      OFFSET ${offset}
    )
    SELECT
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
      ${cards.raw}->>'oracle_text' AS "oracleText",
      ${cards.raw}->>'artist' AS artist,
      ${cards.finishes} AS finishes,
      ${cards.imageUris} AS "imageUris",
      ${cards.prices} AS prices,
      ${cards.scryfallUri} AS "scryfallUri",
      ${purchaseUrisSql} AS "purchaseUris",
      one.released_at AS "releasedAt"
    FROM page one
    JOIN ${cards} ON ${cards.scryfallId} = one.scryfall_id
    ORDER BY
      (one.lang = 'en') DESC,
      one.released_at DESC NULLS LAST,
      one.collector_number,
      one.scryfall_id
  `);
  const items = rows as unknown as Card[];
  const hasMore = items.length > query.limit;
  return {
    items: hasMore ? items.slice(0, query.limit) : items,
    nextCursor: hasMore ? String(offset + query.limit) : null,
  };
}

/** Paper printings of one set and collector number, one per existing language. */
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

/** Languages, finishes, and sets on paper; one set entry each so the picker ignores paging. */
export async function listOracleChoices(db: Database, oracleId: string): Promise<CardChoices> {
  const rows = await db
    .select({
      lang: cards.lang,
      finishes: cards.finishes,
      setCode: cards.setCode,
      setName: cards.setName,
    })
    .from(cards)
    .where(and(eq(cards.oracleId, oracleId), paperOnly, notArtSeries));

  const languages = new Set<CardLanguage>();
  const finishes = new Set<CardFinish>();
  const sets = new Map<string, CardSet>();
  for (const row of rows) {
    languages.add(cardLanguageOrEnglish(row.lang));
    for (const finish of row.finishes ?? []) {
      const parsed = cardFinishSchema.safeParse(finish);
      if (parsed.success) finishes.add(parsed.data);
    }
    if (!sets.has(row.setCode)) {
      sets.set(row.setCode, { setCode: row.setCode, setName: row.setName });
    }
  }

  return {
    languages: cardLanguageSchema.options.filter((code) => languages.has(code)),
    finishes: cardFinishSchema.options.filter((code) => finishes.has(code)),
    sets: [...sets.values()].sort((a, b) =>
      (a.setName ?? a.setCode).localeCompare(b.setName ?? b.setCode),
    ),
  };
}

export async function searchSets(db: Database, query: SetSearchQuery): Promise<CardSet[]> {
  const pattern = `%${query.q.trim()}%`;
  const rows = (await db.execute(sql`
    SELECT
      ${cards.setCode} AS "setCode",
      max(${cards.setName}) AS "setName"
    FROM ${cards}
    WHERE ${cards.layout} IS DISTINCT FROM 'art_series'
      AND (
        ${cards.setName} ILIKE ${pattern}
        OR ${cards.setCode} ILIKE ${pattern}
      )
    GROUP BY ${cards.setCode}
    ORDER BY max(${cards.setName}) ASC NULLS LAST, ${cards.setCode}
    LIMIT ${query.limit}
  `)) as unknown as { setCode: string; setName: string | null }[];

  return rows.filter((row) => row.setCode.length > 0);
}

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

/** Last gate: rejects digital-only and Art Series rows that search already hides. */
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

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Daily prices with the last stored value carried forward; history stores change points only. */
export async function getCardPriceSeries(
  db: Database,
  scryfallId: string,
  range: PriceRange,
): Promise<CardPriceSeries> {
  const today = new Date();
  const from = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate() - priceRangeDays[range],
    ),
  );
  const points = await cardPriceSeries(db, scryfallId, isoDay(from), isoDay(today));
  return { range, points };
}

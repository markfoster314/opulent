import type { Database } from '@opulent/db';
import { cards } from '@opulent/db';
import type { Card, CardPrintingsQuery, CardSearchQuery, Page } from '@opulent/shared';
import { and, asc, eq, sql } from 'drizzle-orm';
import { ApiError } from '../../lib/http';

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
 * trigram similarity score, which handles typos like "lighning bolt".
 */
export async function searchCards(db: Database, query: CardSearchQuery): Promise<Card[]> {
  const term = query.q.trim();
  // Over-fetch when deduplicating, since collapsing printings shrinks the result set.
  const fetchLimit = query.uniqueByOracle ? query.limit * 4 : query.limit;

  const rows = await db
    .select(cardColumns)
    .from(cards)
    .where(sql`${cards.name} ILIKE ${`%${term}%`} OR similarity(${cards.name}, ${term}) > 0.3`)
    .orderBy(sql`similarity(${cards.name}, ${term}) DESC`, sql`${cards.releasedAt} DESC NULLS LAST`)
    .limit(fetchLimit);

  const result = rows as Card[];
  if (!query.uniqueByOracle) return result;

  const seen = new Set<string>();
  const unique: Card[] = [];
  for (const card of result) {
    if (seen.has(card.oracleId)) continue;
    seen.add(card.oracleId);
    unique.push(card);
    if (unique.length >= query.limit) break;
  }
  return unique;
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
 * Every printing of one card concept, for the printing picker.
 *
 * English printings sort first because they are what most traders hold, but no
 * language is filtered out, because a handful of cards only ever shipped in
 * Japanese and hiding them would make them unaddable.
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

  const filters = [eq(cards.oracleId, oracleId)];
  if (term) {
    filters.push(
      sql`(${cards.setName} ILIKE ${`%${term}%`} OR ${cards.setCode} ILIKE ${`%${term}%`})`,
    );
  }

  const rows = await db
    .select(cardColumns)
    .from(cards)
    .where(and(...filters))
    .orderBy(
      sql`(${cards.lang} = 'en') DESC`,
      sql`${cards.releasedAt} DESC NULLS LAST`,
      asc(cards.collectorNumber),
      // Breaks ties so that offset paging cannot show or skip a row.
      asc(cards.scryfallId),
    )
    .limit(query.limit + 1)
    .offset(offset);

  const hasMore = rows.length > query.limit;
  return {
    items: (hasMore ? rows.slice(0, query.limit) : rows) as Card[],
    nextCursor: hasMore ? String(offset + query.limit) : null,
  };
}

function decodeOffset(cursor?: string): number {
  if (!cursor) return 0;
  const offset = Number(cursor);
  if (!Number.isInteger(offset) || offset < 0) throw ApiError.badRequest('Malformed cursor');
  return offset;
}

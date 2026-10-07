import type { Database } from '@opulent/db';
import { cards } from '@opulent/db';
import type { Card, CardSearchQuery } from '@opulent/shared';
import { eq, sql } from 'drizzle-orm';

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

/** Every printing of one card concept, newest set first. */
export async function getPrintingsByOracleId(db: Database, oracleId: string): Promise<Card[]> {
  const rows = await db
    .select(cardColumns)
    .from(cards)
    .where(eq(cards.oracleId, oracleId))
    .orderBy(sql`${cards.releasedAt} DESC NULLS LAST`);
  return rows as Card[];
}

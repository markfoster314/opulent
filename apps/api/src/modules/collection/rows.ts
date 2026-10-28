import type { Database } from '@opulent/db';
import {
  cardGroups,
  cards,
  collectionItems,
  genericWants,
  groupMemberships,
  wantItems,
} from '@opulent/db';
import type {
  CardFinish,
  CollectionItem,
  CollectionItemQuery,
  GroupRef,
  ItemPrice,
  Page,
} from '@opulent/shared';
import {
  CARD_GAME,
  cardFinishSchema,
  cardLanguageOrEnglish,
  marketPrices,
  parseCustomAmount,
} from '@opulent/shared';
import { and, asc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ApiError } from '../../lib/http';

function isCardFinish(value: string): value is CardFinish {
  return cardFinishSchema.safeParse(value).success;
}

const collectionItemSelection = {
  id: collectionItems.id,
  scryfallId: collectionItems.scryfallId,
  quantity: collectionItems.quantity,
  finish: collectionItems.finish,
  condition: collectionItems.condition,
  language: collectionItems.language,
  signed: collectionItems.signed,
  altered: collectionItems.altered,
  misprint: collectionItems.misprint,
  miscut: collectionItems.miscut,
  artistProof: collectionItems.artistProof,
  notes: collectionItems.notes,
  photoUrl: collectionItems.photoUrl,
  forTrade: collectionItems.forTrade,
  priceKind: collectionItems.priceKind,
  pricePercent: collectionItems.pricePercent,
  priceAmount: collectionItems.priceAmount,
  cardName: cards.name,
  cardSetCode: cards.setCode,
  cardSetName: cards.setName,
  cardCollectorNumber: cards.collectorNumber,
  cardRarity: cards.rarity,
  cardOracleId: cards.oracleId,
  cardImageUris: cards.imageUris,
  cardPrices: cards.prices,
  cardFinishes: cards.finishes,
  cardLayout: cards.layout,
  cardTypeLine: cards.typeLine,
  cardManaCost: cards.manaCost,
  cardScryfallUri: cards.scryfallUri,
  cardReleasedAt: cards.releasedAt,
  cardOracleText: sql<string | null>`${cards.raw}->>'oracle_text'`,
  cardArtist: sql<string | null>`${cards.raw}->>'artist'`,
};

type CollectionItemJoinRow = Awaited<ReturnType<typeof selectCollectionItems>>[number];

export const englishCards = alias(cards, 'english_card');

export function englishPrintingJoin() {
  return and(
    eq(englishCards.setCode, cards.setCode),
    eq(englishCards.collectorNumber, cards.collectorNumber),
    eq(englishCards.lang, 'en'),
    sql`jsonb_exists(${englishCards.raw}->'games', 'paper')`,
    sql`${englishCards.layout} IS DISTINCT FROM 'art_series'`,
  );
}

export function selectCollectionItems(db: Database) {
  return db
    .select({
      ...collectionItemSelection,
      englishPrices: englishCards.prices,
    })
    .from(collectionItems)
    .innerJoin(cards, eq(cards.scryfallId, collectionItems.scryfallId))
    .leftJoin(englishCards, englishPrintingJoin());
}

function toItemPrice(
  row: Pick<CollectionItemJoinRow, 'priceKind' | 'pricePercent' | 'priceAmount'>,
): ItemPrice {
  if (row.priceKind === 'percent') return { kind: 'percent', percent: row.pricePercent };
  if (row.priceKind === 'custom') return { kind: 'custom', amount: row.priceAmount };
  return { kind: 'market' };
}

/** Fills unused price columns so each row is complete: market uses 100, custom uses 0. */
export function priceColumns(price: ItemPrice | undefined): {
  priceKind: ItemPrice['kind'];
  pricePercent: number;
  priceAmount: string;
} {
  const chosen = price ?? { kind: 'market' as const };
  if (chosen.kind === 'percent') {
    return { priceKind: 'percent', pricePercent: chosen.percent, priceAmount: '' };
  }
  if (chosen.kind === 'custom') {
    return {
      priceKind: 'custom',
      pricePercent: 0,
      priceAmount: parseCustomAmount(chosen.amount) ?? chosen.amount,
    };
  }
  return { priceKind: 'market', pricePercent: 100, priceAmount: '' };
}

export function toCollectionItem(row: CollectionItemJoinRow, groups: GroupRef[]): CollectionItem {
  return {
    id: row.id,
    scryfallId: row.scryfallId,
    quantity: row.quantity,
    finish: row.finish,
    condition: row.condition,
    language: cardLanguageOrEnglish(row.language),
    signed: row.signed,
    altered: row.altered,
    misprint: row.misprint,
    miscut: row.miscut,
    artistProof: row.artistProof,
    notes: row.notes,
    photoUrl: row.photoUrl,
    forTrade: row.forTrade,
    price: toItemPrice(row),
    groups,
    availableFinishes: (row.cardFinishes ?? []).filter(isCardFinish),
    card: {
      scryfallId: row.scryfallId,
      oracleId: row.cardOracleId,
      name: row.cardName,
      setCode: row.cardSetCode,
      setName: row.cardSetName,
      collectorNumber: row.cardCollectorNumber,
      rarity: row.cardRarity,
      lang: row.language,
      layout: row.cardLayout,
      typeLine: row.cardTypeLine,
      manaCost: row.cardManaCost,
      finishes: (row.cardFinishes ?? []).filter(isCardFinish),
      imageUris: row.cardImageUris ?? null,
      prices: marketPrices(row.cardPrices, row.englishPrices),
      scryfallUri: row.cardScryfallUri,
      oracleText: row.cardOracleText,
      artist: row.cardArtist,
      releasedAt: row.cardReleasedAt,
    },
  };
}

export async function loadGroupsForItems(
  db: Database,
  itemIds: string[],
): Promise<Map<string, GroupRef[]>> {
  const byItem = new Map<string, GroupRef[]>();
  if (itemIds.length === 0) return byItem;
  const rows = await db
    .select({ itemId: groupMemberships.itemId, groupId: cardGroups.id, name: cardGroups.name })
    .from(groupMemberships)
    .innerJoin(cardGroups, eq(cardGroups.id, groupMemberships.groupId))
    .where(inArray(groupMemberships.itemId, itemIds))
    .orderBy(asc(cardGroups.name));
  for (const row of rows) {
    const list = byItem.get(row.itemId) ?? [];
    list.push({ id: row.groupId, name: row.name });
    byItem.set(row.itemId, list);
  }
  return byItem;
}

export type CollectionItemListQuery = Partial<CollectionItemQuery> & { limit: number };

/** Keyset pagination by name and id, so a mid-scroll insert cannot duplicate or skip rows. */
export async function pageOfItems(
  db: Database,
  scope: SQL | undefined,
  pagination: CollectionItemListQuery,
  viewerId: string | undefined,
  withGroups: boolean,
): Promise<Page<CollectionItem>> {
  const after = decodeCursor(pagination.cursor);
  const rows = await selectCollectionItems(db)
    .where(
      and(
        scope,
        after
          ? sql`(${cards.name}, ${collectionItems.id}) > (${after.name}, ${after.id}::uuid)`
          : undefined,
        ...collectionItemFilters(pagination, viewerId),
      ),
    )
    .orderBy(asc(cards.name), asc(collectionItems.id))
    .limit(pagination.limit + 1);

  const hasMore = rows.length > pagination.limit;
  const page = hasMore ? rows.slice(0, pagination.limit) : rows;
  const last = page[page.length - 1];

  const items = page.map((row) => toCollectionItem(row, []));
  if (withGroups) {
    const groups = await loadGroupsForItems(
      db,
      items.map((item) => item.id),
    );
    for (const item of items) item.groups = groups.get(item.id) ?? [];
  }

  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last.cardName, last.id) : null,
  };
}

/** Escapes LIKE wildcards so % and _ in a typed name stay literal. */
export function containsPattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export function collectionItemFilters(
  query: CollectionItemListQuery,
  viewerId: string | undefined,
): SQL[] {
  const clauses: SQL[] = [eq(cards.game, CARD_GAME)];
  if (query.q) {
    clauses.push(sql`${cards.name} ILIKE ${containsPattern(query.q)} ESCAPE '\\'`);
  }
  if (query.set) {
    clauses.push(
      sql`(
        lower(${cards.setCode}) = lower(${query.set})
        OR ${cards.setName} ILIKE ${containsPattern(query.set)} ESCAPE '\\'
      )`,
    );
  }
  if (query.finish) clauses.push(eq(collectionItems.finish, query.finish));
  if (query.condition) clauses.push(eq(collectionItems.condition, query.condition));
  if (query.language) clauses.push(eq(collectionItems.language, query.language));
  if (query.rarity) clauses.push(eq(cards.rarity, query.rarity));
  if (query.type) {
    clauses.push(sql`${cards.typeLine} ILIKE ${containsPattern(query.type)} ESCAPE '\\'`);
  }
  if (query.artist) {
    clauses.push(sql`${cards.raw}->>'artist' ILIKE ${containsPattern(query.artist)} ESCAPE '\\'`);
  }
  if (query.groupId) {
    clauses.push(sql`EXISTS (
      SELECT 1 FROM ${groupMemberships}
      WHERE ${groupMemberships.itemId} = ${collectionItems.id}
        AND ${groupMemberships.groupId} = ${query.groupId}
    )`);
  }
  if (query.forTrade) clauses.push(eq(collectionItems.forTrade, true));
  if (query.signed) clauses.push(eq(collectionItems.signed, true));
  if (query.altered) clauses.push(eq(collectionItems.altered, true));
  if (query.misprint) clauses.push(eq(collectionItems.misprint, true));
  if (query.miscut) clauses.push(eq(collectionItems.miscut, true));
  if (query.artistProof) clauses.push(eq(collectionItems.artistProof, true));
  if (query.onWantList) {
    if (!viewerId) throw ApiError.unauthorized('Sign in to filter by your want lists.');
    clauses.push(sql`EXISTS (
      SELECT 1 FROM ${wantItems} wi
      WHERE wi.user_id = ${viewerId}
        AND wi.oracle_id = ${cards.oracleId}
        AND (cardinality(wi.wanted_languages) = 0 OR ${cards.lang} = ANY(wi.wanted_languages))
        AND (cardinality(wi.wanted_finishes) = 0 OR ${collectionItems.finish}::text = ANY(wi.wanted_finishes))
        AND (cardinality(wi.wanted_conditions) = 0 OR ${collectionItems.condition}::text = ANY(wi.wanted_conditions))
        AND (cardinality(wi.wanted_sets) = 0 OR lower(${cards.setCode}) = ANY(wi.wanted_sets))
    )`);
  }
  if (query.onGenericWant) {
    if (!viewerId) throw ApiError.unauthorized('Sign in to filter by your generic wants.');
    clauses.push(sql`EXISTS (
      SELECT 1 FROM ${genericWants} gw
      WHERE gw.user_id = ${viewerId}
        AND (cardinality(gw.languages) = 0 OR ${cards.lang} = ANY(gw.languages))
        AND (cardinality(gw.finishes) = 0 OR ${collectionItems.finish}::text = ANY(gw.finishes))
        AND (cardinality(gw.conditions) = 0 OR ${collectionItems.condition}::text = ANY(gw.conditions))
        AND (cardinality(gw.sets) = 0 OR lower(${cards.setCode}) = ANY(gw.sets))
        AND (NOT gw.signed OR ${collectionItems.signed})
        AND (NOT gw.altered OR ${collectionItems.altered})
        AND (NOT gw.misprint OR ${collectionItems.misprint})
        AND (NOT gw.miscut OR ${collectionItems.miscut})
        AND (NOT gw.artist_proof OR ${collectionItems.artistProof})
    )`);
  }
  return clauses;
}

export function encodeCursor(name: string, id: string): string {
  return Buffer.from(`${name}\u0000${id}`, 'utf8').toString('base64url');
}

export function decodeCursor(cursor?: string): { name: string; id: string } | undefined {
  if (!cursor) return undefined;
  const [name, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('\u0000');
  if (!name || !id) throw ApiError.badRequest('Malformed cursor');
  return { name, id };
}

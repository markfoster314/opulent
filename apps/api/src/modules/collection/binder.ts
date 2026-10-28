import type { Database, UserRow } from '@opulent/db';
import { cards, collectionItems, users } from '@opulent/db';
import type { CollectionItem, Page, TradeBinder, TradeMatch } from '@opulent/shared';
import { CARD_GAME } from '@opulent/shared';
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm';
import { ApiError } from '../../lib/http';
import {
  pageOfItems,
  selectCollectionItems,
  toCollectionItem,
  type CollectionItemListQuery,
} from './rows';

export interface ViewerContext {
  userId?: string | undefined;
  shareToken?: string | undefined;
}

/** Owner, public, or matching unlisted token; otherwise hide as not found. */
export function assertCanViewTradeBinder(owner: UserRow, viewer: ViewerContext): void {
  if (viewer.userId && owner.id === viewer.userId) return;
  if (owner.tradeBinderVisibility === 'public') return;
  if (
    owner.tradeBinderVisibility === 'unlisted' &&
    viewer.shareToken === owner.tradeBinderShareToken
  ) {
    return;
  }
  throw ApiError.notFound('Trade binder not found');
}

/** What a visitor sees above the binder; the share token stays with the owner. */
export async function getTradeBinder(
  db: Database,
  owner: UserRow,
  viewer: ViewerContext,
): Promise<TradeBinder> {
  assertCanViewTradeBinder(owner, viewer);
  const rows = await db
    .select({ cardCount: sql<number>`coalesce(sum(${collectionItems.quantity}), 0)::int` })
    .from(collectionItems)
    .where(and(eq(collectionItems.userId, owner.id), eq(collectionItems.forTrade, true)));
  const isOwner = viewer.userId === owner.id;
  return {
    username: owner.username,
    visibility: owner.tradeBinderVisibility,
    cardCount: Number(rows[0]?.cardCount ?? 0),
    ...(isOwner ? { shareToken: owner.tradeBinderShareToken } : {}),
  };
}

/** Invalidates every trade binder link handed out so far. */
export async function rotateTradeBinderToken(db: Database, userId: string): Promise<string> {
  const updated = await db
    .update(users)
    .set({ tradeBinderShareToken: sql`encode(gen_random_bytes(16), 'hex')`, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ shareToken: users.tradeBinderShareToken });
  const token = updated[0]?.shareToken;
  if (!token) throw ApiError.notFound('User not found');
  return token;
}

/** For-trade stacks; call assertCanViewTradeBinder first, and never expose private group names. */
export async function listTradeBinderItems(
  db: Database,
  ownerId: string,
  pagination: CollectionItemListQuery,
  viewerId?: string,
): Promise<Page<CollectionItem>> {
  return pageOfItems(
    db,
    and(eq(collectionItems.userId, ownerId), eq(collectionItems.forTrade, true)),
    pagination,
    viewerId,
    false,
  );
}

interface MatchAggregateRow {
  wantId: string;
  oracleId: string;
  cardName: string;
  wantQuantity: number;
  wantPriority: number;
  availableQuantity: number;
  wantedLanguages: string[] | null;
  wantedFinishes: string[] | null;
  wantedConditions: string[] | null;
  wantedSets: string[] | null;
}

function textList(value: string[] | null): string[] {
  return value ?? [];
}

/** Empty keep-lists mean any value. */
function valueAllowed(wanted: string[], value: string): boolean {
  const folded = value.toLowerCase();
  const keep = wanted.map((item) => item.toLowerCase());
  return keep.length === 0 || keep.includes(folded);
}

export async function findTradeBinderMatches(
  db: Database,
  ownerId: string,
  viewerUserId: string,
): Promise<TradeMatch[]> {
  return matchesWithin(
    db,
    sql`bi.user_id = ${ownerId}`,
    eq(collectionItems.userId, ownerId),
    viewerUserId,
  );
}

/** Want-to-printing join resolves a want for a card concept to every for-trade printing in scope. */
async function matchesWithin(
  db: Database,
  scope: SQL,
  printingScope: SQL,
  viewerUserId: string,
): Promise<TradeMatch[]> {
  const aggregates = (await db.execute(sql`
    SELECT
      w.id                        AS "wantId",
      w.oracle_id                 AS "oracleId",
      MIN(c.name)                 AS "cardName",
      w.quantity                  AS "wantQuantity",
      w.priority                  AS "wantPriority",
      SUM(bi.quantity)::int       AS "availableQuantity",
      w.wanted_languages          AS "wantedLanguages",
      w.wanted_finishes           AS "wantedFinishes",
      w.wanted_conditions         AS "wantedConditions",
      w.wanted_sets               AS "wantedSets"
    FROM want_items w
    JOIN cards c              ON c.oracle_id = w.oracle_id
    JOIN collection_items bi  ON bi.scryfall_id = c.scryfall_id
    WHERE w.user_id = ${viewerUserId}
      AND ${scope}
      AND c.game = ${CARD_GAME}
      AND bi.for_trade = true
      AND (
        cardinality(w.wanted_languages) = 0
        OR c.lang = ANY(w.wanted_languages)
      )
      AND (
        cardinality(w.wanted_finishes) = 0
        OR bi.finish::text = ANY(w.wanted_finishes)
      )
      AND (
        cardinality(w.wanted_conditions) = 0
        OR bi.condition::text = ANY(w.wanted_conditions)
      )
      AND (
        cardinality(w.wanted_sets) = 0
        OR lower(c.set_code) = ANY(w.wanted_sets)
      )
    GROUP BY
      w.id, w.oracle_id, w.quantity, w.priority,
      w.wanted_languages, w.wanted_finishes,
      w.wanted_conditions, w.wanted_sets
    ORDER BY w.priority ASC, MIN(c.name) ASC
  `)) as unknown as MatchAggregateRow[];

  if (aggregates.length === 0) return [];

  const oracleIds = aggregates.map((row) => row.oracleId);

  // Second trip for individual printings avoids a correlated subquery per want row.
  const printingRows = await selectCollectionItems(db).where(
    and(printingScope, eq(collectionItems.forTrade, true), inArray(cards.oracleId, oracleIds)),
  );

  const printingsByOracle = new Map<string, CollectionItem[]>();
  for (const row of printingRows) {
    const list = printingsByOracle.get(row.cardOracleId) ?? [];
    list.push(toCollectionItem(row, []));
    printingsByOracle.set(row.cardOracleId, list);
  }

  return aggregates.map((row) => ({
    wantId: row.wantId,
    oracleId: row.oracleId,
    cardName: row.cardName,
    wantQuantity: row.wantQuantity,
    wantPriority: row.wantPriority,
    availableQuantity: row.availableQuantity,
    printings: (printingsByOracle.get(row.oracleId) ?? []).filter((item) => {
      const setCode = item.card?.setCode ?? '';
      return (
        valueAllowed(textList(row.wantedLanguages), item.language) &&
        valueAllowed(textList(row.wantedFinishes), item.finish) &&
        valueAllowed(textList(row.wantedConditions), item.condition) &&
        valueAllowed(textList(row.wantedSets), setCode)
      );
    }),
  }));
}

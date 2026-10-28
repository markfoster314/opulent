import type { Database, TradeRow } from '@opulent/db';
import { cards, collectionItems, tradeItems, trades, users } from '@opulent/db';
import type {
  CardFinish,
  CardImageUris,
  CardPrices,
  TradeCard,
  TradeChoice,
  TradeChoices,
  TradeDetail,
  TradeSummary,
} from '@opulent/shared';
import { CARD_GAME, marketPrices, priceForFinish } from '@opulent/shared';
import { and, asc, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ApiError } from '../../lib/http';

export type Line = { scryfallId: string; quantity: number };
export type Side = 'offered' | 'requested';

export const finished = new Set(['completed', 'cancelled', 'declined']);
export const live = new Set(['proposed', 'countered', 'accepted']);

export async function listTrades(db: Database, userId: string): Promise<TradeSummary[]> {
  const rows = await db
    .select()
    .from(trades)
    .where(
      or(
        eq(trades.proposerId, userId),
        and(eq(trades.receiverId, userId), ne(trades.status, 'draft')),
      ),
    )
    .orderBy(desc(trades.updatedAt));
  if (rows.length === 0) return [];

  const names = await usernames(
    db,
    rows.map((row) => partnerId(row, userId)),
  );
  const counts = await sideCounts(
    db,
    rows.map((row) => row.id),
  );

  return rows.map((row) => {
    const receive = receiveSide(row, userId);
    const give = otherSide(receive);
    return {
      id: row.id,
      status: row.status,
      partnerUsername: names.get(partnerId(row, userId)) ?? 'unknown',
      yourTurn: row.turnUserId === userId && !finished.has(row.status),
      youFinalized: finalizedAt(row, userId) !== null,
      theyFinalized: finalizedAt(row, partnerId(row, userId)) !== null,
      youReceiveCount: counts.get(`${row.id}:${receive}`) ?? 0,
      youGiveCount: counts.get(`${row.id}:${give}`) ?? 0,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function getTrade(
  db: Database,
  userId: string,
  tradeId: string,
): Promise<TradeDetail> {
  const trade = await requireTrade(db, tradeId, userId);
  return toDetail(db, trade, userId);
}

/** Their for-trade stock fills "You get". Your own fills "You give". */
export async function listChoices(
  db: Database,
  userId: string,
  tradeId: string,
): Promise<TradeChoices> {
  const trade = await requireTrade(db, tradeId, userId);
  const [items, mine] = await Promise.all([
    stockChoices(db, partnerId(trade, userId)),
    stockChoices(db, userId),
  ]);
  return { items, mine };
}

async function stockChoices(db: Database, ownerId: string): Promise<TradeChoice[]> {
  const rows = await db
    .select({
      scryfallId: cards.scryfallId,
      name: cards.name,
      setCode: cards.setCode,
      imageUris: cards.imageUris,
      prices: cards.prices,
      englishPrices: englishCards.prices,
      available: sql<number>`sum(${collectionItems.quantity})::int`,
      finish: dominantFinish,
    })
    .from(collectionItems)
    .innerJoin(cards, eq(cards.scryfallId, collectionItems.scryfallId))
    .leftJoin(englishCards, englishPrintingJoin())
    .where(
      and(
        eq(collectionItems.userId, ownerId),
        eq(collectionItems.forTrade, true),
        eq(cards.game, CARD_GAME),
      ),
    )
    .groupBy(
      cards.scryfallId,
      cards.name,
      cards.setCode,
      cards.imageUris,
      cards.prices,
      englishCards.prices,
    )
    .orderBy(asc(cards.name));

  return rows
    .filter((row) => Number(row.available) > 0)
    .map((row) => ({
      scryfallId: row.scryfallId,
      name: row.name,
      setCode: row.setCode,
      availableQuantity: Number(row.available),
      imageUris: readImage(row.imageUris),
      marketPrice: priceForFinish(
        marketPrices(row.prices as CardPrices | null, row.englishPrices as CardPrices | null),
        row.finish,
      ),
    }));
}

/** The finish this person holds the most copies of, for pricing one printing. */
const dominantFinish = sql<CardFinish>`mode() WITHIN GROUP (ORDER BY ${collectionItems.finish})`;

const englishCards = alias(cards, 'english_card');

/** Scryfall prices the English printing. A foreign row of the same set and number borrows it. */
function englishPrintingJoin() {
  return and(
    eq(englishCards.setCode, cards.setCode),
    eq(englishCards.collectorNumber, cards.collectorNumber),
    eq(englishCards.lang, 'en'),
    sql`jsonb_exists(${englishCards.raw}->'games', 'paper')`,
    sql`${englishCards.layout} IS DISTINCT FROM 'art_series'`,
  );
}

export async function requireTrade(
  db: Database,
  tradeId: string,
  userId: string,
): Promise<TradeRow> {
  const [trade] = await db.select().from(trades).where(eq(trades.id, tradeId)).limit(1);
  if (!trade) throw ApiError.notFound('Trade not found');
  if (trade.proposerId !== userId && trade.receiverId !== userId) {
    throw ApiError.forbidden('You are not part of this trade.');
  }
  if (trade.status === 'draft' && trade.proposerId !== userId) {
    throw ApiError.notFound('Trade not found');
  }
  return trade;
}

export async function stockByPrinting(
  db: Database,
  ownerId: string,
  scryfallIds: string[],
): Promise<Map<string, { available: number; finish: CardFinish }>> {
  const unique = [...new Set(scryfallIds)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({
      scryfallId: collectionItems.scryfallId,
      available: sql<number>`sum(${collectionItems.quantity})::int`,
      finish: dominantFinish,
    })
    .from(collectionItems)
    .where(
      and(
        eq(collectionItems.userId, ownerId),
        eq(collectionItems.forTrade, true),
        inArray(collectionItems.scryfallId, unique),
      ),
    )
    .groupBy(collectionItems.scryfallId);
  return new Map(
    rows.map((row) => [row.scryfallId, { available: Number(row.available), finish: row.finish }]),
  );
}

export async function toDetail(
  db: Database,
  trade: TradeRow,
  userId: string,
): Promise<TradeDetail> {
  const receive = receiveSide(trade, userId);
  const rows = await db
    .select({
      side: tradeItems.side,
      scryfallId: tradeItems.scryfallId,
      quantity: tradeItems.quantity,
      name: cards.name,
      setCode: cards.setCode,
      imageUris: cards.imageUris,
      prices: cards.prices,
      englishPrices: englishCards.prices,
    })
    .from(tradeItems)
    .innerJoin(cards, eq(cards.scryfallId, tradeItems.scryfallId))
    .leftJoin(englishCards, englishPrintingJoin())
    .where(eq(tradeItems.tradeId, trade.id))
    .orderBy(asc(cards.name));

  const stock = await stockByPrinting(db, partnerId(trade, userId), [
    ...rows.filter((row) => row.side === receive).map((row) => row.scryfallId),
  ]);
  const ownStock = await stockByPrinting(
    db,
    userId,
    rows.filter((row) => row.side !== receive).map((row) => row.scryfallId),
  );

  const youReceive: TradeCard[] = [];
  const youGive: TradeCard[] = [];
  for (const row of rows) {
    const held = row.side === receive ? stock.get(row.scryfallId) : ownStock.get(row.scryfallId);
    const card: TradeCard = {
      scryfallId: row.scryfallId,
      quantity: row.quantity,
      name: row.name,
      setCode: row.setCode,
      imageUris: readImage(row.imageUris),
      availableQuantity: held?.available ?? row.quantity,
      marketPrice: priceForFinish(
        marketPrices(row.prices as CardPrices | null, row.englishPrices as CardPrices | null),
        held?.finish ?? 'nonfoil',
      ),
    };
    if (row.side === receive) youReceive.push(card);
    else youGive.push(card);
  }

  const names = await usernames(db, [partnerId(trade, userId)]);
  return {
    id: trade.id,
    status: trade.status,
    partnerUsername: names.get(partnerId(trade, userId)) ?? 'unknown',
    yourTurn: trade.turnUserId === userId && !finished.has(trade.status),
    youFinalized: finalizedAt(trade, userId) !== null,
    theyFinalized: finalizedAt(trade, partnerId(trade, userId)) !== null,
    youReceiveCount: youReceive.reduce((sum, card) => sum + card.quantity, 0),
    youGiveCount: youGive.reduce((sum, card) => sum + card.quantity, 0),
    updatedAt: trade.updatedAt.toISOString(),
    youReceive,
    youGive,
  };
}

async function usernames(db: Database, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(inArray(users.id, unique));
  return new Map(rows.map((row) => [row.id, row.username]));
}

async function sideCounts(db: Database, tradeIds: string[]): Promise<Map<string, number>> {
  const rows = await db
    .select({
      tradeId: tradeItems.tradeId,
      side: tradeItems.side,
      total: sql<number>`sum(${tradeItems.quantity})::int`,
    })
    .from(tradeItems)
    .where(inArray(tradeItems.tradeId, tradeIds))
    .groupBy(tradeItems.tradeId, tradeItems.side);
  return new Map(rows.map((row) => [`${row.tradeId}:${row.side}`, Number(row.total)]));
}

export function partnerId(trade: TradeRow, userId: string): string {
  return trade.proposerId === userId ? trade.receiverId : trade.proposerId;
}

export function receiveSide(trade: TradeRow, userId: string): Side {
  return trade.proposerId === userId ? 'requested' : 'offered';
}

export function otherSide(side: Side): Side {
  return side === 'requested' ? 'offered' : 'requested';
}

function finalizedAt(trade: TradeRow, userId: string): Date | null {
  return trade.proposerId === userId ? trade.proposerFinalizedAt : trade.receiverFinalizedAt;
}

function readImage(value: unknown): CardImageUris | null {
  const source = typeof value === 'string' ? parseJson(value) : value;
  if (!source || typeof source !== 'object') return null;
  const row = source as Record<string, unknown>;
  const image: CardImageUris = {};
  for (const key of ['small', 'normal', 'large', 'png', 'art_crop', 'border_crop'] as const) {
    if (typeof row[key] === 'string') image[key] = row[key];
  }
  return Object.keys(image).length > 0 ? image : null;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

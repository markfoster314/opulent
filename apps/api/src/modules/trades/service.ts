import type { Database, TradeRow } from '@opulent/db';
import { binderItems, binders, cards, tradeItems, trades, users } from '@opulent/db';
import type {
  CardImageUris,
  CreateTradeInput,
  TradeCard,
  TradeChoice,
  TradeDetail,
  TradeLinesInput,
  TradeSummary,
} from '@opulent/shared';
import { and, asc, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { ApiError } from '../../lib/http';
import { getUserByUsername } from '../users/service';

type Line = { scryfallId: string; quantity: number };
type Side = 'offered' | 'requested';

const finished = new Set(['completed', 'cancelled', 'declined']);
const live = new Set(['proposed', 'countered', 'accepted']);

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

export async function listChoices(
  db: Database,
  userId: string,
  tradeId: string,
): Promise<TradeChoice[]> {
  const trade = await requireTrade(db, tradeId, userId);
  const rows = await db
    .select({
      scryfallId: cards.scryfallId,
      name: cards.name,
      setCode: cards.setCode,
      imageUris: cards.imageUris,
      available: sql<number>`sum(${binderItems.quantity})::int`,
    })
    .from(binderItems)
    .innerJoin(binders, eq(binders.id, binderItems.binderId))
    .innerJoin(cards, eq(cards.scryfallId, binderItems.scryfallId))
    .where(and(eq(binders.userId, partnerId(trade, userId)), eq(binderItems.forTrade, true)))
    .groupBy(cards.scryfallId, cards.name, cards.setCode, cards.imageUris)
    .orderBy(asc(cards.name));

  return rows
    .filter((row) => Number(row.available) > 0)
    .map((row) => ({
      scryfallId: row.scryfallId,
      name: row.name,
      setCode: row.setCode,
      availableQuantity: Number(row.available),
      imageUris: readImage(row.imageUris),
    }));
}

/** Starts a trade, or adds these cards to the open trade these two people already have. */
export async function openTrade(
  db: Database,
  userId: string,
  input: CreateTradeInput,
): Promise<TradeDetail> {
  const partner = await getUserByUsername(db, input.username);
  if (!partner) throw ApiError.notFound('User not found');
  if (partner.id === userId) throw ApiError.badRequest('You cannot trade with yourself.');

  const incoming = normalize(input.items);
  const pair = await pairTrades(db, userId, partner.id);
  const draft = pair.find((row) => row.status === 'draft' && row.proposerId === userId);
  const open = pair.find((row) => live.has(row.status));

  if (!open && draft) {
    const merged = mergeMax(await loadSide(db, draft.id, 'requested'), incoming);
    await assertStock(db, partner.id, merged);
    await replaceSide(db, draft.id, 'requested', merged);
    const updated = await saveTrade(db, draft.id, {
      status: 'draft',
      turnUserId: userId,
      proposerFinalizedAt: null,
      receiverFinalizedAt: null,
    });
    return toDetail(db, updated, userId);
  }

  if (!open) {
    await assertStock(db, partner.id, incoming);
    const [created] = await db
      .insert(trades)
      .values({
        proposerId: userId,
        receiverId: partner.id,
        turnUserId: userId,
        status: 'draft',
      })
      .returning();
    if (!created) throw ApiError.badRequest('Could not open the trade.');
    await replaceSide(db, created.id, 'requested', incoming);
    return toDetail(db, created, userId);
  }

  const side = receiveSide(open, userId);
  const giver = partnerId(open, userId);
  const merged = mergeMax(await loadSide(db, open.id, side), incoming);
  await assertStock(db, giver, merged);
  await replaceSide(db, open.id, side, merged);
  const updated = await saveTrade(db, open.id, {
    proposerFinalizedAt: null,
    receiverFinalizedAt: null,
    status: open.proposerId === userId ? 'proposed' : 'countered',
    turnUserId: partnerId(open, userId),
  });
  return toDetail(db, updated, userId);
}

export async function proposeTrade(
  db: Database,
  userId: string,
  tradeId: string,
  input: TradeLinesInput,
): Promise<TradeDetail> {
  return moveTrade(db, userId, tradeId, input, 'propose');
}

export async function finalizeTrade(
  db: Database,
  userId: string,
  tradeId: string,
  input: TradeLinesInput,
): Promise<TradeDetail> {
  return moveTrade(db, userId, tradeId, input, 'finalize');
}

export async function cancelTrade(
  db: Database,
  userId: string,
  tradeId: string,
): Promise<TradeDetail> {
  const trade = await requireTrade(db, tradeId, userId);
  if (trade.status === 'completed') {
    throw ApiError.conflict('This trade is already complete.');
  }
  if (trade.status === 'cancelled') return toDetail(db, trade, userId);
  const updated = await saveTrade(db, trade.id, { status: 'cancelled' });
  return toDetail(db, updated, userId);
}

async function moveTrade(
  db: Database,
  userId: string,
  tradeId: string,
  input: TradeLinesInput,
  action: 'propose' | 'finalize',
): Promise<TradeDetail> {
  const trade = await requireTrade(db, tradeId, userId);
  if (finished.has(trade.status)) {
    throw ApiError.conflict('This trade is already finished.');
  }
  if (trade.status === 'draft') {
    return proposeDraft(db, userId, trade, input, action);
  }
  if (trade.turnUserId !== userId) {
    throw ApiError.forbidden('Wait for the other person.');
  }

  const side = receiveSide(trade, userId);
  const items = normalize(input.items);
  await assertStock(db, partnerId(trade, userId), items);
  const changed = signature(await loadSide(db, trade.id, side)) !== signature(items);
  await replaceSide(db, trade.id, side, items);

  let proposerFinalizedAt = changed ? null : trade.proposerFinalizedAt;
  let receiverFinalizedAt = changed ? null : trade.receiverFinalizedAt;
  if (action === 'propose') {
    proposerFinalizedAt = null;
    receiverFinalizedAt = null;
  } else if (trade.proposerId === userId) {
    proposerFinalizedAt = new Date();
  } else {
    receiverFinalizedAt = new Date();
  }

  const both = proposerFinalizedAt !== null && receiverFinalizedAt !== null;
  const one = proposerFinalizedAt !== null || receiverFinalizedAt !== null;
  const updated = await saveTrade(db, trade.id, {
    proposerFinalizedAt,
    receiverFinalizedAt,
    status: both
      ? 'completed'
      : one
        ? 'accepted'
        : trade.proposerId === userId
          ? 'proposed'
          : 'countered',
    turnUserId: both ? trade.turnUserId : partnerId(trade, userId),
  });
  return toDetail(db, updated, userId);
}

/**
 * A draft stays with the person who started it. Propose is what the other person can see.
 * If a live trade already exists, the draft cards fold into that trade.
 */
async function proposeDraft(
  db: Database,
  userId: string,
  trade: TradeRow,
  input: TradeLinesInput,
  action: 'propose' | 'finalize',
): Promise<TradeDetail> {
  if (action === 'finalize') {
    throw ApiError.badRequest('Propose this trade before you finalize it.');
  }
  const items = normalize(input.items);
  if (items.length === 0) throw ApiError.badRequest('Add a card before you propose.');
  const partner = partnerId(trade, userId);
  await assertStock(db, partner, items);

  const liveTrade = (await pairTrades(db, userId, partner)).find(
    (row) => row.id !== trade.id && live.has(row.status),
  );
  if (!liveTrade) {
    await replaceSide(db, trade.id, 'requested', items);
    const updated = await saveTrade(db, trade.id, {
      status: 'proposed',
      turnUserId: partner,
      proposerFinalizedAt: null,
      receiverFinalizedAt: null,
    });
    return toDetail(db, updated, userId);
  }

  const side = receiveSide(liveTrade, userId);
  const merged = mergeMax(await loadSide(db, liveTrade.id, side), items);
  await assertStock(db, partnerId(liveTrade, userId), merged);
  await replaceSide(db, liveTrade.id, side, merged);
  await db.delete(trades).where(eq(trades.id, trade.id));
  const updated = await saveTrade(db, liveTrade.id, {
    proposerFinalizedAt: null,
    receiverFinalizedAt: null,
    status: liveTrade.proposerId === userId ? 'proposed' : 'countered',
    turnUserId: partnerId(liveTrade, userId),
  });
  return toDetail(db, updated, userId);
}

async function requireTrade(db: Database, tradeId: string, userId: string): Promise<TradeRow> {
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

async function pairTrades(db: Database, userId: string, otherId: string): Promise<TradeRow[]> {
  return db
    .select()
    .from(trades)
    .where(
      or(
        and(eq(trades.proposerId, userId), eq(trades.receiverId, otherId)),
        and(eq(trades.proposerId, otherId), eq(trades.receiverId, userId)),
      ),
    )
    .orderBy(desc(trades.updatedAt));
}

async function loadSide(db: Database, tradeId: string, side: Side): Promise<Line[]> {
  const rows = await db
    .select({ scryfallId: tradeItems.scryfallId, quantity: tradeItems.quantity })
    .from(tradeItems)
    .where(and(eq(tradeItems.tradeId, tradeId), eq(tradeItems.side, side)));
  return rows;
}

async function replaceSide(
  db: Database,
  tradeId: string,
  side: Side,
  items: Line[],
): Promise<void> {
  await db
    .delete(tradeItems)
    .where(and(eq(tradeItems.tradeId, tradeId), eq(tradeItems.side, side)));
  if (items.length === 0) return;
  await db.insert(tradeItems).values(
    items.map((item) => ({
      tradeId,
      side,
      scryfallId: item.scryfallId,
      quantity: item.quantity,
    })),
  );
}

async function saveTrade(
  db: Database,
  tradeId: string,
  values: Partial<typeof trades.$inferInsert>,
): Promise<TradeRow> {
  const [updated] = await db
    .update(trades)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(trades.id, tradeId))
    .returning();
  if (!updated) throw ApiError.notFound('Trade not found');
  return updated;
}

async function assertStock(db: Database, giverId: string, items: Line[]): Promise<void> {
  if (items.length === 0) return;
  const stock = await availableCopies(
    db,
    giverId,
    items.map((item) => item.scryfallId),
  );
  const missing = items.find((item) => (stock.get(item.scryfallId) ?? 0) < item.quantity);
  if (missing) {
    throw ApiError.badRequest('One of those cards is not available in that quantity.');
  }
}

async function availableCopies(
  db: Database,
  ownerId: string,
  scryfallIds: string[],
): Promise<Map<string, number>> {
  const unique = [...new Set(scryfallIds)];
  if (unique.length === 0) return new Map();
  const rows = await db
    .select({
      scryfallId: binderItems.scryfallId,
      available: sql<number>`sum(${binderItems.quantity})::int`,
    })
    .from(binderItems)
    .innerJoin(binders, eq(binders.id, binderItems.binderId))
    .where(
      and(
        eq(binders.userId, ownerId),
        eq(binderItems.forTrade, true),
        inArray(binderItems.scryfallId, unique),
      ),
    )
    .groupBy(binderItems.scryfallId);
  return new Map(rows.map((row) => [row.scryfallId, Number(row.available)]));
}

async function toDetail(db: Database, trade: TradeRow, userId: string): Promise<TradeDetail> {
  const receive = receiveSide(trade, userId);
  const rows = await db
    .select({
      side: tradeItems.side,
      scryfallId: tradeItems.scryfallId,
      quantity: tradeItems.quantity,
      name: cards.name,
      setCode: cards.setCode,
      imageUris: cards.imageUris,
    })
    .from(tradeItems)
    .innerJoin(cards, eq(cards.scryfallId, tradeItems.scryfallId))
    .where(eq(tradeItems.tradeId, trade.id))
    .orderBy(asc(cards.name));

  const stock = await availableCopies(db, partnerId(trade, userId), [
    ...rows.filter((row) => row.side === receive).map((row) => row.scryfallId),
  ]);
  const ownStock = await availableCopies(
    db,
    userId,
    rows.filter((row) => row.side !== receive).map((row) => row.scryfallId),
  );

  const youReceive: TradeCard[] = [];
  const youGive: TradeCard[] = [];
  for (const row of rows) {
    const card: TradeCard = {
      scryfallId: row.scryfallId,
      quantity: row.quantity,
      name: row.name,
      setCode: row.setCode,
      imageUris: readImage(row.imageUris),
      availableQuantity:
        row.side === receive
          ? (stock.get(row.scryfallId) ?? row.quantity)
          : (ownStock.get(row.scryfallId) ?? row.quantity),
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

function partnerId(trade: TradeRow, userId: string): string {
  return trade.proposerId === userId ? trade.receiverId : trade.proposerId;
}

function receiveSide(trade: TradeRow, userId: string): Side {
  return trade.proposerId === userId ? 'requested' : 'offered';
}

function otherSide(side: Side): Side {
  return side === 'requested' ? 'offered' : 'requested';
}

function finalizedAt(trade: TradeRow, userId: string): Date | null {
  return trade.proposerId === userId ? trade.proposerFinalizedAt : trade.receiverFinalizedAt;
}

function normalize(items: Line[]): Line[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    totals.set(item.scryfallId, (totals.get(item.scryfallId) ?? 0) + item.quantity);
  }
  return [...totals].map(([scryfallId, quantity]) => ({ scryfallId, quantity }));
}

function mergeMax(current: Line[], incoming: Line[]): Line[] {
  const totals = new Map(current.map((item) => [item.scryfallId, item.quantity]));
  for (const item of incoming) {
    totals.set(item.scryfallId, Math.max(totals.get(item.scryfallId) ?? 0, item.quantity));
  }
  return [...totals].map(([scryfallId, quantity]) => ({ scryfallId, quantity }));
}

function signature(items: Line[]): string {
  return [...items]
    .sort((a, b) => a.scryfallId.localeCompare(b.scryfallId))
    .map((item) => `${item.scryfallId}:${item.quantity}`)
    .join('|');
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

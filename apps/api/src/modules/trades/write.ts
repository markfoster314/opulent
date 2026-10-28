import type { Database, TradeRow } from '@opulent/db';
import { tradeItems, trades } from '@opulent/db';
import type { CreateTradeInput, TradeDetail, TradeLinesInput } from '@opulent/shared';
import { and, desc, eq, or } from 'drizzle-orm';
import { ApiError } from '../../lib/http';
import { getUserByUsername } from '../users/service';
import { notifyTurn } from './notify';
import {
  finished,
  live,
  otherSide,
  partnerId,
  receiveSide,
  requireTrade,
  stockByPrinting,
  toDetail,
  type Line,
  type Side,
} from './read';

export async function openTrade(
  db: Database,
  userId: string,
  input: CreateTradeInput,
): Promise<TradeDetail> {
  const partner = await getUserByUsername(db, input.username);
  if (!partner) throw ApiError.notFound('User not found');
  if (partner.id === userId) throw ApiError.badRequest('You cannot trade with yourself.');

  const incoming = normalize(input.items);
  const giving = input.give === undefined ? undefined : normalize(input.give);
  const pair = await pairTrades(db, userId, partner.id);
  const draft = pair.find((row) => row.status === 'draft' && row.proposerId === userId);
  const open = pair.find((row) => live.has(row.status));

  // Closed binder blocks new requests, but an in-progress trade keeps going.
  if (!open && !draft && partner.tradeBinderVisibility === 'private') {
    throw ApiError.notFound('Trade binder not found');
  }

  if (!open && draft) {
    const merged = mergeMax(await loadSide(db, draft.id, 'requested'), incoming);
    await assertStock(db, partner.id, merged);
    await replaceSide(db, draft.id, 'requested', merged);
    await mergeGiveSide(db, draft.id, 'offered', userId, giving);
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
    if (giving) await assertStock(db, userId, giving);
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
    if (giving) await replaceSide(db, created.id, 'offered', giving);
    return toDetail(db, created, userId);
  }

  const side = receiveSide(open, userId);
  const giver = partnerId(open, userId);
  const merged = mergeMax(await loadSide(db, open.id, side), incoming);
  await assertStock(db, giver, merged);
  await replaceSide(db, open.id, side, merged);
  await mergeGiveSide(db, open.id, otherSide(side), userId, giving);
  const updated = await saveTrade(db, open.id, {
    proposerFinalizedAt: null,
    receiverFinalizedAt: null,
    status: open.proposerId === userId ? 'proposed' : 'countered',
    turnUserId: partnerId(open, userId),
  });
  notifyTurn(db, updated, userId);
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
  let changed = signature(await loadSide(db, trade.id, side)) !== signature(items);
  await replaceSide(db, trade.id, side, items);

  if (input.give !== undefined) {
    const giving = normalize(input.give);
    await assertStock(db, userId, giving);
    const giveSide = otherSide(side);
    changed ||= signature(await loadSide(db, trade.id, giveSide)) !== signature(giving);
    await replaceSide(db, trade.id, giveSide, giving);
  }

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
  notifyTurn(db, updated, userId);
  return toDetail(db, updated, userId);
}

/** Drafts stay private to their starter; proposing folds into a live trade if one exists. */
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
  const giving = input.give === undefined ? undefined : normalize(input.give);
  if (items.length === 0 && (giving?.length ?? 0) === 0) {
    throw ApiError.badRequest('Add a card before you propose.');
  }
  const partner = partnerId(trade, userId);
  await assertStock(db, partner, items);
  if (giving) await assertStock(db, userId, giving);

  const liveTrade = (await pairTrades(db, userId, partner)).find(
    (row) => row.id !== trade.id && live.has(row.status),
  );
  if (!liveTrade) {
    await replaceSide(db, trade.id, 'requested', items);
    if (giving) await replaceSide(db, trade.id, 'offered', giving);
    const updated = await saveTrade(db, trade.id, {
      status: 'proposed',
      turnUserId: partner,
      proposerFinalizedAt: null,
      receiverFinalizedAt: null,
    });
    notifyTurn(db, updated, userId);
    return toDetail(db, updated, userId);
  }

  const side = receiveSide(liveTrade, userId);
  const merged = mergeMax(await loadSide(db, liveTrade.id, side), items);
  await assertStock(db, partnerId(liveTrade, userId), merged);
  await replaceSide(db, liveTrade.id, side, merged);
  await mergeGiveSide(db, liveTrade.id, otherSide(side), userId, giving);
  await db.delete(trades).where(eq(trades.id, trade.id));
  const updated = await saveTrade(db, liveTrade.id, {
    proposerFinalizedAt: null,
    receiverFinalizedAt: null,
    status: liveTrade.proposerId === userId ? 'proposed' : 'countered',
    turnUserId: partnerId(liveTrade, userId),
  });
  notifyTurn(db, updated, userId);
  return toDetail(db, updated, userId);
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

async function mergeGiveSide(
  db: Database,
  tradeId: string,
  side: Side,
  giverId: string,
  giving: Line[] | undefined,
): Promise<void> {
  if (!giving || giving.length === 0) return;
  const merged = mergeMax(await loadSide(db, tradeId, side), giving);
  await assertStock(db, giverId, merged);
  await replaceSide(db, tradeId, side, merged);
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
  const stock = await stockByPrinting(db, ownerId, scryfallIds);
  return new Map([...stock].map(([scryfallId, row]) => [scryfallId, row.available]));
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

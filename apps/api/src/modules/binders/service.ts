import type { BinderRow, Database } from '@opulent/db';
import { binderItems, binders, cards, users } from '@opulent/db';
import type {
  AddBinderItemInput,
  BinderItem,
  CardFinish,
  CreateBinderInput,
  ItemPrice,
  Page,
  PaginationQuery,
  TradeMatch,
  UpdateBinderInput,
  UpdateBinderItemInput,
} from '@opulent/shared';
import {
  cardFinishSchema,
  cardLanguageOrEnglish,
  marketPrices,
  parseCustomAmount,
} from '@opulent/shared';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { assertPaperPrinting, assertPrintedLanguage } from '../cards/service';
import { ApiError, slugify } from '../../lib/http';

/** Scryfall may publish finishes we do not model yet, so unknown values drop out. */
function isCardFinish(value: string): value is CardFinish {
  return cardFinishSchema.safeParse(value).success;
}

export interface ViewerContext {
  /** Internal user id of the signed-in caller, if any. */
  userId?: string | undefined;
  /** Share token supplied on the request, if any. */
  shareToken?: string | undefined;
}

/**
 * Three ways to be allowed in: you own it, it is public, or you hold the token.
 * Everything that reads a binder funnels through here.
 */
export function assertCanView(binder: BinderRow, viewer: ViewerContext): void {
  if (viewer.userId && binder.userId === viewer.userId) return;
  if (binder.visibility === 'public') return;
  if (binder.visibility === 'unlisted' && viewer.shareToken === binder.shareToken) return;
  // A private binder reports "not found" rather than "forbidden", so its
  // existence is not leaked to people guessing URLs.
  throw ApiError.notFound('Binder not found');
}

export function assertCanEdit(binder: BinderRow, viewer: ViewerContext): void {
  if (!viewer.userId || binder.userId !== viewer.userId) {
    throw ApiError.notFound('Binder not found');
  }
}

/**
 * Shapes a binder row for the wire.
 *
 * The share token is withheld from everyone but the owner. Without this, a
 * stranger who opens a public binder would learn its token, and that token
 * would still work if the owner later switched the binder to unlisted.
 */
export function toBinderResponse(binder: BinderRow, viewerUserId: string | undefined) {
  const { shareToken, ...rest } = binder;
  return viewerUserId && binder.userId === viewerUserId ? { ...rest, shareToken } : rest;
}

export async function listBindersForOwner(db: Database, userId: string) {
  return db
    .select({
      id: binders.id,
      userId: binders.userId,
      slug: binders.slug,
      name: binders.name,
      description: binders.description,
      visibility: binders.visibility,
      shareToken: binders.shareToken,
      createdAt: binders.createdAt,
      updatedAt: binders.updatedAt,
      itemCount: sql<number>`(
        SELECT COALESCE(SUM(${binderItems.quantity}), 0)::int
        FROM ${binderItems}
        WHERE ${binderItems.binderId} = ${binders.id}
      )`,
    })
    .from(binders)
    .where(eq(binders.userId, userId))
    .orderBy(asc(binders.name));
}

export async function listPublicBindersByHandle(db: Database, handle: string) {
  return db
    .select({
      id: binders.id,
      slug: binders.slug,
      name: binders.name,
      description: binders.description,
      visibility: binders.visibility,
      updatedAt: binders.updatedAt,
    })
    .from(binders)
    .innerJoin(users, eq(users.id, binders.userId))
    .where(and(eq(users.username, handle), eq(binders.visibility, 'public')))
    .orderBy(asc(binders.name));
}

export async function createBinder(
  db: Database,
  userId: string,
  input: CreateBinderInput,
): Promise<BinderRow> {
  const slug = input.slug ?? slugify(input.name);
  if (!slug) throw ApiError.badRequest('Could not build a slug from that name');

  const existing = await db
    .select({ id: binders.id })
    .from(binders)
    .where(and(eq(binders.userId, userId), eq(binders.slug, slug)))
    .limit(1);
  if (existing.length > 0) {
    throw ApiError.conflict(`You already have a binder at /${slug}`);
  }

  const inserted = await db
    .insert(binders)
    .values({
      userId,
      slug,
      name: input.name,
      description: input.description ?? null,
      visibility: input.visibility,
    })
    .returning();

  const binder = inserted[0];
  if (!binder) throw new ApiError('internal_error', 'Could not create the binder');
  return binder;
}

export async function getBinderById(db: Database, id: string): Promise<BinderRow> {
  const rows = await db.select().from(binders).where(eq(binders.id, id)).limit(1);
  const binder = rows[0];
  if (!binder) throw ApiError.notFound('Binder not found');
  return binder;
}

export async function getBinderByHandleAndSlug(
  db: Database,
  handle: string,
  slug: string,
): Promise<BinderRow> {
  const rows = await db
    .select()
    .from(binders)
    .innerJoin(users, eq(users.id, binders.userId))
    .where(and(eq(users.username, handle), eq(binders.slug, slug)))
    .limit(1);

  const row = rows[0];
  if (!row) throw ApiError.notFound('Binder not found');
  return row.binders;
}

/**
 * Note that renaming a binder does not re-slug it. The slug is part of every
 * share link already handed out, so it only changes when asked for explicitly.
 */
export async function updateBinder(
  db: Database,
  binderId: string,
  userId: string,
  input: UpdateBinderInput,
): Promise<BinderRow> {
  if (input.slug) {
    const taken = await db
      .select({ id: binders.id })
      .from(binders)
      .where(
        and(eq(binders.userId, userId), eq(binders.slug, input.slug), ne(binders.id, binderId)),
      )
      .limit(1);
    if (taken.length > 0) {
      throw ApiError.conflict(`You already have a binder at /${input.slug}`);
    }
  }

  const updated = await db
    .update(binders)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(binders.id, binderId))
    .returning();

  const binder = updated[0];
  if (!binder) throw ApiError.notFound('Binder not found');
  return binder;
}

export async function deleteBinder(db: Database, binderId: string): Promise<void> {
  await db.delete(binders).where(eq(binders.id, binderId));
}

/** Invalidates every share link handed out so far. */
export async function rotateShareToken(db: Database, binderId: string): Promise<string> {
  const updated = await db
    .update(binders)
    .set({ shareToken: sql`encode(gen_random_bytes(16), 'hex')`, updatedAt: new Date() })
    .where(eq(binders.id, binderId))
    .returning({ shareToken: binders.shareToken });

  const token = updated[0]?.shareToken;
  if (!token) throw ApiError.notFound('Binder not found');
  return token;
}

const binderItemSelection = {
  id: binderItems.id,
  binderId: binderItems.binderId,
  scryfallId: binderItems.scryfallId,
  quantity: binderItems.quantity,
  finish: binderItems.finish,
  condition: binderItems.condition,
  language: binderItems.language,
  signed: binderItems.signed,
  altered: binderItems.altered,
  misprint: binderItems.misprint,
  miscut: binderItems.miscut,
  notes: binderItems.notes,
  forTrade: binderItems.forTrade,
  priceKind: binderItems.priceKind,
  pricePercent: binderItems.pricePercent,
  priceAmount: binderItems.priceAmount,
  cardName: cards.name,
  cardSetCode: cards.setCode,
  cardSetName: cards.setName,
  cardCollectorNumber: cards.collectorNumber,
  cardRarity: cards.rarity,
  cardOracleId: cards.oracleId,
  cardImageUris: cards.imageUris,
  cardPrices: cards.prices,
  cardFinishes: cards.finishes,
};

type BinderItemJoinRow = Awaited<ReturnType<typeof selectBinderItems>>[number];

const englishCards = alias(cards, 'english_card');

function selectBinderItems(db: Database) {
  return db
    .select({
      ...binderItemSelection,
      englishPrices: englishCards.prices,
    })
    .from(binderItems)
    .innerJoin(cards, eq(cards.scryfallId, binderItems.scryfallId))
    .leftJoin(
      englishCards,
      and(
        eq(englishCards.setCode, cards.setCode),
        eq(englishCards.collectorNumber, cards.collectorNumber),
        eq(englishCards.lang, 'en'),
        sql`jsonb_exists(${englishCards.raw}->'games', 'paper')`,
        sql`${englishCards.layout} IS DISTINCT FROM 'art_series'`,
      ),
    );
}

function toItemPrice(
  row: Pick<BinderItemJoinRow, 'priceKind' | 'pricePercent' | 'priceAmount'>,
): ItemPrice {
  if (row.priceKind === 'percent') return { kind: 'percent', percent: row.pricePercent };
  if (row.priceKind === 'custom') return { kind: 'custom', amount: row.priceAmount };
  return { kind: 'market' };
}

/**
 * Fills the unused price columns so the unique stack key can match them.
 * Market is 100 and an empty amount. Custom is 0 and the dollar string.
 */
function priceColumns(price: ItemPrice | undefined): {
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

function toBinderItem(row: BinderItemJoinRow): BinderItem {
  return {
    id: row.id,
    binderId: row.binderId,
    scryfallId: row.scryfallId,
    quantity: row.quantity,
    finish: row.finish,
    condition: row.condition,
    language: cardLanguageOrEnglish(row.language),
    signed: row.signed,
    altered: row.altered,
    misprint: row.misprint,
    miscut: row.miscut,
    notes: row.notes,
    forTrade: row.forTrade,
    price: toItemPrice(row),
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
      layout: null,
      typeLine: null,
      manaCost: null,
      finishes: (row.cardFinishes ?? []).filter(isCardFinish),
      imageUris: row.cardImageUris ?? null,
      prices: marketPrices(row.cardPrices, row.englishPrices),
      scryfallUri: null,
      releasedAt: null,
    },
  };
}

/**
 * Keyset pagination ordered by card name. The cursor carries the last name and
 * row id, so adding a card mid-scroll never duplicates or skips a row.
 */
export async function listBinderItems(
  db: Database,
  binderId: string,
  pagination: PaginationQuery,
): Promise<Page<BinderItem>> {
  const after = decodeCursor(pagination.cursor);

  const rows = await selectBinderItems(db)
    .where(
      after
        ? and(
            eq(binderItems.binderId, binderId),
            sql`(${cards.name}, ${binderItems.id}) > (${after.name}, ${after.id}::uuid)`,
          )
        : eq(binderItems.binderId, binderId),
    )
    .orderBy(asc(cards.name), asc(binderItems.id))
    .limit(pagination.limit + 1);

  const hasMore = rows.length > pagination.limit;
  const page = hasMore ? rows.slice(0, pagination.limit) : rows;
  const last = page[page.length - 1];

  return {
    items: page.map(toBinderItem),
    nextCursor: hasMore && last ? encodeCursor(last.cardName, last.id) : null,
  };
}

function encodeCursor(name: string, id: string): string {
  return Buffer.from(`${name}\u0000${id}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor?: string): { name: string; id: string } | undefined {
  if (!cursor) return undefined;
  const [name, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('\u0000');
  if (!name || !id) throw ApiError.badRequest('Malformed cursor');
  return { name, id };
}

/**
 * Adds a card, or bumps the quantity if that exact stack is already present.
 * "Exact stack" means same printing, finish, condition, language, marks, and price.
 *
 * Marks default to unchecked so a caller that only names the printing still works.
 */
export async function addBinderItem(
  db: Database,
  binderId: string,
  input: Omit<AddBinderItemInput, 'signed' | 'altered' | 'misprint' | 'miscut'> &
    Partial<Pick<AddBinderItemInput, 'signed' | 'altered' | 'misprint' | 'miscut'>>,
): Promise<BinderItem> {
  await assertPaperPrinting(db, input.scryfallId);
  await assertPrintedLanguage(db, input.scryfallId, input.language);

  const inserted = await db
    .insert(binderItems)
    .values({
      binderId,
      scryfallId: input.scryfallId,
      quantity: input.quantity,
      finish: input.finish,
      condition: input.condition,
      language: input.language,
      signed: input.signed ?? false,
      altered: input.altered ?? false,
      misprint: input.misprint ?? false,
      miscut: input.miscut ?? false,
      notes: input.notes ?? null,
      forTrade: input.forTrade,
      ...priceColumns(input.price),
    })
    .onConflictDoUpdate({
      target: [
        binderItems.binderId,
        binderItems.scryfallId,
        binderItems.finish,
        binderItems.condition,
        binderItems.language,
        binderItems.signed,
        binderItems.altered,
        binderItems.misprint,
        binderItems.miscut,
        binderItems.priceKind,
        binderItems.pricePercent,
        binderItems.priceAmount,
      ],
      set: {
        quantity: sql`${binderItems.quantity} + ${input.quantity}`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: binderItems.id });

  const id = inserted[0]?.id;
  if (!id) throw new ApiError('internal_error', 'Could not add the card');

  const rows = await selectBinderItems(db).where(eq(binderItems.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new ApiError('internal_error', 'Could not read back the added card');
  return toBinderItem(row);
}

export async function updateBinderItem(
  db: Database,
  binderId: string,
  itemId: string,
  input: UpdateBinderItemInput,
): Promise<BinderItem> {
  const patch: Partial<typeof binderItems.$inferInsert> = { updatedAt: new Date() };
  if (input.quantity !== undefined) patch.quantity = input.quantity;
  if (input.finish !== undefined) patch.finish = input.finish;
  if (input.condition !== undefined) patch.condition = input.condition;
  if (input.language !== undefined) {
    const existing = await db
      .select({ scryfallId: binderItems.scryfallId })
      .from(binderItems)
      .where(and(eq(binderItems.id, itemId), eq(binderItems.binderId, binderId)))
      .limit(1);
    const scryfallId = existing[0]?.scryfallId;
    if (!scryfallId) throw ApiError.notFound('Card not found in this binder');
    await assertPrintedLanguage(db, scryfallId, input.language);
    patch.language = input.language;
  }
  if (input.signed !== undefined) patch.signed = input.signed;
  if (input.altered !== undefined) patch.altered = input.altered;
  if (input.misprint !== undefined) patch.misprint = input.misprint;
  if (input.miscut !== undefined) patch.miscut = input.miscut;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.forTrade !== undefined) patch.forTrade = input.forTrade;
  if (input.price) Object.assign(patch, priceColumns(input.price));

  try {
    const updated = await db
      .update(binderItems)
      .set(patch)
      .where(and(eq(binderItems.id, itemId), eq(binderItems.binderId, binderId)))
      .returning({ id: binderItems.id });

    if (!updated[0]) throw ApiError.notFound('Card not found in this binder');
  } catch (error) {
    if (isStackCollision(error)) {
      throw ApiError.conflict(
        'You already have a stack of this card with those details. Add to that stack instead.',
      );
    }
    throw error;
  }

  const rows = await selectBinderItems(db).where(eq(binderItems.id, itemId)).limit(1);
  const row = rows[0];
  if (!row) throw ApiError.notFound('Card not found in this binder');
  return toBinderItem(row);
}

/** Postgres reports a broken unique index as SQLSTATE 23505. */
function isStackCollision(error: unknown): boolean {
  const candidates = [error, (error as { cause?: unknown } | null)?.cause];
  return candidates.some((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return false;
    const row = candidate as { code?: unknown; constraint_name?: unknown };
    return row.code === '23505' && row.constraint_name === 'binder_items_stack_key';
  });
}

export async function removeBinderItem(
  db: Database,
  binderId: string,
  itemId: string,
): Promise<void> {
  await db
    .delete(binderItems)
    .where(and(eq(binderItems.id, itemId), eq(binderItems.binderId, binderId)));
}

interface MatchAggregateRow {
  oracleId: string;
  cardName: string;
  wantQuantity: number;
  wantPriority: number;
  availableQuantity: number;
}

/**
 * The product in one query: cards on the viewer's want list that the binder
 * owner is holding for trade.
 *
 * The join goes want_items -> cards (by oracle_id) -> binder_items (by
 * scryfall_id), which is how a want for a card concept reaches every printing
 * of it sitting in the binder.
 */
export async function findTradeMatches(
  db: Database,
  binderId: string,
  viewerUserId: string,
): Promise<TradeMatch[]> {
  const aggregates = (await db.execute(sql`
    SELECT
      w.oracle_id                 AS "oracleId",
      MIN(c.name)                 AS "cardName",
      w.quantity                  AS "wantQuantity",
      w.priority                  AS "wantPriority",
      SUM(bi.quantity)::int       AS "availableQuantity"
    FROM want_items w
    JOIN cards c         ON c.oracle_id = w.oracle_id
    JOIN binder_items bi ON bi.scryfall_id = c.scryfall_id
    WHERE w.user_id = ${viewerUserId}
      AND bi.binder_id = ${binderId}
      AND bi.for_trade = true
    GROUP BY w.oracle_id, w.quantity, w.priority
    ORDER BY w.priority ASC, MIN(c.name) ASC
  `)) as unknown as MatchAggregateRow[];

  if (aggregates.length === 0) return [];

  const oracleIds = aggregates.map((row) => row.oracleId);

  // Second trip for the individual printings, so the UI can show which exact
  // copies are on offer without a correlated subquery per row.
  const printingRows = await selectBinderItems(db).where(
    and(
      eq(binderItems.binderId, binderId),
      eq(binderItems.forTrade, true),
      inArray(cards.oracleId, oracleIds),
    ),
  );

  const printingsByOracle = new Map<string, BinderItem[]>();
  for (const row of printingRows) {
    const list = printingsByOracle.get(row.cardOracleId) ?? [];
    list.push(toBinderItem(row));
    printingsByOracle.set(row.cardOracleId, list);
  }

  return aggregates.map((row) => ({
    oracleId: row.oracleId,
    cardName: row.cardName,
    wantQuantity: row.wantQuantity,
    wantPriority: row.wantPriority,
    availableQuantity: row.availableQuantity,
    printings: printingsByOracle.get(row.oracleId) ?? [],
  }));
}

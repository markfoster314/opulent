import type { BinderRow, Database } from '@opulent/db';
import { binderItems, binders, cards, users } from '@opulent/db';
import type {
  AddBinderItemInput,
  BinderItem,
  CreateBinderInput,
  Page,
  PaginationQuery,
  TradeMatch,
  UpdateBinderInput,
  UpdateBinderItemInput,
} from '@opulent/shared';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { ApiError, slugify } from '../../lib/http';

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
    .where(and(eq(users.handle, handle), eq(binders.visibility, 'public')))
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
    .where(and(eq(users.handle, handle), eq(binders.slug, slug)))
    .limit(1);

  const row = rows[0];
  if (!row) throw ApiError.notFound('Binder not found');
  return row.binders;
}

export async function updateBinder(
  db: Database,
  binderId: string,
  input: UpdateBinderInput,
): Promise<BinderRow> {
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
  notes: binderItems.notes,
  forTrade: binderItems.forTrade,
  cardName: cards.name,
  cardSetCode: cards.setCode,
  cardSetName: cards.setName,
  cardCollectorNumber: cards.collectorNumber,
  cardRarity: cards.rarity,
  cardOracleId: cards.oracleId,
  cardImageUris: cards.imageUris,
  cardPrices: cards.prices,
};

type BinderItemJoinRow = Awaited<ReturnType<typeof selectBinderItems>>[number];

function selectBinderItems(db: Database) {
  return db
    .select(binderItemSelection)
    .from(binderItems)
    .innerJoin(cards, eq(cards.scryfallId, binderItems.scryfallId));
}

function toBinderItem(row: BinderItemJoinRow): BinderItem {
  return {
    id: row.id,
    binderId: row.binderId,
    scryfallId: row.scryfallId,
    quantity: row.quantity,
    finish: row.finish,
    condition: row.condition,
    language: row.language,
    notes: row.notes,
    forTrade: row.forTrade,
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
      finishes: [],
      imageUris: row.cardImageUris ?? null,
      prices: row.cardPrices ?? null,
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
 * "Exact stack" means same printing, finish, condition and language.
 */
export async function addBinderItem(
  db: Database,
  binderId: string,
  input: AddBinderItemInput,
): Promise<BinderItem> {
  const cardExists = await db
    .select({ scryfallId: cards.scryfallId })
    .from(cards)
    .where(eq(cards.scryfallId, input.scryfallId))
    .limit(1);
  if (cardExists.length === 0) {
    throw ApiError.badRequest('Unknown card. The local Scryfall mirror may be out of date.');
  }

  const inserted = await db
    .insert(binderItems)
    .values({
      binderId,
      scryfallId: input.scryfallId,
      quantity: input.quantity,
      finish: input.finish,
      condition: input.condition,
      language: input.language,
      notes: input.notes ?? null,
      forTrade: input.forTrade,
    })
    .onConflictDoUpdate({
      target: [
        binderItems.binderId,
        binderItems.scryfallId,
        binderItems.finish,
        binderItems.condition,
        binderItems.language,
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
  const updated = await db
    .update(binderItems)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(binderItems.id, itemId), eq(binderItems.binderId, binderId)))
    .returning({ id: binderItems.id });

  if (!updated[0]) throw ApiError.notFound('Card not found in this binder');

  const rows = await selectBinderItems(db).where(eq(binderItems.id, itemId)).limit(1);
  const row = rows[0];
  if (!row) throw ApiError.notFound('Card not found in this binder');
  return toBinderItem(row);
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

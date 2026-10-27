import type { Database, UserRow } from '@opulent/db';
import {
  cardGroups,
  cards,
  collectionItems,
  groupMemberships,
  users,
  wantItems,
} from '@opulent/db';
import type {
  AddCollectionItemInput,
  CardFinish,
  CollectionHighlight,
  CollectionItem,
  CollectionItemQuery,
  CollectionSummary,
  GroupRef,
  ItemPrice,
  Page,
  PaginationQuery,
  TradeBinder,
  TradeMatch,
  UpdateCollectionItemInput,
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
import {
  assertPaperPrinting,
  assertPrintedLanguage,
  listLanguagePrintings,
} from '../cards/service';
import { ApiError } from '../../lib/http';

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

/** The trade binder follows the same three doors as any other shared list. */
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

/** What a visitor sees above the trade binder. The token stays with the owner. */
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

/**
 * The market price of one copy, in SQL, so the whole collection sums in one pass.
 * Foils and etched foils read their own price. A non-English printing falls
 * back to the English printing of the same set and number, like `marketPrices`.
 */
function copyMarketPriceSql() {
  const own = sql`CASE ${collectionItems.finish}::text
    WHEN 'foil' THEN ${cards.prices}->>'usd_foil'
    WHEN 'etched' THEN ${cards.prices}->>'usd_etched'
    ELSE ${cards.prices}->>'usd' END`;
  const english = sql`CASE ${collectionItems.finish}::text
    WHEN 'foil' THEN ${englishCards.prices}->>'usd_foil'
    WHEN 'etched' THEN ${englishCards.prices}->>'usd_etched'
    ELSE ${englishCards.prices}->>'usd' END`;
  return sql`COALESCE(NULLIF(${own}, '')::numeric, NULLIF(${english}, '')::numeric, 0)`;
}

/** Card and value totals for the top of the collection page. */
export async function getCollectionSummary(
  db: Database,
  userId: string,
): Promise<CollectionSummary> {
  const price = copyMarketPriceSql();
  const forTrade = sql`CASE WHEN ${collectionItems.forTrade} THEN 1 ELSE 0 END`;
  const rows = await db
    .select({
      cardCount: sql<number>`coalesce(sum(${collectionItems.quantity}), 0)::int`,
      forTradeCount: sql<number>`coalesce(sum(${collectionItems.quantity} * ${forTrade}), 0)::int`,
      marketValue: sql<string>`coalesce(sum(${collectionItems.quantity} * ${price}), 0)::text`,
      forTradeValue: sql<string>`coalesce(sum(${collectionItems.quantity} * ${price} * ${forTrade}), 0)::text`,
    })
    .from(collectionItems)
    .innerJoin(cards, eq(cards.scryfallId, collectionItems.scryfallId))
    .leftJoin(englishCards, englishPrintingJoin())
    .where(and(eq(collectionItems.userId, userId), eq(cards.game, CARD_GAME)));
  const row = rows[0];
  return {
    cardCount: Number(row?.cardCount ?? 0),
    forTradeCount: Number(row?.forTradeCount ?? 0),
    marketValue: Number(row?.marketValue ?? 0).toFixed(2),
    forTradeValue: Number(row?.forTradeValue ?? 0).toFixed(2),
  };
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

const englishCards = alias(cards, 'english_card');

/** The English printing of the same set and number, which carries the price. */
function englishPrintingJoin() {
  return and(
    eq(englishCards.setCode, cards.setCode),
    eq(englishCards.collectorNumber, cards.collectorNumber),
    eq(englishCards.lang, 'en'),
    sql`jsonb_exists(${englishCards.raw}->'games', 'paper')`,
    sql`${englishCards.layout} IS DISTINCT FROM 'art_series'`,
  );
}

function selectCollectionItems(db: Database) {
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

/**
 * Fills the unused price columns so the row is always complete.
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

function toCollectionItem(row: CollectionItemJoinRow, groups: GroupRef[]): CollectionItem {
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

interface ValueRow {
  id: string;
  name: string;
  setCode: string;
  finish: string;
  quantity: number;
  imageUrl: string | null;
  askingNow: string | null;
  sortPrice: string;
  oldAsking: string | null;
}

interface ValueCursor {
  price: string;
  id: string;
}

function encodeValueCursor(price: string, id: string): string {
  return Buffer.from(`${price}\u0000${id}`, 'utf8').toString('base64url');
}

function decodeValueCursor(cursor: string): ValueCursor {
  const [price, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('\u0000');
  if (!price || !id || !Number.isFinite(Number(price))) {
    throw ApiError.badRequest('Malformed cursor');
  }
  return { price, id };
}

function toCollectionHighlight(row: ValueRow): CollectionHighlight {
  const price = row.askingNow === null ? null : Number(row.askingNow);
  const old = row.oldAsking === null ? null : Number(row.oldAsking);
  const change = price === null || old === null ? null : Math.round((price - old) * 100) / 100;

  return {
    id: row.id,
    name: row.name,
    setCode: row.setCode,
    finish: row.finish as CollectionHighlight['finish'],
    quantity: Number(row.quantity),
    imageUrl: row.imageUrl,
    price: price === null ? null : price.toFixed(2),
    weekChange:
      change === null || change === 0 ? null : `${change > 0 ? '+' : ''}${change.toFixed(2)}`,
  };
}

/**
 * Cards in one collection, ranked by the asking price of a single copy.
 *
 * The asking price is the market price for the stack's finish, unless the owner
 * set a percent or a custom amount, in which case the owner's number wins. A
 * non-English printing falls back to the English printing of the same set and
 * number, like `marketPrices`.
 *
 * The weekly figure compares that number with the price in force seven days
 * ago. History stores change points rather than a row per day, so "seven days
 * ago" means the newest row on or before that date. A custom price is fixed by
 * the owner, so it reports no change.
 *
 * `pricedOnly` is the dashboard: the ten most valuable cards. Without it the
 * list is every card, and a stack with no known price sorts last with a dash.
 * The cursor carries the sort price and the row id, so a page never repeats or
 * skips a row.
 */
async function queryCardsByValue(
  db: Database,
  userId: string,
  options: { limit: number; cursor?: ValueCursor; pricedOnly: boolean },
): Promise<Page<CollectionHighlight>> {
  const { cursor, pricedOnly } = options;

  const rows = (await db.execute(sql`
    WITH scoped AS (
      SELECT
        ci.id,
        ci.scryfall_id,
        ci.finish,
        ci.quantity,
        ci.price_kind,
        ci.price_percent,
        ci.price_amount,
        c.name,
        c.set_code,
        c.image_uris,
        ec.scryfall_id AS english_scryfall_id,
        CASE ci.finish::text
          WHEN 'foil' THEN NULLIF(c.prices->>'usd_foil', '')
          WHEN 'etched' THEN NULLIF(c.prices->>'usd_etched', '')
          ELSE NULLIF(c.prices->>'usd', '')
        END AS own_market,
        CASE ci.finish::text
          WHEN 'foil' THEN NULLIF(ec.prices->>'usd_foil', '')
          WHEN 'etched' THEN NULLIF(ec.prices->>'usd_etched', '')
          ELSE NULLIF(ec.prices->>'usd', '')
        END AS english_market
      FROM collection_items ci
      JOIN cards c ON c.scryfall_id = ci.scryfall_id
      LEFT JOIN cards ec
        ON ec.set_code = c.set_code
       AND ec.collector_number = c.collector_number
       AND ec.lang = 'en'
       AND ec.layout IS DISTINCT FROM 'art_series'
       AND jsonb_exists(ec.raw->'games', 'paper')
      WHERE ci.user_id = ${userId}
        AND c.game = ${CARD_GAME}
    ),
    asking AS (
      SELECT
        scoped.*,
        CASE price_kind
          WHEN 'custom' THEN NULLIF(price_amount, '')::numeric
          WHEN 'percent' THEN
            ROUND(COALESCE(own_market::numeric, english_market::numeric) * price_percent / 100.0, 2)
          ELSE COALESCE(own_market::numeric, english_market::numeric)
        END AS asking_now
      FROM scoped
    ),
    keyed AS (
      SELECT *, COALESCE(asking_now, 0) AS sort_price FROM asking
    ),
    ranked AS (
      SELECT * FROM keyed
      WHERE TRUE
        ${pricedOnly ? sql`AND asking_now > 0` : sql``}
        ${
          cursor
            ? sql`AND (sort_price, id) < (${cursor.price}::numeric, ${cursor.id}::uuid)`
            : sql``
        }
      ORDER BY sort_price DESC, id DESC
      LIMIT ${options.limit + 1}
    )
    SELECT
      r.id,
      r.name,
      r.set_code AS "setCode",
      r.finish::text AS finish,
      r.quantity,
      COALESCE(
        r.image_uris->>'normal',
        r.image_uris->>'large',
        r.image_uris->>'small'
      ) AS "imageUrl",
      CASE WHEN r.asking_now IS NULL THEN NULL ELSE r.asking_now::text END AS "askingNow",
      r.sort_price::text AS "sortPrice",
      (
        CASE r.price_kind
          WHEN 'custom' THEN NULLIF(r.price_amount, '')::numeric
          WHEN 'percent' THEN
            ROUND(COALESCE(old_own.price, old_english.price) * r.price_percent / 100.0, 2)
          ELSE COALESCE(old_own.price, old_english.price)
        END
      )::text AS "oldAsking"
    FROM ranked r
    LEFT JOIN LATERAL (
      SELECT
        CASE r.finish::text
          WHEN 'foil' THEN h.usd_foil
          WHEN 'etched' THEN h.usd_etched
          ELSE h.usd
        END::numeric AS price
      FROM card_price_history h
      WHERE h.scryfall_id = r.scryfall_id
        AND h.recorded_on <= CURRENT_DATE - 7
      ORDER BY h.recorded_on DESC
      LIMIT 1
    ) old_own ON true
    LEFT JOIN LATERAL (
      SELECT
        CASE r.finish::text
          WHEN 'foil' THEN h.usd_foil
          WHEN 'etched' THEN h.usd_etched
          ELSE h.usd
        END::numeric AS price
      FROM card_price_history h
      WHERE h.scryfall_id = r.english_scryfall_id
        AND h.recorded_on <= CURRENT_DATE - 7
      ORDER BY h.recorded_on DESC
      LIMIT 1
    ) old_english ON true
    ORDER BY r.sort_price DESC, r.id DESC
  `)) as unknown as ValueRow[];

  const hasMore = rows.length > options.limit;
  const page = hasMore ? rows.slice(0, options.limit) : rows;
  const last = page[page.length - 1];

  return {
    items: page.map(toCollectionHighlight),
    nextCursor: hasMore && last ? encodeValueCursor(last.sortPrice, last.id) : null,
  };
}

/** The dashboard: the ten most valuable stacks, always priced. */
export async function listCollectionHighlights(
  db: Database,
  userId: string,
  limit: number,
): Promise<CollectionHighlight[]> {
  const page = await queryCardsByValue(db, userId, { limit, pricedOnly: true });
  return page.items;
}

/** Every card, ranked by value. Unpriced stacks come last with a dash. */
export async function listCollectionCardsByValue(
  db: Database,
  userId: string,
  query: PaginationQuery,
): Promise<Page<CollectionHighlight>> {
  return queryCardsByValue(db, userId, {
    limit: query.limit,
    pricedOnly: false,
    ...(query.cursor ? { cursor: decodeValueCursor(query.cursor) } : {}),
  });
}

/** Every group each of these stacks sits in, keyed by item id. */
async function loadGroupsForItems(
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

/** Parsed search, or just a page size. A missing flag means that rule is off. */
type CollectionItemListQuery = Partial<CollectionItemQuery> & { limit: number };

/**
 * Keyset pagination ordered by card name. The cursor carries the last name and
 * row id, so adding a card mid-scroll never duplicates or skips a row.
 */
async function pageOfItems(
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

/** Every stack this person owns. The owner reads this, groups included. */
export async function listCollectionItems(
  db: Database,
  userId: string,
  pagination: CollectionItemListQuery,
): Promise<Page<CollectionItem>> {
  return pageOfItems(db, eq(collectionItems.userId, userId), pagination, userId, true);
}

/**
 * Every stack this person marked for trade. Check `assertCanViewTradeBinder` first.
 * Group names are private, so visitors never receive them.
 */
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

/** The stacks in one group. Only the owner reaches this, through the groups module. */
export async function listItemsInGroup(
  db: Database,
  groupId: string,
  pagination: CollectionItemListQuery,
): Promise<Page<CollectionItem>> {
  const after = decodeCursor(pagination.cursor);
  const rows = await selectCollectionItems(db)
    .innerJoin(
      groupMemberships,
      and(eq(groupMemberships.itemId, collectionItems.id), eq(groupMemberships.groupId, groupId)),
    )
    .where(
      and(
        after
          ? sql`(${cards.name}, ${collectionItems.id}) > (${after.name}, ${after.id}::uuid)`
          : undefined,
        ...collectionItemFilters(pagination, undefined),
      ),
    )
    .orderBy(asc(cards.name), asc(collectionItems.id))
    .limit(pagination.limit + 1);

  const hasMore = rows.length > pagination.limit;
  const page = hasMore ? rows.slice(0, pagination.limit) : rows;
  const last = page[page.length - 1];

  const items = page.map((row) => toCollectionItem(row, []));
  const groups = await loadGroupsForItems(
    db,
    items.map((item) => item.id),
  );
  for (const item of items) item.groups = groups.get(item.id) ?? [];

  return {
    items,
    nextCursor: hasMore && last ? encodeCursor(last.cardName, last.id) : null,
  };
}

/** Turns a typed name into a safe contains-match. % and _ stay as letters, not wildcards. */
function containsPattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

function collectionItemFilters(
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
  if (query.forTrade) clauses.push(eq(collectionItems.forTrade, true));
  if (query.signed) clauses.push(eq(collectionItems.signed, true));
  if (query.altered) clauses.push(eq(collectionItems.altered, true));
  if (query.misprint) clauses.push(eq(collectionItems.misprint, true));
  if (query.miscut) clauses.push(eq(collectionItems.miscut, true));
  if (query.artistProof) clauses.push(eq(collectionItems.artistProof, true));
  if (query.onWantList) {
    if (!viewerId) throw ApiError.unauthorized('Sign in to filter by your want lists.');
    clauses.push(sql`EXISTS (
      SELECT 1 FROM ${wantItems}
      WHERE ${wantItems.userId} = ${viewerId}
        AND ${wantItems.oracleId} = ${cards.oracleId}
    )`);
  }
  return clauses;
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

export type CollectionItemInput = Omit<
  AddCollectionItemInput,
  'signed' | 'altered' | 'misprint' | 'miscut' | 'artistProof'
> &
  Partial<
    Pick<AddCollectionItemInput, 'signed' | 'altered' | 'misprint' | 'miscut' | 'artistProof'>
  >;

/**
 * Adds a card, or bumps the quantity if that exact stack is already present.
 * "Exact stack" means same printing, finish, condition, language, and marks.
 * Price is not part of that key, so a second add never makes a second stack.
 *
 * Marks default to unchecked so a caller that only names the printing still works.
 */
export async function addCollectionItem(
  db: Database,
  userId: string,
  input: CollectionItemInput,
): Promise<CollectionItem> {
  await assertPaperPrinting(db, input.scryfallId);
  await assertPrintedLanguage(db, input.scryfallId, input.language);

  const inserted = await db
    .insert(collectionItems)
    .values({
      userId,
      scryfallId: input.scryfallId,
      quantity: input.quantity,
      finish: input.finish,
      condition: input.condition,
      language: input.language,
      signed: input.signed ?? false,
      altered: input.altered ?? false,
      misprint: input.misprint ?? false,
      miscut: input.miscut ?? false,
      artistProof: input.artistProof ?? false,
      notes: input.notes ?? null,
      photoUrl: input.photoUrl ?? null,
      forTrade: input.forTrade,
      ...priceColumns(input.price),
    })
    .onConflictDoUpdate({
      target: [
        collectionItems.userId,
        collectionItems.scryfallId,
        collectionItems.finish,
        collectionItems.condition,
        collectionItems.language,
        collectionItems.signed,
        collectionItems.altered,
        collectionItems.misprint,
        collectionItems.miscut,
        collectionItems.artistProof,
      ],
      set: {
        quantity: sql`${collectionItems.quantity} + ${input.quantity}`,
        // The owner may already have priced this stack. Edit it to change the price.
        forTrade: sql`${collectionItems.forTrade} OR excluded.for_trade`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: collectionItems.id });

  const id = inserted[0]?.id;
  if (!id) throw new ApiError('internal_error', 'Could not add the card');

  const rows = await selectCollectionItems(db).where(eq(collectionItems.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new ApiError('internal_error', 'Could not read back the added card');
  const groups = await loadGroupsForItems(db, [id]);
  return toCollectionItem(row, groups.get(id) ?? []);
}

/** One stack, with its groups and the card detail the expanded row shows. */
export async function getCollectionItem(
  db: Database,
  userId: string,
  itemId: string,
): Promise<CollectionItem> {
  const rows = await selectCollectionItems(db)
    .where(and(eq(collectionItems.id, itemId), eq(collectionItems.userId, userId)))
    .limit(1);
  const row = rows[0];
  if (!row) throw ApiError.notFound('Card not found in your collection');
  const groups = await loadGroupsForItems(db, [itemId]);
  return toCollectionItem(row, groups.get(itemId) ?? []);
}

export async function updateCollectionItem(
  db: Database,
  userId: string,
  itemId: string,
  input: UpdateCollectionItemInput,
): Promise<CollectionItem> {
  const patch: Partial<typeof collectionItems.$inferInsert> = { updatedAt: new Date() };
  if (input.quantity !== undefined) patch.quantity = input.quantity;
  if (input.finish !== undefined) patch.finish = input.finish;
  if (input.condition !== undefined) patch.condition = input.condition;
  if (input.language !== undefined) {
    const existing = await db
      .select({ scryfallId: collectionItems.scryfallId })
      .from(collectionItems)
      .where(and(eq(collectionItems.id, itemId), eq(collectionItems.userId, userId)))
      .limit(1);
    const scryfallId = existing[0]?.scryfallId;
    if (!scryfallId) throw ApiError.notFound('Card not found in your collection');
    await assertPrintedLanguage(db, scryfallId, input.language);
    // The picture and the stored card are the printing, not the language label.
    // English and Japanese of one set are two Scryfall ids.
    const printings = await listLanguagePrintings(db, scryfallId);
    const nextPrinting = printings.find(
      (card) => cardLanguageOrEnglish(card.lang) === input.language,
    );
    if (!nextPrinting) {
      throw ApiError.badRequest('This card was not printed in that language.');
    }
    patch.language = input.language;
    patch.scryfallId = nextPrinting.scryfallId;
  }
  if (input.signed !== undefined) patch.signed = input.signed;
  if (input.altered !== undefined) patch.altered = input.altered;
  if (input.misprint !== undefined) patch.misprint = input.misprint;
  if (input.miscut !== undefined) patch.miscut = input.miscut;
  if (input.artistProof !== undefined) patch.artistProof = input.artistProof;
  if (input.notes !== undefined) patch.notes = input.notes;
  if (input.photoUrl !== undefined) patch.photoUrl = input.photoUrl;
  if (input.forTrade !== undefined) patch.forTrade = input.forTrade;
  if (input.price) Object.assign(patch, priceColumns(input.price));

  try {
    const updated = await db
      .update(collectionItems)
      .set(patch)
      .where(and(eq(collectionItems.id, itemId), eq(collectionItems.userId, userId)))
      .returning({ id: collectionItems.id });

    if (!updated[0]) throw ApiError.notFound('Card not found in your collection');
  } catch (error) {
    if (isStackCollision(error)) {
      throw ApiError.conflict(
        'You already have a stack of this card with those details. Add to that stack instead.',
      );
    }
    throw error;
  }

  const rows = await selectCollectionItems(db).where(eq(collectionItems.id, itemId)).limit(1);
  const row = rows[0];
  if (!row) throw ApiError.notFound('Card not found in your collection');
  const groups = await loadGroupsForItems(db, [itemId]);
  return toCollectionItem(row, groups.get(itemId) ?? []);
}

/** Postgres reports a broken unique index as SQLSTATE 23505. */
function isStackCollision(error: unknown): boolean {
  const candidates = [error, (error as { cause?: unknown } | null)?.cause];
  return candidates.some((candidate) => {
    if (typeof candidate !== 'object' || candidate === null) return false;
    const row = candidate as { code?: unknown; constraint_name?: unknown };
    return row.code === '23505' && row.constraint_name === 'collection_items_stack_key';
  });
}

/** Removes a stack. Its group memberships go with it. */
export async function removeCollectionItem(
  db: Database,
  userId: string,
  itemId: string,
): Promise<void> {
  await db
    .delete(collectionItems)
    .where(and(eq(collectionItems.id, itemId), eq(collectionItems.userId, userId)));
}

interface MatchAggregateRow {
  wantId: string;
  oracleId: string;
  cardName: string;
  wantQuantity: number;
  wantPriority: number;
  availableQuantity: number;
  wantedLanguages: string[] | null;
  unwantedLanguages: string[] | null;
  wantedFinishes: string[] | null;
  unwantedFinishes: string[] | null;
  wantedConditions: string[] | null;
  unwantedConditions: string[] | null;
  wantedSets: string[] | null;
  unwantedSets: string[] | null;
}

function textList(value: string[] | null): string[] {
  return value ?? [];
}

/** Empty keep-lists mean any value. A skip-list always removes that value. */
function valueAllowed(wanted: string[], unwanted: string[], value: string): boolean {
  const folded = value.toLowerCase();
  const keep = wanted.map((item) => item.toLowerCase());
  const skip = unwanted.map((item) => item.toLowerCase());
  if (keep.length > 0 && !keep.includes(folded)) return false;
  if (skip.includes(folded)) return false;
  return true;
}

/** Cards on the viewer's want list that this person holds for trade, across their collection. */
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

/**
 * The product in one query: cards on the viewer's want list that the owner is
 * holding for trade.
 *
 * The join goes want_items -> cards (by oracle_id) -> collection_items (by
 * scryfall_id), which is how a want for a card concept reaches every printing
 * of it sitting in the trade binder.
 */
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
      w.unwanted_languages        AS "unwantedLanguages",
      w.wanted_finishes           AS "wantedFinishes",
      w.unwanted_finishes         AS "unwantedFinishes",
      w.wanted_conditions         AS "wantedConditions",
      w.unwanted_conditions       AS "unwantedConditions",
      w.wanted_sets               AS "wantedSets",
      w.unwanted_sets             AS "unwantedSets"
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
        cardinality(w.unwanted_languages) = 0
        OR NOT (c.lang = ANY(w.unwanted_languages))
      )
      AND (
        cardinality(w.wanted_finishes) = 0
        OR bi.finish::text = ANY(w.wanted_finishes)
      )
      AND (
        cardinality(w.unwanted_finishes) = 0
        OR NOT (bi.finish::text = ANY(w.unwanted_finishes))
      )
      AND (
        cardinality(w.wanted_conditions) = 0
        OR bi.condition::text = ANY(w.wanted_conditions)
      )
      AND (
        cardinality(w.unwanted_conditions) = 0
        OR NOT (bi.condition::text = ANY(w.unwanted_conditions))
      )
      AND (
        cardinality(w.wanted_sets) = 0
        OR lower(c.set_code) = ANY(w.wanted_sets)
      )
      AND (
        cardinality(w.unwanted_sets) = 0
        OR NOT (lower(c.set_code) = ANY(w.unwanted_sets))
      )
    GROUP BY
      w.id, w.oracle_id, w.quantity, w.priority,
      w.wanted_languages, w.unwanted_languages,
      w.wanted_finishes, w.unwanted_finishes,
      w.wanted_conditions, w.unwanted_conditions,
      w.wanted_sets, w.unwanted_sets
    ORDER BY w.priority ASC, MIN(c.name) ASC
  `)) as unknown as MatchAggregateRow[];

  if (aggregates.length === 0) return [];

  const oracleIds = aggregates.map((row) => row.oracleId);

  // Second trip for the individual printings, so the UI can show which exact
  // copies are on offer without a correlated subquery per row.
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
        valueAllowed(
          textList(row.wantedLanguages),
          textList(row.unwantedLanguages),
          item.language,
        ) &&
        valueAllowed(textList(row.wantedFinishes), textList(row.unwantedFinishes), item.finish) &&
        valueAllowed(
          textList(row.wantedConditions),
          textList(row.unwantedConditions),
          item.condition,
        ) &&
        valueAllowed(textList(row.wantedSets), textList(row.unwantedSets), setCode)
      );
    }),
  }));
}

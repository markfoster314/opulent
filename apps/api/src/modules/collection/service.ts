import type { Database, UserRow } from '@opulent/db';
import {
  cardGroups,
  cards,
  collectionItems,
  genericWants,
  groupMemberships,
  tradeItems,
  trades,
  users,
  wantItems,
} from '@opulent/db';
import type {
  AddCollectionItemInput,
  CardFinish,
  CollectionHighlight,
  CollectionItem,
  CollectionItemQuery,
  CollectionSort,
  CollectionSummary,
  GroupRef,
  ItemPrice,
  Page,
  PriceRange,
  SortDirection,
  SplitCollectionItemInput,
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
  priceRangeDays,
} from '@opulent/shared';
import { and, asc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  assertPaperPrinting,
  assertPrintedLanguage,
  listLanguagePrintings,
} from '../cards/service';
import { ApiError } from '../../lib/http';
import { snapshotUserValue } from './value';

/** Scryfall may publish finishes we do not model yet, so unknown values drop out. */
function isCardFinish(value: string): value is CardFinish {
  return cardFinishSchema.safeParse(value).success;
}

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

/** One copy's market price in SQL, with the same English fallback as marketPrices. */
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

export async function getCollectionSummary(
  db: Database,
  userId: string,
): Promise<CollectionSummary> {
  const market = copyMarketPriceSql();
  const asking = sql`CASE ${collectionItems.priceKind}::text
    WHEN 'custom' THEN COALESCE(NULLIF(${collectionItems.priceAmount}, '')::numeric, 0)
    WHEN 'percent' THEN ROUND(${market} * ${collectionItems.pricePercent} / 100.0, 2)
    ELSE ${market} END`;
  const forTrade = sql`CASE WHEN ${collectionItems.forTrade} THEN 1 ELSE 0 END`;
  const rows = await db
    .select({
      cardCount: sql<number>`coalesce(sum(${collectionItems.quantity}), 0)::int`,
      forTradeCount: sql<number>`coalesce(sum(${collectionItems.quantity} * ${forTrade}), 0)::int`,
      marketValue: sql<string>`coalesce(sum(${collectionItems.quantity} * ${asking}), 0)::text`,
      forTradeValue: sql<string>`coalesce(sum(${collectionItems.quantity} * ${asking} * ${forTrade}), 0)::text`,
    })
    .from(collectionItems)
    .innerJoin(cards, eq(cards.scryfallId, collectionItems.scryfallId))
    .leftJoin(englishCards, englishPrintingJoin())
    .where(and(eq(collectionItems.userId, userId), eq(cards.game, CARD_GAME)));
  const row = rows[0];

  // The owner's side of live trades; drafts are not between two people yet.
  const onTheTable = await db
    .select({ count: sql<number>`coalesce(sum(${tradeItems.quantity}), 0)::int` })
    .from(tradeItems)
    .innerJoin(trades, eq(trades.id, tradeItems.tradeId))
    .where(
      and(
        sql`${trades.status} IN ('proposed', 'countered', 'accepted')`,
        or(
          and(eq(trades.proposerId, userId), eq(tradeItems.side, 'offered')),
          and(eq(trades.receiverId, userId), eq(tradeItems.side, 'requested')),
        ),
      ),
    );

  return {
    cardCount: Number(row?.cardCount ?? 0),
    forTradeCount: Number(row?.forTradeCount ?? 0),
    marketValue: Number(row?.marketValue ?? 0).toFixed(2),
    forTradeValue: Number(row?.forTradeValue ?? 0).toFixed(2),
    onTheTable: Number(onTheTable[0]?.count ?? 0),
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

/** Fills unused price columns so each row is complete: market uses 100, custom uses 0. */
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
  forTrade: boolean;
  signed: boolean;
  altered: boolean;
  misprint: boolean;
  miscut: boolean;
  artistProof: boolean;
  imageUrl: string | null;
  askingNow: string | null;
  change: string | null;
  changePercent: string | null;
  sortKey: string;
}

interface ValueCursor {
  key: string;
  id: string;
}

function encodeValueCursor(key: string, id: string): string {
  return Buffer.from(JSON.stringify({ key, id }), 'utf8').toString('base64url');
}

function decodeValueCursor(cursor: string): ValueCursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      key?: unknown;
      id?: unknown;
    };
    if (typeof parsed.key !== 'string' || typeof parsed.id !== 'string') throw new Error('shape');
    return { key: parsed.key, id: parsed.id };
  } catch {
    throw ApiError.badRequest('Malformed cursor');
  }
}

function toCollectionHighlight(row: ValueRow): CollectionHighlight {
  const price = row.askingNow === null ? null : Number(row.askingNow);
  const change = row.change === null ? null : Number(row.change);
  const percent = row.changePercent === null ? null : Number(row.changePercent);

  return {
    id: row.id,
    name: row.name,
    setCode: row.setCode,
    finish: row.finish as CollectionHighlight['finish'],
    quantity: Number(row.quantity),
    forTrade: row.forTrade,
    signed: row.signed,
    altered: row.altered,
    misprint: row.misprint,
    miscut: row.miscut,
    artistProof: row.artistProof,
    imageUrl: row.imageUrl,
    price: price === null ? null : price.toFixed(2),
    change: change === null || change === 0 ? null : `${change > 0 ? '+' : ''}${change.toFixed(2)}`,
    changePercent:
      percent === null || percent === 0 ? null : `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`,
  };
}

/** Paged cards; owner price overrides market, foreign printings fall back to English, cursor carries sort key and id. */
async function queryCardsByValue(
  db: Database,
  userId: string,
  options: {
    limit: number;
    sort: CollectionSort;
    dir: SortDirection;
    range: PriceRange;
    cursor?: ValueCursor;
    pricedOnly: boolean;
    changeBy: 'amount' | 'percent';
    changedOnly?: boolean;
    changeSign?: 'up' | 'down';
    filters?: Partial<CollectionItemQuery>;
  },
): Promise<Page<CollectionHighlight>> {
  const { sort, dir, cursor, pricedOnly } = options;
  const desc = dir === 'desc';
  const days = priceRangeDays[options.range];
  const filters = options.filters ?? {};
  const direction = sql.raw(desc ? 'DESC' : 'ASC');

  const filterSql = sql`
    ${filters.q ? sql`AND c.name ILIKE ${containsPattern(filters.q)} ESCAPE '\\'` : sql``}
    ${
      filters.set
        ? sql`AND (
            lower(c.set_code) = lower(${filters.set})
            OR c.set_name ILIKE ${containsPattern(filters.set)} ESCAPE '\\'
          )`
        : sql``
    }
    ${filters.type ? sql`AND c.type_line ILIKE ${containsPattern(filters.type)} ESCAPE '\\'` : sql``}
    ${filters.artist ? sql`AND c.raw->>'artist' ILIKE ${containsPattern(filters.artist)} ESCAPE '\\'` : sql``}
    ${filters.finish ? sql`AND ci.finish = ${filters.finish}::card_finish` : sql``}
    ${filters.condition ? sql`AND ci.condition = ${filters.condition}::card_condition` : sql``}
    ${filters.language ? sql`AND ci.language = ${filters.language}` : sql``}
    ${filters.rarity ? sql`AND c.rarity = ${filters.rarity}` : sql``}
    ${filters.forTrade ? sql`AND ci.for_trade = true` : sql``}
    ${filters.signed ? sql`AND ci.signed = true` : sql``}
    ${filters.altered ? sql`AND ci.altered = true` : sql``}
    ${filters.misprint ? sql`AND ci.misprint = true` : sql``}
    ${filters.miscut ? sql`AND ci.miscut = true` : sql``}
    ${filters.artistProof ? sql`AND ci.artist_proof = true` : sql``}
    ${
      filters.groupId
        ? sql`AND EXISTS (
            SELECT 1 FROM group_memberships gm
            WHERE gm.item_id = ci.id AND gm.group_id = ${filters.groupId}::uuid
          )`
        : sql``
    }
    ${
      filters.onWantList
        ? sql`AND EXISTS (
            SELECT 1 FROM want_items wi
            WHERE wi.user_id = ${userId} AND wi.oracle_id = c.oracle_id
          )`
        : sql``
    }
  `;

  const byPercent = options.changeBy === 'percent';
  const sortKey =
    sort === 'name'
      ? sql`name`
      : sort === 'price'
        ? sql`sort_price`
        : byPercent
          ? sql`sort_change_percent`
          : sql`sort_change`;
  const sortKeyOut =
    sort === 'name'
      ? sql`r.name`
      : sort === 'price'
        ? sql`r.sort_price::text`
        : byPercent
          ? sql`r.sort_change_percent::text`
          : sql`r.sort_change::text`;
  const sortKeyOutSort =
    sort === 'name'
      ? sql`r.name`
      : sort === 'price'
        ? sql`r.sort_price`
        : byPercent
          ? sql`r.sort_change_percent`
          : sql`r.sort_change`;
  const cursorKey =
    sort === 'name' ? sql`${cursor?.key ?? ''}::text` : sql`${cursor?.key ?? '0'}::numeric`;
  const cursorSql = cursor
    ? sql`AND (${sortKey}, id) ${sql.raw(desc ? '<' : '>')} (${cursorKey}, ${cursor.id}::uuid)`
    : sql``;

  const rows = (await db.execute(sql`
    WITH scoped AS (
      SELECT
        ci.id,
        ci.scryfall_id,
        ci.finish,
        ci.quantity,
        ci.for_trade,
        ci.signed,
        ci.altered,
        ci.misprint,
        ci.miscut,
        ci.artist_proof,
        ci.price_kind,
        ci.price_percent,
        ci.price_amount,
        c.name,
        c.set_code,
        c.image_uris,
        c.rarity,
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
      ${filterSql}
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
    aged AS (
      SELECT
        asking.*,
        (
          CASE price_kind
            WHEN 'custom' THEN NULLIF(price_amount, '')::numeric
            WHEN 'percent' THEN
              ROUND(COALESCE(old_own.price, old_english.price) * price_percent / 100.0, 2)
            ELSE COALESCE(old_own.price, old_english.price)
          END
        ) AS old_asking
      FROM asking
      LEFT JOIN LATERAL (
        SELECT
          CASE asking.finish::text
            WHEN 'foil' THEN h.usd_foil
            WHEN 'etched' THEN h.usd_etched
            ELSE h.usd
          END::numeric AS price
        FROM card_price_history h
        WHERE h.scryfall_id = asking.scryfall_id
          AND h.recorded_on <= CURRENT_DATE - ${days}::int
        ORDER BY h.recorded_on DESC
        LIMIT 1
      ) old_own ON true
      LEFT JOIN LATERAL (
        SELECT
          CASE asking.finish::text
            WHEN 'foil' THEN h.usd_foil
            WHEN 'etched' THEN h.usd_etched
            ELSE h.usd
          END::numeric AS price
        FROM card_price_history h
        WHERE h.scryfall_id = asking.english_scryfall_id
          AND h.recorded_on <= CURRENT_DATE - ${days}::int
        ORDER BY h.recorded_on DESC
        LIMIT 1
      ) old_english ON true
    ),
    keyed AS (
      SELECT
        aged.*,
        COALESCE(asking_now, 0) AS sort_price,
        CASE
          WHEN asking_now IS NULL OR old_asking IS NULL THEN NULL
          ELSE ROUND(asking_now - old_asking, 2)
        END AS change,
        CASE
          WHEN asking_now IS NULL OR old_asking IS NULL OR old_asking <= 0 THEN NULL
          ELSE ROUND((asking_now - old_asking) / old_asking * 100, 2)
        END AS change_percent
      FROM aged
    ),
    sortable AS (
      SELECT
        keyed.*,
        COALESCE(change, ${desc ? -1e12 : 1e12}) AS sort_change,
        COALESCE(change_percent, ${desc ? -1e12 : 1e12}) AS sort_change_percent
      FROM keyed
    ),
    ranked AS (
      SELECT * FROM sortable
      WHERE TRUE
        ${pricedOnly ? sql`AND asking_now > 0` : sql``}
        ${
          options.changedOnly
            ? sql`AND ${byPercent ? sql`change_percent` : sql`change`} IS NOT NULL
                AND ${byPercent ? sql`change_percent` : sql`change`} <> 0`
            : sql``
        }
        ${
          options.changeSign === 'up'
            ? sql`AND ${byPercent ? sql`change_percent` : sql`change`} > 0`
            : options.changeSign === 'down'
              ? sql`AND ${byPercent ? sql`change_percent` : sql`change`} < 0`
              : sql``
        }
        ${cursorSql}
      ORDER BY ${sortKey} ${direction}, id ${direction}
      LIMIT ${options.limit + 1}
    )
    SELECT
      r.id,
      r.name,
      r.set_code AS "setCode",
      r.finish::text AS finish,
      r.quantity,
      r.for_trade AS "forTrade",
      r.signed,
      r.altered,
      r.misprint,
      r.miscut,
      r.artist_proof AS "artistProof",
      COALESCE(
        r.image_uris->>'normal',
        r.image_uris->>'large',
        r.image_uris->>'small'
      ) AS "imageUrl",
      CASE WHEN r.asking_now IS NULL THEN NULL ELSE r.asking_now::text END AS "askingNow",
      r.change::text AS change,
      r.change_percent::text AS "changePercent",
      ${sortKeyOut} AS "sortKey"
    FROM ranked r
    ORDER BY ${sortKeyOutSort} ${direction}, r.id ${direction}
  `)) as unknown as ValueRow[];

  const hasMore = rows.length > options.limit;
  const page = hasMore ? rows.slice(0, options.limit) : rows;
  const last = page[page.length - 1];

  return {
    items: page.map(toCollectionHighlight),
    nextCursor: hasMore && last ? encodeValueCursor(last.sortKey, last.id) : null,
  };
}

export async function listCollectionMovers(
  db: Database,
  userId: string,
  query: { limit: number; range: PriceRange; changeBy: 'amount' | 'percent' },
): Promise<{ gainers: CollectionHighlight[]; losers: CollectionHighlight[] }> {
  const common = {
    limit: query.limit,
    sort: 'change' as const,
    range: query.range,
    changeBy: query.changeBy,
    pricedOnly: false,
    changedOnly: true,
  };
  const [gainers, losers] = await Promise.all([
    queryCardsByValue(db, userId, { ...common, dir: 'desc', changeSign: 'up' }),
    queryCardsByValue(db, userId, { ...common, dir: 'asc', changeSign: 'down' }),
  ]);
  return { gainers: gainers.items, losers: losers.items };
}

export async function listCollectionHighlights(
  db: Database,
  userId: string,
  limit: number,
): Promise<CollectionHighlight[]> {
  const page = await queryCardsByValue(db, userId, {
    limit,
    sort: 'price',
    dir: 'desc',
    range: '1w',
    pricedOnly: true,
    changeBy: 'amount',
  });
  return page.items;
}

/** Every card, filtered and ranked. Unpriced stacks come last with a dash. */
export interface CollectionCardsOptions {
  limit?: number;
  cursor?: string;
  sort?: CollectionSort;
  dir?: SortDirection;
  range?: PriceRange;
  changeBy?: 'amount' | 'percent';
  filters?: Partial<CollectionItemQuery>;
}

export async function listCollectionCardsByValue(
  db: Database,
  userId: string,
  options: CollectionCardsOptions = {},
): Promise<Page<CollectionHighlight>> {
  return queryCardsByValue(db, userId, {
    limit: options.limit ?? 50,
    sort: options.sort ?? 'price',
    dir: options.dir ?? 'desc',
    range: options.range ?? '1w',
    pricedOnly: false,
    changeBy: options.changeBy ?? 'amount',
    filters: options.filters ?? {},
    ...(options.cursor ? { cursor: decodeValueCursor(options.cursor) } : {}),
  });
}

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

type CollectionItemListQuery = Partial<CollectionItemQuery> & { limit: number };

/** Keyset pagination by name and id, so a mid-scroll insert cannot duplicate or skip rows. */
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

export async function listCollectionItems(
  db: Database,
  userId: string,
  pagination: CollectionItemListQuery,
): Promise<Page<CollectionItem>> {
  return pageOfItems(db, eq(collectionItems.userId, userId), pagination, userId, true);
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

/** Group contents; only the owner reaches this through the groups module. */
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

/** Escapes LIKE wildcards so % and _ in a typed name stay literal. */
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

/** A snapshot failure must not fail the card change; the daily job catches up. */
async function refreshTodayValue(db: Database, userId: string): Promise<void> {
  try {
    await snapshotUserValue(db, userId);
  } catch (error) {
    console.error('collection value snapshot failed', error);
  }
}

/** Adds a card or bumps the exact stack; price is not part of the stack key. */
export async function addCollectionItem(
  db: Database,
  userId: string,
  input: CollectionItemInput,
): Promise<CollectionItem> {
  await assertPaperPrinting(db, input.scryfallId);
  await assertPrintedLanguage(db, input.scryfallId, input.language);

  const groupIds = Array.from(new Set(input.groupIds ?? []));
  if (groupIds.length > 0) {
    const owned = await db
      .select({ id: cardGroups.id })
      .from(cardGroups)
      .where(and(eq(cardGroups.userId, userId), inArray(cardGroups.id, groupIds)));
    if (owned.length !== groupIds.length) {
      throw ApiError.badRequest('One of those groups is not yours');
    }
  }

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
        // Do not overwrite an existing owner price; edit the stack to change it.
        forTrade: sql`${collectionItems.forTrade} OR excluded.for_trade`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: collectionItems.id });

  const id = inserted[0]?.id;
  if (!id) throw new ApiError('internal_error', 'Could not add the card');

  if (groupIds.length > 0) {
    await db
      .insert(groupMemberships)
      .values(groupIds.map((groupId) => ({ itemId: id, groupId, userId })))
      .onConflictDoNothing();
  }

  const rows = await selectCollectionItems(db).where(eq(collectionItems.id, id)).limit(1);
  const row = rows[0];
  if (!row) throw new ApiError('internal_error', 'Could not read back the added card');
  const groups = await loadGroupsForItems(db, [id]);
  await refreshTodayValue(db, userId);
  return toCollectionItem(row, groups.get(id) ?? []);
}

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
    // A language change moves to that language's printing, which has its own Scryfall id.
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

  if (input.groupIds !== undefined) {
    const groupIds = [...new Set(input.groupIds)];
    if (groupIds.length > 0) {
      const owned = await db
        .select({ id: cardGroups.id })
        .from(cardGroups)
        .where(and(eq(cardGroups.userId, userId), inArray(cardGroups.id, groupIds)));
      if (owned.length !== groupIds.length) {
        throw ApiError.badRequest('One of those groups is not yours.');
      }
    }
    await db.delete(groupMemberships).where(eq(groupMemberships.itemId, itemId));
    if (groupIds.length > 0) {
      await db
        .insert(groupMemberships)
        .values(groupIds.map((groupId) => ({ itemId, groupId, userId })))
        .onConflictDoNothing();
    }
  }

  const rows = await selectCollectionItems(db).where(eq(collectionItems.id, itemId)).limit(1);
  const row = rows[0];
  if (!row) throw ApiError.notFound('Card not found in your collection');
  const groups = await loadGroupsForItems(db, [itemId]);
  await refreshTodayValue(db, userId);
  return toCollectionItem(row, groups.get(itemId) ?? []);
}

/** Splits one copy into a new stack; an existing matching stack absorbs it and the original loses one. */
export async function splitCollectionItem(
  db: Database,
  userId: string,
  itemId: string,
  input: SplitCollectionItemInput,
): Promise<void> {
  const rows = await db
    .select()
    .from(collectionItems)
    .where(and(eq(collectionItems.id, itemId), eq(collectionItems.userId, userId)))
    .limit(1);
  const current = rows[0];
  if (!current) throw ApiError.notFound('Card not found in your collection');
  if (current.quantity <= 1) {
    throw ApiError.badRequest('This stack has only one copy. Edit the whole stack instead.');
  }

  let scryfallId = current.scryfallId;
  const language = (input.language ?? current.language) as NonNullable<
    SplitCollectionItemInput['language']
  >;
  if (language !== current.language) {
    await assertPrintedLanguage(db, current.scryfallId, language);
    const printings = await listLanguagePrintings(db, current.scryfallId);
    const next = printings.find((card) => cardLanguageOrEnglish(card.lang) === language);
    if (!next) throw ApiError.badRequest('This card was not printed in that language.');
    scryfallId = next.scryfallId;
  }

  const groupIds =
    input.groupIds !== undefined
      ? [...new Set(input.groupIds)]
      : (
          await db
            .select({ groupId: groupMemberships.groupId })
            .from(groupMemberships)
            .where(eq(groupMemberships.itemId, itemId))
        ).map((row) => row.groupId);

  if (input.groupIds !== undefined && groupIds.length > 0) {
    const owned = await db
      .select({ id: cardGroups.id })
      .from(cardGroups)
      .where(and(eq(cardGroups.userId, userId), inArray(cardGroups.id, groupIds)));
    if (owned.length !== groupIds.length) {
      throw ApiError.badRequest('One of those groups is not yours.');
    }
  }

  const sameStack =
    scryfallId === current.scryfallId &&
    (input.finish ?? current.finish) === current.finish &&
    (input.condition ?? current.condition) === current.condition &&
    language === current.language &&
    (input.signed ?? current.signed) === current.signed &&
    (input.altered ?? current.altered) === current.altered &&
    (input.misprint ?? current.misprint) === current.misprint &&
    (input.miscut ?? current.miscut) === current.miscut &&
    (input.artistProof ?? current.artistProof) === current.artistProof;
  if (sameStack) {
    throw ApiError.badRequest(
      'Change the finish, condition, language, or a mark to split off one copy.',
    );
  }

  const price = input.price
    ? priceColumns(input.price)
    : {
        priceKind: current.priceKind,
        pricePercent: current.pricePercent,
        priceAmount: current.priceAmount,
      };

  await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(collectionItems)
      .values({
        userId,
        scryfallId,
        quantity: 1,
        finish: input.finish ?? current.finish,
        condition: input.condition ?? current.condition,
        language,
        signed: input.signed ?? current.signed,
        altered: input.altered ?? current.altered,
        misprint: input.misprint ?? current.misprint,
        miscut: input.miscut ?? current.miscut,
        artistProof: input.artistProof ?? current.artistProof,
        notes: input.notes !== undefined ? input.notes : current.notes,
        photoUrl: input.photoUrl !== undefined ? input.photoUrl : current.photoUrl,
        forTrade: input.forTrade ?? current.forTrade,
        ...price,
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
          quantity: sql`${collectionItems.quantity} + 1`,
          forTrade: sql`${collectionItems.forTrade} OR excluded.for_trade`,
          updatedAt: new Date(),
        },
      })
      .returning({ id: collectionItems.id });

    const newId = inserted[0]?.id;
    if (!newId) throw new ApiError('internal_error', 'Could not split the stack');

    const changed = await tx
      .update(collectionItems)
      .set({
        quantity: sql`${collectionItems.quantity} - 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(collectionItems.id, itemId),
          eq(collectionItems.userId, userId),
          sql`${collectionItems.quantity} > 1`,
        ),
      )
      .returning({ id: collectionItems.id });
    if (!changed[0]) {
      throw ApiError.conflict('That stack changed before the split. Try again.');
    }

    if (groupIds.length > 0) {
      await tx
        .insert(groupMemberships)
        .values(groupIds.map((groupId) => ({ itemId: newId, groupId, userId })))
        .onConflictDoNothing();
    }
  });

  await refreshTodayValue(db, userId);
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

export async function removeCollectionItem(
  db: Database,
  userId: string,
  itemId: string,
): Promise<void> {
  await db
    .delete(collectionItems)
    .where(and(eq(collectionItems.id, itemId), eq(collectionItems.userId, userId)));
  await refreshTodayValue(db, userId);
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

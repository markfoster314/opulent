import type { Database } from '@opulent/db';
import { cards, collectionItems, tradeItems, trades } from '@opulent/db';
import type {
  CollectionHighlight,
  CollectionItemQuery,
  CollectionSort,
  CollectionSummary,
  Page,
  PriceRange,
  SortDirection,
} from '@opulent/shared';
import { CARD_GAME, priceRangeDays } from '@opulent/shared';
import { and, eq, or, sql } from 'drizzle-orm';
import { ApiError } from '../../lib/http';
import { containsPattern, englishCards, englishPrintingJoin } from './rows';

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

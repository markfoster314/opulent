import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import {
  cardPriceHistory,
  cards,
  collectionItems,
  collectionValueSnapshots,
  groupMemberships,
  type Database,
} from '@opulent/db';
import {
  CARD_GAME,
  cardConditionLabels,
  cardFinishLabels,
  cardLanguageLabels,
  cardRarityLabels,
  priceRangeDays,
  type CardCondition,
  type CardFinish,
  type CardLanguage,
  type CardRarity,
  type CollectionValueBreakdown,
  type CollectionValueBreakdownBy,
  type CollectionValueHistory,
  type PriceRange,
} from '@opulent/shared';

/** The English printing, used for a price when the owned printing has none. */
const englishValueCards = alias(cards, 'english_value_card');

function englishMatch() {
  return and(
    eq(englishValueCards.setCode, cards.setCode),
    eq(englishValueCards.collectorNumber, cards.collectorNumber),
    eq(englishValueCards.lang, 'en'),
    sql`jsonb_exists(${englishValueCards.raw}->'games', 'paper')`,
    sql`${englishValueCards.layout} IS DISTINCT FROM 'art_series'`,
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

interface HistoryRow {
  scryfallId: string;
  recordedOn: string;
  usd: string | null;
  usdFoil: string | null;
  usdEtched: string | null;
}

function priceFor(row: HistoryRow | null, finish: string): number | null {
  if (!row) return null;
  const raw = finish === 'foil' ? row.usdFoil : finish === 'etched' ? row.usdEtched : row.usd;
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * The whole collection's asking value, one point per day.
 *
 * Past days come from frozen daily snapshots, so an add today cannot rewrite
 * yesterday. Today is computed live. Days before the snapshot era fall back to
 * the current composition, and the first view freezes that approximation.
 * Each stack follows its own rule: market price on that day, the owner's
 * percent of that price, or a flat custom amount.
 */
export async function getCollectionValueHistory(
  db: Database,
  userId: string,
  range: PriceRange,
): Promise<CollectionValueHistory> {
  const stacks = await db
    .select({
      id: collectionItems.id,
      scryfallId: collectionItems.scryfallId,
      englishScryfallId: englishValueCards.scryfallId,
      finish: collectionItems.finish,
      quantity: collectionItems.quantity,
      priceKind: collectionItems.priceKind,
      pricePercent: collectionItems.pricePercent,
      priceAmount: collectionItems.priceAmount,
    })
    .from(collectionItems)
    .innerJoin(cards, eq(cards.scryfallId, collectionItems.scryfallId))
    .leftJoin(englishValueCards, englishMatch())
    .where(and(eq(collectionItems.userId, userId), eq(cards.game, CARD_GAME)));

  if (stacks.length === 0) return { range, points: [] };

  const to = new Date().toISOString().slice(0, 10);
  const from = addDays(to, -priceRangeDays[range]);

  const ids = Array.from(
    new Set(
      stacks
        .flatMap((stack) => [stack.scryfallId, stack.englishScryfallId])
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const fields = {
    scryfallId: cardPriceHistory.scryfallId,
    recordedOn: cardPriceHistory.recordedOn,
    usd: cardPriceHistory.usd,
    usdFoil: cardPriceHistory.usdFoil,
    usdEtched: cardPriceHistory.usdEtched,
  };

  const [before, inside] = await Promise.all([
    db
      .selectDistinctOn([cardPriceHistory.scryfallId], fields)
      .from(cardPriceHistory)
      .where(and(inArray(cardPriceHistory.scryfallId, ids), lte(cardPriceHistory.recordedOn, from)))
      .orderBy(cardPriceHistory.scryfallId, desc(cardPriceHistory.recordedOn)),
    db
      .select(fields)
      .from(cardPriceHistory)
      .where(
        and(
          inArray(cardPriceHistory.scryfallId, ids),
          gte(cardPriceHistory.recordedOn, from),
          lte(cardPriceHistory.recordedOn, to),
        ),
      )
      .orderBy(asc(cardPriceHistory.scryfallId), asc(cardPriceHistory.recordedOn)),
  ]);

  // One price per day. A baseline row on the first day is replaced by the row
  // inside the window, which is the same price or the newer one.
  const perCard = new Map<string, Map<string, HistoryRow>>();
  for (const row of [...before, ...inside]) {
    let days = perCard.get(row.scryfallId);
    if (!days) {
      days = new Map();
      perCard.set(row.scryfallId, days);
    }
    days.set(row.recordedOn, row);
  }
  const series = new Map<string, HistoryRow[]>();
  for (const [id, days] of perCard) {
    series.set(
      id,
      Array.from(days.values()).sort((a, b) => a.recordedOn.localeCompare(b.recordedOn)),
    );
  }

  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);

  const totals = new Array<number>(days.length).fill(0);

  for (const stack of stacks) {
    const own = series.get(stack.scryfallId) ?? [];
    const english = stack.englishScryfallId ? (series.get(stack.englishScryfallId) ?? []) : [];
    const custom = stack.priceKind === 'custom' ? Number(stack.priceAmount) : null;
    let ownIndex = 0;
    let englishIndex = 0;
    let ownRow: HistoryRow | null = null;
    let englishRow: HistoryRow | null = null;

    for (let index = 0; index < days.length; index++) {
      const day = days[index]!;
      while (ownIndex < own.length && own[ownIndex]!.recordedOn <= day) {
        ownRow = own[ownIndex]!;
        ownIndex++;
      }
      while (englishIndex < english.length && english[englishIndex]!.recordedOn <= day) {
        englishRow = english[englishIndex]!;
        englishIndex++;
      }

      let unit: number | null;
      if (custom !== null) {
        unit = Number.isFinite(custom) ? custom : null;
      } else {
        const market = priceFor(ownRow, stack.finish) ?? priceFor(englishRow, stack.finish);
        unit =
          market === null
            ? null
            : stack.priceKind === 'percent'
              ? round2((market * stack.pricePercent) / 100)
              : market;
      }

      if (unit !== null && unit > 0) totals[index]! += unit * stack.quantity;
    }
  }

  // Past days come from the frozen daily snapshots. Days before the first
  // snapshot fall back to the old approximation, and today is always live.
  const snapshots = await db
    .select({ day: collectionValueSnapshots.day, value: collectionValueSnapshots.value })
    .from(collectionValueSnapshots)
    .where(
      and(
        eq(collectionValueSnapshots.userId, userId),
        gte(collectionValueSnapshots.day, from),
        lte(collectionValueSnapshots.day, to),
      ),
    )
    .orderBy(asc(collectionValueSnapshots.day));

  const snapshotByDay = new Map(snapshots.map((row) => [row.day, Number(row.value)]));
  const firstSnapshotDay = snapshots[0]?.day ?? null;

  // The first view freezes the days before the snapshot era. After this, an add
  // today cannot rewrite yesterday. The approximation is the best data we have.
  const missingPast = days
    .map((day, index) => ({ day, value: round2(totals[index]!) }))
    .filter(({ day }) => day !== to && !snapshotByDay.has(day));

  if (missingPast.length > 0) {
    try {
      await db
        .insert(collectionValueSnapshots)
        .values(missingPast.map(({ day, value }) => ({ userId, day, value: value.toFixed(2) })))
        .onConflictDoNothing();
      for (const { day, value } of missingPast) snapshotByDay.set(day, value);
    } catch (error) {
      console.error('collection value backfill failed', error);
    }
  }

  const currentValue = await getCollectionCurrentValue(db, userId);
  let previousSnapshot: number | null = null;

  const points = days.map((date, index) => {
    if (date === to) return { date, value: currentValue };

    const snapshot = snapshotByDay.get(date);
    if (snapshot !== undefined) {
      previousSnapshot = snapshot;
      return { date, value: snapshot };
    }

    if (firstSnapshotDay === null || date < firstSnapshotDay) {
      return { date, value: round2(totals[index]!) };
    }

    // A missed job day keeps the last frozen value instead of re-pricing today's
    // holdings into the past.
    return { date, value: previousSnapshot ?? round2(totals[index]!) };
  });

  // Before the first recorded price there is nothing to show, so the line starts
  // at the first day with a real value instead of hugging zero for months.
  const firstPriced = points.findIndex((point) => point.value > 0);

  return { range, points: firstPriced === -1 ? [] : points.slice(firstPriced) };
}

/** Unit asking price times quantity, for a statement that joins cards and the English fallback. */
function askingValueSql() {
  const marketPrice = sql`CASE ${collectionItems.finish}::text
    WHEN 'foil' THEN NULLIF(${cards.prices}->>'usd_foil', '')::numeric
    WHEN 'etched' THEN NULLIF(${cards.prices}->>'usd_etched', '')::numeric
    ELSE NULLIF(${cards.prices}->>'usd', '')::numeric END`;
  const englishPrice = sql`CASE ${collectionItems.finish}::text
    WHEN 'foil' THEN NULLIF(${englishValueCards.prices}->>'usd_foil', '')::numeric
    WHEN 'etched' THEN NULLIF(${englishValueCards.prices}->>'usd_etched', '')::numeric
    ELSE NULLIF(${englishValueCards.prices}->>'usd', '')::numeric END`;
  const market = sql`COALESCE(${marketPrice}, ${englishPrice})`;
  const asking = sql`CASE ${collectionItems.priceKind}::text
    WHEN 'custom' THEN NULLIF(${collectionItems.priceAmount}, '')::numeric
    WHEN 'percent' THEN ROUND(${market} * ${collectionItems.pricePercent} / 100.0, 2)
    ELSE ${market} END`;
  return sql<string>`COALESCE(${asking}, 0) * ${collectionItems.quantity}`;
}

function todayDay(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The collection's asking value right now, with the same price rules as the chart. */
export async function getCollectionCurrentValue(db: Database, userId: string): Promise<number> {
  const rows = await db
    .select({ value: sql<string>`coalesce(sum(${askingValueSql()}), 0)::text` })
    .from(collectionItems)
    .innerJoin(cards, eq(cards.scryfallId, collectionItems.scryfallId))
    .leftJoin(englishValueCards, englishMatch())
    .where(and(eq(collectionItems.userId, userId), eq(cards.game, CARD_GAME)));

  return round2(Number(rows[0]?.value ?? 0));
}

/** Freezes one person's value for a day. Called after a collection change and by the daily job. */
export async function snapshotUserValue(
  db: Database,
  userId: string,
  day = todayDay(),
): Promise<void> {
  const value = await getCollectionCurrentValue(db, userId);
  await db
    .insert(collectionValueSnapshots)
    .values({ userId, day, value: value.toFixed(2) })
    .onConflictDoUpdate({
      target: [collectionValueSnapshots.userId, collectionValueSnapshots.day],
      set: { value: sql`excluded.value` },
    });
}

/** Freezes today's value for everyone who owns cards. Returns the number of people written. */
export async function snapshotCollectionValues(db: Database, day = todayDay()): Promise<number> {
  const rows = await db.execute(sql`
    INSERT INTO collection_value_snapshots (user_id, day, value)
    SELECT collection_items.user_id, ${day}::date, COALESCE(SUM(${askingValueSql()}), 0)
    FROM collection_items
    INNER JOIN cards ON cards.scryfall_id = collection_items.scryfall_id
    LEFT JOIN cards AS english_value_card ON ${englishMatch()}
    WHERE cards.game = ${CARD_GAME}
    GROUP BY collection_items.user_id
    ON CONFLICT (user_id, day) DO UPDATE SET value = EXCLUDED.value
    RETURNING user_id
  `);

  return rows.length;
}

/** Group id to the total asking value of its members. */
export async function getGroupValues(db: Database, userId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({
      groupId: groupMemberships.groupId,
      value: sql<string>`coalesce(sum(${askingValueSql()}), 0)::text`,
    })
    .from(groupMemberships)
    .innerJoin(collectionItems, eq(collectionItems.id, groupMemberships.itemId))
    .innerJoin(cards, eq(cards.scryfallId, collectionItems.scryfallId))
    .leftJoin(englishValueCards, englishMatch())
    .where(and(eq(groupMemberships.userId, userId), eq(cards.game, CARD_GAME)))
    .groupBy(groupMemberships.groupId);

  return new Map(rows.map((row) => [row.groupId, Number(row.value).toFixed(2)]));
}

/** What share of the current asking value each bucket holds. */
export async function getCollectionValueBreakdown(
  db: Database,
  userId: string,
  by: CollectionValueBreakdownBy,
): Promise<CollectionValueBreakdown> {
  const value = askingValueSql();

  const rows = await db
    .select({
      setCode: cards.setCode,
      rarity: cards.rarity,
      finish: collectionItems.finish,
      condition: collectionItems.condition,
      language: collectionItems.language,
      signed: collectionItems.signed,
      altered: collectionItems.altered,
      misprint: collectionItems.misprint,
      miscut: collectionItems.miscut,
      artistProof: collectionItems.artistProof,
      forTrade: collectionItems.forTrade,
      value,
    })
    .from(collectionItems)
    .innerJoin(cards, eq(cards.scryfallId, collectionItems.scryfallId))
    .leftJoin(englishValueCards, englishMatch())
    .where(and(eq(collectionItems.userId, userId), eq(cards.game, CARD_GAME)));

  const buckets = new Map<string, { label: string; value: number }>();
  function add(key: string, label: string, amount: number): void {
    const current = buckets.get(key);
    buckets.set(key, { label, value: (current?.value ?? 0) + amount });
  }

  for (const row of rows) {
    const amount = Number(row.value);
    if (!Number.isFinite(amount) || amount <= 0) continue;

    switch (by) {
      case 'set':
        add(row.setCode, row.setCode.toUpperCase(), amount);
        break;
      case 'rarity': {
        const key = row.rarity ?? 'unknown';
        add(key, cardRarityLabels[key as CardRarity] ?? key, amount);
        break;
      }
      case 'finish':
        add(row.finish, cardFinishLabels[row.finish as CardFinish] ?? row.finish, amount);
        break;
      case 'condition':
        add(
          row.condition,
          cardConditionLabels[row.condition as CardCondition] ?? row.condition,
          amount,
        );
        break;
      case 'language':
        add(row.language, cardLanguageLabels[row.language as CardLanguage] ?? row.language, amount);
        break;
      case 'marks': {
        const marks = [
          row.signed && 'Signed',
          row.altered && 'Altered',
          row.misprint && 'Misprint',
          row.miscut && 'Miscut',
          row.artistProof && 'Artist proof',
        ].filter(Boolean) as string[];
        const label = marks.length > 0 ? marks.join(' + ') : 'No marks';
        add(label, label, amount);
        break;
      }
      case 'trade': {
        const label = row.forTrade ? 'For trade' : 'Not for trade';
        add(label, label, amount);
        break;
      }
    }
  }

  const items = Array.from(buckets.entries())
    .map(([key, bucket]) => ({ key, label: bucket.label, value: round2(bucket.value) }))
    .filter((bucket) => bucket.value > 0)
    .sort((a, b) => b.value - a.value);

  return {
    by,
    total: round2(items.reduce((sum, bucket) => sum + bucket.value, 0)),
    buckets: items,
  };
}

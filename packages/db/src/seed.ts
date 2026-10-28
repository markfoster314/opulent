import { pathToFileURL } from 'node:url';
import {
  cardLanguageOrEnglish,
  genericWantMatchKey,
  wantScopeKey,
  type CreateGenericWantInput,
} from '@opulent/shared';
import { and, eq, inArray, like, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { postgresSsl } from './connection-string';
import { loadEnv } from './load-env';
import { assertLocalDatabase } from './local-only';
import { ensurePricePartitions } from './price-partitions';
import {
  cardGroups,
  collectionItems,
  collectionValueSnapshots,
  cardPriceHistory,
  cards,
  friendships,
  genericWants,
  groupMemberships,
  places,
  tradeItems,
  trades,
  users,
  wantItems,
  wantListItems,
  wantLists,
} from './schema';
import type { NewCardPriceHistoryRow } from './schema';

/** Dev trade data; re-running replaces only these ten users' rows, never anyone else's. */

const CARDS_PER_COLLECTION = 100;

/** Frozen days of collection values; ends yesterday because today stays live. */
const SNAPSHOT_DAYS = 120;

/** Cards many users both own and want; the rest of each list is unique. */
const SHARED_POOL_SIZE = 240;
const SHARED_HAVE = 80;
const SHARED_WANT = 80;

/** One English printing per card: enough for the shared pool plus unique fillers. */
const POOL_SIZE = 4200;

const SKIPPED_LAYOUTS = [
  'art_series',
  'token',
  'double_faced_token',
  'emblem',
  'art_card',
  'vanguard',
  'scheme',
  'planar',
] as const;

type Visibility = 'public' | 'private';

type Person = {
  username: string;
  auth0Sub: string;
  place: string;
  visibility: Visibility;
  bio: string;
};

const PEOPLE: Person[] = [
  {
    username: 'mark',
    auth0Sub: 'seed|mark',
    place: 'Atlanta, Georgia, United States',
    visibility: 'public',
    bio: 'Trading from Atlanta. Near mint copies preferred.',
  },
  {
    username: 'ava_lane',
    auth0Sub: 'seed|ava_lane',
    place: 'Atlanta, Georgia, United States',
    visibility: 'public',
    bio: 'Looking for foils and signed copies.',
  },
  {
    username: 'jordan_cole',
    auth0Sub: 'seed|jordan_cole',
    place: 'Atlanta, Georgia, United States',
    visibility: 'public',
    bio: 'Happy to meet in Atlanta for a trade.',
  },
  {
    username: 'priya_shah',
    auth0Sub: 'seed|priya_shah',
    place: 'Atlanta, Georgia, United States',
    visibility: 'public',
    bio: 'Mostly modern cards, some older staples.',
  },
  {
    username: 'sam_ortiz',
    auth0Sub: 'seed|sam_ortiz',
    place: 'Atlanta, Georgia, United States',
    visibility: 'public',
    bio: 'Will trade extras for cards on my lists.',
  },
  {
    username: 'nia_brooks',
    auth0Sub: 'seed|nia_brooks',
    place: 'Atlanta, Georgia, United States',
    visibility: 'private',
    bio: 'Private page. Message through a trade.',
  },
  {
    username: 'chris_hale',
    auth0Sub: 'seed|chris_hale',
    place: 'Marietta, Georgia, United States',
    visibility: 'public',
    bio: 'Just north of Atlanta, in Marietta.',
  },
  {
    username: 'devon_park',
    auth0Sub: 'seed|devon_park',
    place: 'Decatur, Georgia, United States',
    visibility: 'public',
    bio: 'Decatur trader. Even trades welcome.',
  },
  {
    username: 'riley_nguyen',
    auth0Sub: 'seed|riley_nguyen',
    place: 'Chicago, Illinois, United States',
    visibility: 'public',
    bio: 'Shipping from Chicago.',
  },
  {
    username: 'morgan_ellis',
    auth0Sub: 'seed|morgan_ellis',
    place: 'Seattle, Washington, United States',
    visibility: 'public',
    bio: 'Seattle. Foils and artist proofs.',
  },
];

const WANT_SLUGS = ['seed-staples-i-need', 'seed-commander-upgrades', 'seed-specs'] as const;

const GROUP_PLANS = [
  { name: 'Trade staples', description: 'Seed data for local trade tests.' },
  { name: 'Foil box', description: 'Seed data for local trade tests.' },
  { name: 'Extra copies', description: 'Seed data for local trade tests.' },
];

const WANT_PLANS = [
  { name: 'Staples I need', slug: WANT_SLUGS[0], visibility: 'public' as const },
  { name: 'Commander upgrades', slug: WANT_SLUGS[1], visibility: 'private' as const },
  { name: 'Specs', slug: WANT_SLUGS[2], visibility: 'unlisted' as const },
];

type StockCard = { oracleId: string; scryfallId: string };

type Printing = {
  name: string;
  oracleId: string;
  scryfallId: string;
  setCode: string;
  finishes: string[];
};

type WantChoices = {
  languages: Set<string>;
  finishes: Set<string>;
  sets: Set<string>;
};

type OwnedCopy = {
  printing: Printing;
  finish: 'foil' | 'nonfoil';
  language: string;
  condition: 'NM' | 'LP';
  signed: boolean;
  artistProof: boolean;
  quantity: number;
};

type Mix = CreateGenericWantInput;

function emptyMix(partial: Partial<Mix>): Mix {
  return {
    languages: [],
    finishes: [],
    conditions: [],
    sets: [],
    signed: false,
    altered: false,
    misprint: false,
    miscut: false,
    artistProof: false,
    ...partial,
  };
}

function readFinishes(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.filter((item) => typeof item === 'string');
    } catch {
      return [];
    }
  }
  return [];
}

function finishOf(printing: Printing, prefer: 'foil' | 'nonfoil'): 'foil' | 'nonfoil' {
  if (prefer === 'foil' && printing.finishes.includes('foil')) return 'foil';
  if (printing.finishes.includes('nonfoil')) return 'nonfoil';
  if (printing.finishes.includes('foil')) return 'foil';
  return 'nonfoil';
}

function take(pool: Printing[], start: number, count: number, blocked: Set<string>): Printing[] {
  const picked: Printing[] = [];
  const seen = new Set<string>();
  for (let step = 0; step < pool.length && picked.length < count; step += 1) {
    const card = pool[(start + step) % pool.length];
    if (!card || blocked.has(card.oracleId) || seen.has(card.oracleId)) continue;
    seen.add(card.oracleId);
    picked.push(card);
  }
  return picked;
}

function splitEven<T>(items: T[], parts: number): T[][] {
  const groups: T[][] = Array.from({ length: parts }, () => []);
  items.forEach((item, index) => {
    groups[index % parts]?.push(item);
  });
  return groups;
}

function nextFiller(
  filler: Printing[],
  cursor: { index: number },
  count: number,
  blocked: Set<string>,
): Printing[] {
  const picked: Printing[] = [];
  const seen = new Set<string>();
  while (picked.length < count && cursor.index < filler.length) {
    const card = filler[cursor.index];
    cursor.index += 1;
    if (!card || blocked.has(card.oracleId) || seen.has(card.oracleId)) continue;
    seen.add(card.oracleId);
    picked.push(card);
  }
  if (picked.length < count) {
    throw new Error(
      `Not enough cards in the local table to fill a list of ${CARDS_PER_COLLECTION}. Run pnpm cards:sync.`,
    );
  }
  return picked;
}

export async function runSeed() {
  loadEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Add it to the repo .env file.');
  }
  assertLocalDatabase(connectionString);

  const client = postgres(connectionString, {
    max: 1,
    prepare: false,
    ...postgresSsl(connectionString),
  });
  const db = drizzle(client);

  try {
    const placeIds = await loadPlaces(db);
    const pool = await loadPrintings(db);
    const priceRows = await seedPriceHistory(db, pool);
    const wantChoices = await loadWantChoices(
      db,
      pool.map((card) => card.oracleId),
    );
    const shared = pool.slice(0, SHARED_POOL_SIZE);
    const filler = pool.slice(SHARED_POOL_SIZE);
    const fillerCursor = { index: 0 };
    const russian = await loadRussianPrintings(
      db,
      shared.map((card) => card.oracleId),
    );
    const setCode = pool.find((card) => /^[a-z0-9]{3,10}$/.test(card.setCode))?.setCode ?? 'mh2';
    const mixes = [
      emptyMix({ languages: ['en'], finishes: ['foil'] }),
      emptyMix({ languages: ['ru'], finishes: ['foil'] }),
      emptyMix({ finishes: ['foil'], sets: [setCode] }),
      emptyMix({ conditions: ['NM'] }),
      emptyMix({ artistProof: true }),
      emptyMix({ signed: true }),
    ];

    const userIds = new Map<string, string>();
    for (const person of PEOPLE) {
      const placeId = placeIds.get(person.place);
      if (placeId === undefined) {
        throw new Error(`Missing place id for ${person.place}`);
      }
      userIds.set(person.username, await upsertPerson(db, person, placeId));
    }

    const ids = [...userIds.values()];
    // The seed owns the whole collection of these ten users, groups included.
    await db.delete(groupMemberships).where(inArray(groupMemberships.userId, ids));
    await db.delete(cardGroups).where(inArray(cardGroups.userId, ids));
    await db.delete(collectionValueSnapshots).where(inArray(collectionValueSnapshots.userId, ids));
    await db.delete(collectionItems).where(inArray(collectionItems.userId, ids));
    await db.delete(wantItems).where(inArray(wantItems.userId, ids));
    await db
      .delete(wantLists)
      .where(and(inArray(wantLists.userId, ids), like(wantLists.slug, 'seed-%')));
    await db
      .delete(genericWants)
      .where(and(inArray(genericWants.userId, ids), like(genericWants.matchKey, 'seed|%')));
    await db
      .delete(friendships)
      .where(and(inArray(friendships.userId, ids), inArray(friendships.friendId, ids)));

    const held = new Map<string, Set<string>>();
    const wanted = new Map<string, Set<string>>();
    const stock = new Map<string, StockCard[]>();
    const wantsByUser = new Map<string, Set<string>>();
    let groupCount = 0;
    let copyCount = 0;
    let listCount = 0;
    let wantCount = 0;
    let genericCount = 0;

    for (const [index, person] of PEOPLE.entries()) {
      const userId = userIds.get(person.username);
      if (!userId) continue;

      const groupTotal = index % 2 === 0 ? 3 : 2;
      const listTotal = index % 2 === 0 ? 2 : 3;
      const genericTotal = index % 2 === 0 ? 3 : 2;

      const heldShared = take(shared, index * 10, SHARED_HAVE, new Set());
      const userHeld = new Set(heldShared.map((card) => card.oracleId));
      const wantedShared = take(shared, index * 10 + 100, SHARED_WANT, userHeld);
      const userWanted = new Set(wantedShared.map((card) => card.oracleId));

      const groupSlices = splitEven(heldShared, groupTotal);
      for (const [groupIndex, sharedCards] of groupSlices.entries()) {
        const plan = GROUP_PLANS[groupIndex];
        if (!plan) continue;
        const uniqueCards = nextFiller(
          filler,
          fillerCursor,
          CARDS_PER_COLLECTION - sharedCards.length,
          userHeld,
        );
        for (const card of uniqueCards) userHeld.add(card.oracleId);
        const copies = toCopies([...sharedCards, ...uniqueCards], index, groupIndex, russian);
        const [group] = await db
          .insert(cardGroups)
          .values({
            userId,
            name: plan.name,
            description: plan.description,
          })
          .returning({ id: cardGroups.id });
        if (!group) throw new Error(`Could not create a group for ${person.username}`);

        const inserted = await db
          .insert(collectionItems)
          .values(copies.map((copy) => toCollectionItem(userId, copy)))
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
            set: { quantity: sql`${collectionItems.quantity} + excluded.quantity` },
          })
          .returning({ id: collectionItems.id });

        await db
          .insert(groupMemberships)
          .values(inserted.map((row) => ({ itemId: row.id, groupId: group.id, userId })));
        groupCount += 1;
        copyCount += copies.length;
        const pile = stock.get(person.username) ?? [];
        for (const copy of copies) {
          const owners = held.get(copy.printing.oracleId) ?? new Set<string>();
          owners.add(person.username);
          held.set(copy.printing.oracleId, owners);
          pile.push({
            oracleId: copy.printing.oracleId,
            scryfallId: copy.printing.scryfallId,
          });
        }
        stock.set(person.username, pile);
      }

      const wantSlices = splitEven(wantedShared, listTotal);
      for (const [listIndex, sharedCards] of wantSlices.entries()) {
        const plan = WANT_PLANS[listIndex];
        if (!plan) continue;
        const blocked = new Set([...userHeld, ...userWanted]);
        const uniqueCards = nextFiller(
          filler,
          fillerCursor,
          CARDS_PER_COLLECTION - sharedCards.length,
          blocked,
        );
        for (const card of uniqueCards) userWanted.add(card.oracleId);
        const group = [...sharedCards, ...uniqueCards];
        const [list] = await db
          .insert(wantLists)
          .values({
            userId,
            name: plan.name,
            slug: plan.slug,
            description: 'Seed data for local trade tests.',
            visibility: plan.visibility,
          })
          .returning({ id: wantLists.id });
        if (!list) throw new Error(`Could not create a want list for ${person.username}`);
        await db
          .insert(wantItems)
          .values(
            group.map((card, cardIndex) => {
              const scope = singleChoiceScope(wantChoices.get(card.oracleId));
              return {
                userId,
                oracleId: card.oracleId,
                quantity: 1,
                priority: ((cardIndex % 3) + 1) as 1 | 2 | 3,
                ...scope,
                scopeKey: wantScopeKey(scope),
              };
            }),
          )
          .onConflictDoNothing();
        const stored = await db
          .select({ id: wantItems.id, oracleId: wantItems.oracleId })
          .from(wantItems)
          .where(
            and(
              eq(wantItems.userId, userId),
              inArray(
                wantItems.oracleId,
                group.map((card) => card.oracleId),
              ),
            ),
          );
        const storedByOracle = new Map(stored.map((row) => [row.oracleId, row.id]));
        await db
          .insert(wantListItems)
          .values(
            group.flatMap((card) => {
              const wantId = storedByOracle.get(card.oracleId);
              return wantId ? [{ wantListId: list.id, wantItemId: wantId, userId }] : [];
            }),
          )
          .onConflictDoNothing();
        listCount += 1;
        wantCount += group.length;
        const wish = wantsByUser.get(person.username) ?? new Set<string>();
        for (const card of group) {
          const owners = wanted.get(card.oracleId) ?? new Set<string>();
          owners.add(person.username);
          wanted.set(card.oracleId, owners);
          wish.add(card.oracleId);
        }
        wantsByUser.set(person.username, wish);
      }

      const chosenMixes = Array.from({ length: genericTotal }, (_, offset) => {
        const mix = mixes[(index + offset) % mixes.length];
        if (!mix) throw new Error('Missing generic want mix');
        return mix;
      });
      await db.insert(genericWants).values(
        chosenMixes.map((mix) => ({
          userId,
          languages: [...mix.languages],
          finishes: [...mix.finishes],
          conditions: [...mix.conditions],
          sets: [...mix.sets],
          signed: mix.signed,
          altered: mix.altered,
          misprint: mix.misprint,
          miscut: mix.miscut,
          artistProof: mix.artistProof,
          matchKey: `seed|${genericWantMatchKey(mix)}`,
        })),
      );
      genericCount += chosenMixes.length;
    }

    const markPriceRows = await seedMarkPriceHistory(db, requiredId(userIds, 'mark'));
    const snapshotRows = await seedCollectionSnapshots(db, ids);

    const friendPairs: [string, string][] = [
      ['mark', 'ava_lane'],
      ['ava_lane', 'mark'],
      ['mark', 'jordan_cole'],
      ['jordan_cole', 'mark'],
      ['mark', 'priya_shah'],
      ['priya_shah', 'mark'],
      ['mark', 'sam_ortiz'],
      ['sam_ortiz', 'mark'],
      ['mark', 'nia_brooks'],
      ['mark', 'chris_hale'],
      ['chris_hale', 'mark'],
      ['ava_lane', 'jordan_cole'],
      ['jordan_cole', 'priya_shah'],
      ['priya_shah', 'devon_park'],
      ['devon_park', 'nia_brooks'],
      ['sam_ortiz', 'chris_hale'],
      ['riley_nguyen', 'mark'],
      ['morgan_ellis', 'ava_lane'],
    ];
    await db.insert(friendships).values(
      friendPairs.map(([username, friendName]) => ({
        userId: requiredId(userIds, username),
        friendId: requiredId(userIds, friendName),
      })),
    );

    await db
      .delete(trades)
      .where(and(inArray(trades.proposerId, ids), inArray(trades.receiverId, ids)));
    const tradeCount = await seedTrades(db, userIds, stock, wantsByUser);

    let sharedWants = 0;
    for (const [oracleId, wanters] of wanted) {
      const owners = held.get(oracleId);
      if (!owners) continue;
      for (const username of wanters) {
        const someoneElseHasIt = [...owners].some((owner) => owner !== username);
        if (someoneElseHasIt) sharedWants += 1;
      }
    }

    console.log(`Seeded ${PEOPLE.length} users.`);
    console.log('Mark is in Atlanta, Georgia, United States.');
    console.log(
      `${groupCount} groups, ${copyCount} copies, ${listCount} want lists, ${wantCount} wants, ${genericCount} generic wants.`,
    );
    console.log(`Each group and each want list has ${CARDS_PER_COLLECTION} cards.`);
    console.log(`${sharedWants} wants are cards another seeded user already has for trade.`);
    console.log(`${friendPairs.length} friend links between these users.`);
    console.log(`${tradeCount} trades between these users.`);
    console.log(`${priceRows.toLocaleString()} price change points for the seeded cards.`);
    console.log(`${markPriceRows.toLocaleString()} price points across the year for Mark's cards.`);
    console.log(`${snapshotRows.toLocaleString()} collection value snapshots.`);
  } finally {
    await client.end();
  }
}

/** History keeps only change days, so one row per seeded card gives a flat line; the other 500k+ printings stay untouched. */
async function seedPriceHistory(
  db: ReturnType<typeof drizzle>,
  printings: Printing[],
): Promise<number> {
  if (printings.length === 0) return 0;

  // The monthly partitions must exist before any row can land in them.
  const now = Date.now();
  await ensurePricePartitions(
    db,
    new Date(now - 400 * 86_400_000).toISOString().slice(0, 10),
    new Date(now).toISOString().slice(0, 10),
  );

  const ids = printings.map((printing) => printing.scryfallId);
  const inList = () =>
    sql.join(
      ids.map((id) => sql`${id}::uuid`),
      sql`, `,
    );

  // Replace what an earlier seed wrote, so the pool follows the current rule.
  await db.execute(sql`DELETE FROM card_price_history WHERE scryfall_id IN (${inList()})`);

  const result = await db.execute(sql`
    INSERT INTO card_price_history (
      scryfall_id, recorded_on, usd, usd_foil, usd_etched, eur, eur_foil, tix
    )
    SELECT
      c.scryfall_id,
      GREATEST(
        CASE WHEN c.released_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN c.released_at::date END,
        CURRENT_DATE - INTERVAL '1 year'
      )::date,
      NULLIF(c.prices->>'usd', '')::numeric,
      NULLIF(c.prices->>'usd_foil', '')::numeric,
      NULLIF(c.prices->>'usd_etched', '')::numeric,
      NULLIF(c.prices->>'eur', '')::numeric,
      NULLIF(c.prices->>'eur_foil', '')::numeric,
      NULLIF(c.prices->>'tix', '')::numeric
    FROM cards c
    WHERE c.scryfall_id IN (${inList()})
      AND c.prices IS NOT NULL
      AND GREATEST(
        CASE WHEN c.released_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN c.released_at::date END,
        CURRENT_DATE - INTERVAL '1 year'
      ) <= CURRENT_DATE
    ON CONFLICT (scryfall_id, recorded_on) DO UPDATE SET
      usd = excluded.usd,
      usd_foil = excluded.usd_foil,
      usd_etched = excluded.usd_etched,
      eur = excluded.eur,
      eur_foil = excluded.eur_foil,
      tix = excluded.tix
  `);

  return Number((result as unknown as { count?: number }).count ?? 0);
}

/** A deterministic 0..1 value for a string, so every reseed draws the same line. */
function hashUnit(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Steps of `days` from `start`; always includes `end`. */
function everyFewDays(start: Date, end: Date, days: number): Date[] {
  const step = days * 86_400_000;
  const points: Date[] = [];
  for (let cursor = start.getTime(); cursor < end.getTime(); cursor += step) {
    points.push(new Date(cursor));
  }
  points.push(end);
  return points;
}

function parseDay(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function priceAt(value: string | null | undefined, factor: number): string | null {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return (amount * factor).toFixed(2);
}

/** Gentle upward trend with a sine wiggle, so dev charts move without inventing real history. */
async function seedCollectionSnapshots(
  db: ReturnType<typeof drizzle>,
  userIds: string[],
): Promise<number> {
  const current = await currentCollectionValues(db, userIds);
  if (current.length === 0) return 0;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const rows: { userId: string; day: string; value: string }[] = [];

  for (const { userId, value } of current) {
    for (let offset = SNAPSHOT_DAYS; offset >= 1; offset--) {
      const day = new Date(today);
      day.setUTCDate(day.getUTCDate() - offset);
      const step = SNAPSHOT_DAYS - offset;
      const trend = 0.85 + 0.15 * (step / (SNAPSHOT_DAYS - 1));
      const wiggle = 1 + 0.02 * Math.sin(step / 11);
      rows.push({
        userId,
        day: day.toISOString().slice(0, 10),
        value: (value * trend * wiggle).toFixed(2),
      });
    }
  }

  for (let index = 0; index < rows.length; index += 500) {
    await db
      .insert(collectionValueSnapshots)
      .values(rows.slice(index, index + 500))
      .onConflictDoNothing();
  }

  return rows.length;
}

/** Each seeded user's current asking value, with the same rules the app uses. */
async function currentCollectionValues(
  db: ReturnType<typeof drizzle>,
  userIds: string[],
): Promise<{ userId: string; value: number }[]> {
  const idList = sql.join(
    userIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
  const rows = (await db.execute(sql`
    WITH priced AS (
      SELECT
        ci.user_id AS "userId",
        ci.quantity,
        ci.price_kind,
        ci.price_percent,
        ci.price_amount,
        COALESCE(
          CASE ci.finish::text
            WHEN 'foil' THEN NULLIF(c.prices->>'usd_foil', '')::numeric
            WHEN 'etched' THEN NULLIF(c.prices->>'usd_etched', '')::numeric
            ELSE NULLIF(c.prices->>'usd', '')::numeric
          END,
          CASE ci.finish::text
            WHEN 'foil' THEN NULLIF(e.prices->>'usd_foil', '')::numeric
            WHEN 'etched' THEN NULLIF(e.prices->>'usd_etched', '')::numeric
            ELSE NULLIF(e.prices->>'usd', '')::numeric
          END
        ) AS market
      FROM collection_items ci
      INNER JOIN cards c ON c.scryfall_id = ci.scryfall_id
      LEFT JOIN cards e
        ON e.set_code = c.set_code
        AND e.collector_number = c.collector_number
        AND e.lang = 'en'
        AND jsonb_exists(e.raw->'games', 'paper')
        AND e.layout IS DISTINCT FROM 'art_series'
      WHERE ci.user_id IN (${idList})
    )
    SELECT
      "userId",
      ROUND(
        COALESCE(
          SUM(
            CASE price_kind::text
              WHEN 'custom' THEN COALESCE(NULLIF(price_amount, '')::numeric, 0)
              WHEN 'percent' THEN ROUND(market * price_percent / 100.0, 2)
              ELSE market
            END * quantity
          ),
          0
        ),
        2
      )::text AS value
    FROM priced
    GROUP BY "userId"
  `)) as unknown as { userId: string; value: string }[];

  return rows.map((row) => ({ userId: row.userId, value: Number(row.value) }));
}

/** Mark's cards move every two weeks on a wave plus deterministic wobble, tapered onto the real price. */
async function seedMarkPriceHistory(
  db: ReturnType<typeof drizzle>,
  markUserId: string,
): Promise<number> {
  const rows = (await db.execute(sql`
    SELECT DISTINCT
      c.scryfall_id AS "scryfallId",
      c.released_at AS "releasedAt",
      c.prices
    FROM collection_items bi
    JOIN cards c ON c.scryfall_id = bi.scryfall_id
    WHERE bi.user_id = ${markUserId}::uuid
      AND c.prices IS NOT NULL
  `)) as unknown as {
    scryfallId: string;
    releasedAt: string | null;
    prices: Record<string, string | null>;
  }[];

  if (rows.length === 0) return 0;

  // Replace the single flat point the pool pass wrote for these cards.
  await db.execute(sql`
    DELETE FROM card_price_history
    WHERE scryfall_id IN (
      SELECT scryfall_id FROM collection_items WHERE user_id = ${markUserId}::uuid
    )
  `);

  const today = new Date(`${isoDay(new Date())}T00:00:00Z`);
  const yearAgo = new Date(today.getTime() - 364 * 86_400_000);

  const batch: NewCardPriceHistoryRow[] = [];
  for (const card of rows) {
    const released = parseDay(card.releasedAt);
    const start = released && released > yearAgo ? released : yearAgo;
    const days = everyFewDays(start, today, 14);
    const phase = hashUnit(`${card.scryfallId}:phase`) * Math.PI * 2;

    days.forEach((day, step) => {
      // Fade movement out over the last four points so the line lands on the current price.
      const left = days.length - 1 - step;
      const taper = Math.min(1, left / 4);
      const wave = Math.sin(step * 0.55 + phase) * 0.2;
      const wobble = (hashUnit(`${card.scryfallId}:${isoDay(day)}`) * 2 - 1) * 0.1;
      const factor = 1 + taper * (wave + wobble);

      batch.push({
        scryfallId: card.scryfallId,
        recordedOn: isoDay(day),
        usd: priceAt(card.prices.usd, factor),
        usdFoil: priceAt(card.prices.usd_foil, factor),
        usdEtched: priceAt(card.prices.usd_etched, factor),
        eur: priceAt(card.prices.eur, factor),
        eurFoil: priceAt(card.prices.eur_foil, factor),
        tix: priceAt(card.prices.tix, factor),
      });
    });
  }

  for (let index = 0; index < batch.length; index += 500) {
    await db.insert(cardPriceHistory).values(batch.slice(index, index + 500));
  }

  return batch.length;
}

async function loadPlaces(db: ReturnType<typeof drizzle>): Promise<Map<string, number>> {
  const labels = [...new Set(PEOPLE.map((person) => person.place))];
  const rows = await db
    .select({ id: places.geonameId, label: places.label })
    .from(places)
    .where(inArray(places.label, labels));
  const found = new Map(rows.map((row) => [row.label, row.id]));
  const missing = labels.filter((label) => !found.has(label));
  if (missing.length > 0) {
    throw new Error(
      `These cities are not in the places table: ${missing.join(', ')}. Run pnpm places:sync.`,
    );
  }
  return found;
}

async function loadPrintings(db: ReturnType<typeof drizzle>): Promise<Printing[]> {
  const rows = (await db.execute(sql`
    SELECT DISTINCT ON (${cards.oracleId})
      ${cards.name} AS name,
      ${cards.oracleId} AS "oracleId",
      ${cards.scryfallId} AS "scryfallId",
      ${cards.setCode} AS "setCode",
      ${cards.finishes} AS finishes
    FROM ${cards}
    WHERE ${cards.lang} = 'en'
      AND ${cards.layout} IS NOT NULL
      AND ${cards.layout} NOT IN (${sql.join(
        SKIPPED_LAYOUTS.map((layout) => sql`${layout}`),
        sql`, `,
      )})
    ORDER BY ${cards.oracleId}, ${cards.releasedAt} DESC NULLS LAST, ${cards.scryfallId}
    LIMIT ${POOL_SIZE}
  `)) as unknown as {
    name: string;
    oracleId: string;
    scryfallId: string;
    setCode: string;
    finishes: unknown;
  }[];

  const pool = rows
    .filter((row) => row.name && row.oracleId && row.scryfallId)
    .map((row) => ({
      name: row.name,
      oracleId: row.oracleId,
      scryfallId: row.scryfallId,
      setCode: row.setCode.toLowerCase(),
      finishes: readFinishes(row.finishes),
    }));

  if (pool.length < POOL_SIZE) {
    throw new Error(
      `The local card table only has ${pool.length} English cards. Run pnpm cards:sync.`,
    );
  }
  return pool;
}

async function loadWantChoices(
  db: ReturnType<typeof drizzle>,
  oracleIds: string[],
): Promise<Map<string, WantChoices>> {
  const unique = [...new Set(oracleIds)];
  const byOracle = new Map<string, WantChoices>();
  for (let start = 0; start < unique.length; start += 1000) {
    const chunk = unique.slice(start, start + 1000);
    const rows = (await db.execute(sql`
      SELECT
        ${cards.oracleId} AS "oracleId",
        ${cards.lang} AS lang,
        ${cards.finishes} AS finishes,
        ${cards.setCode} AS "setCode"
      FROM ${cards}
      WHERE ${cards.oracleId} IN (${sql.join(
        chunk.map((id) => sql`${id}`),
        sql`, `,
      )})
        AND jsonb_exists(${cards.raw}->'games', 'paper')
        AND ${cards.layout} IS DISTINCT FROM 'art_series'
    `)) as unknown as {
      oracleId: string;
      lang: string;
      finishes: unknown;
      setCode: string;
    }[];

    for (const row of rows) {
      const choices = byOracle.get(row.oracleId) ?? {
        languages: new Set<string>(),
        finishes: new Set<string>(),
        sets: new Set<string>(),
      };
      choices.languages.add(cardLanguageOrEnglish(row.lang));
      for (const finish of readFinishes(row.finishes)) choices.finishes.add(finish);
      choices.sets.add(row.setCode.toLowerCase());
      byOracle.set(row.oracleId, choices);
    }
  }
  return byOracle;
}

/** A list that has one choice is stored as that choice, not as "any". */
function singleChoiceScope(choices: WantChoices | undefined) {
  return {
    wantedLanguages: choices?.languages.size === 1 ? [...choices.languages] : [],
    wantedFinishes: choices?.finishes.size === 1 ? [...choices.finishes] : [],
    wantedConditions: [],
    wantedSets: choices?.sets.size === 1 ? [...choices.sets] : [],
  };
}

function toCopies(
  printings: Printing[],
  personIndex: number,
  groupIndex: number,
  russian: Map<string, { scryfallId: string; finishes: string[] }>,
): OwnedCopy[] {
  const prefer = groupIndex === 1 ? 'foil' : 'nonfoil';
  return printings.map((printing, copyIndex) => {
    const russianPrinting = russian.get(printing.oracleId);
    const chosen =
      groupIndex === 1 && personIndex % 3 === 0 && copyIndex < 2 && russianPrinting
        ? {
            ...printing,
            scryfallId: russianPrinting.scryfallId,
            finishes: russianPrinting.finishes,
            language: 'ru',
          }
        : { ...printing, language: 'en' };
    return {
      printing: chosen,
      finish: finishOf(chosen, prefer),
      language: chosen.language,
      condition: copyIndex % 17 === 0 ? 'LP' : 'NM',
      signed: groupIndex === 1 && personIndex % 4 === 1 && copyIndex === 0,
      artistProof: groupIndex === 1 && personIndex % 4 === 2 && copyIndex === 0,
      quantity: 1,
    };
  });
}

async function loadRussianPrintings(
  db: ReturnType<typeof drizzle>,
  oracleIds: string[],
): Promise<Map<string, { scryfallId: string; finishes: string[] }>> {
  if (oracleIds.length === 0) return new Map();
  const rows = (await db.execute(sql`
    SELECT DISTINCT ON (${cards.oracleId})
      ${cards.oracleId} AS "oracleId",
      ${cards.scryfallId} AS "scryfallId",
      ${cards.finishes} AS finishes
    FROM ${cards}
    WHERE ${cards.oracleId} IN (${sql.join(
      oracleIds.map((id) => sql`${id}`),
      sql`, `,
    )})
      AND ${cards.lang} = 'ru'
      AND ${cards.layout} IS DISTINCT FROM 'art_series'
    ORDER BY ${cards.oracleId}, ${cards.releasedAt} DESC NULLS LAST
  `)) as unknown as { oracleId: string; scryfallId: string; finishes: unknown }[];

  return new Map(
    rows
      .filter((row) => row.oracleId && row.scryfallId)
      .map((row) => [
        row.oracleId,
        { scryfallId: row.scryfallId, finishes: readFinishes(row.finishes) },
      ]),
  );
}

async function upsertPerson(
  db: ReturnType<typeof drizzle>,
  person: Person,
  placeId: number,
): Promise<string> {
  const bySub = await db.select().from(users).where(eq(users.auth0Sub, person.auth0Sub)).limit(1);
  const byName = await db.select().from(users).where(eq(users.username, person.username)).limit(1);
  const subRow = bySub[0];
  const nameRow = byName[0];
  if (subRow && nameRow && subRow.id !== nameRow.id) {
    throw new Error(
      `${person.username} and ${person.auth0Sub} already belong to two different users.`,
    );
  }
  const existing = subRow ?? nameRow;
  if (existing && person.auth0Sub.startsWith('seed|') && !existing.auth0Sub.startsWith('seed|')) {
    throw new Error(`${person.username} already belongs to a signed-in account.`);
  }

  const patch = {
    auth0Sub: person.auth0Sub,
    username: person.username,
    placeId,
    profileVisibility: person.visibility,
    tradeBinderVisibility: person.visibility,
    bio: person.bio,
    onboardedAt: existing?.onboardedAt ?? new Date(),
    updatedAt: new Date(),
  };
  if (existing) {
    await db.update(users).set(patch).where(eq(users.id, existing.id));
    return existing.id;
  }

  const [created] = await db
    .insert(users)
    .values({
      ...patch,
      email: person.auth0Sub.startsWith('seed|') ? `${person.username}@seed.opulent.local` : null,
    })
    .returning({ id: users.id });
  if (!created) throw new Error(`Could not create ${person.username}`);
  return created.id;
}

function toCollectionItem(userId: string, copy: OwnedCopy) {
  return {
    userId,
    scryfallId: copy.printing.scryfallId,
    quantity: copy.quantity,
    finish: copy.finish,
    condition: copy.condition,
    language: copy.language,
    signed: copy.signed,
    altered: false,
    misprint: false,
    miscut: false,
    artistProof: copy.artistProof,
    forTrade: true,
    priceKind: 'market' as const,
    pricePercent: 100,
    priceAmount: '',
  };
}

type SeedTrade = {
  proposer: string;
  receiver: string;
  status: 'draft' | 'proposed' | 'countered' | 'accepted' | 'completed' | 'cancelled';
  turn: string;
  receive: number;
  give: number;
  proposerFinalized?: boolean;
  receiverFinalized?: boolean;
};

/** One of each trade state Mark can open, plus a couple between the other users. */
const TRADE_PLANS: SeedTrade[] = [
  { proposer: 'mark', receiver: 'ava_lane', status: 'draft', turn: 'mark', receive: 3, give: 0 },
  {
    proposer: 'jordan_cole',
    receiver: 'mark',
    status: 'proposed',
    turn: 'mark',
    receive: 3,
    give: 2,
  },
  {
    proposer: 'mark',
    receiver: 'priya_shah',
    status: 'proposed',
    turn: 'priya_shah',
    receive: 3,
    give: 2,
  },
  {
    proposer: 'sam_ortiz',
    receiver: 'mark',
    status: 'accepted',
    turn: 'mark',
    receive: 2,
    give: 2,
    proposerFinalized: true,
  },
  {
    proposer: 'mark',
    receiver: 'chris_hale',
    status: 'accepted',
    turn: 'chris_hale',
    receive: 2,
    give: 2,
    proposerFinalized: true,
  },
  {
    proposer: 'mark',
    receiver: 'devon_park',
    status: 'completed',
    turn: 'devon_park',
    receive: 2,
    give: 2,
    proposerFinalized: true,
    receiverFinalized: true,
  },
  {
    proposer: 'riley_nguyen',
    receiver: 'mark',
    status: 'cancelled',
    turn: 'mark',
    receive: 2,
    give: 1,
  },
  {
    proposer: 'nia_brooks',
    receiver: 'mark',
    status: 'countered',
    turn: 'mark',
    receive: 2,
    give: 2,
  },
  {
    proposer: 'morgan_ellis',
    receiver: 'ava_lane',
    status: 'draft',
    turn: 'morgan_ellis',
    receive: 2,
    give: 0,
  },
  {
    proposer: 'jordan_cole',
    receiver: 'priya_shah',
    status: 'proposed',
    turn: 'priya_shah',
    receive: 2,
    give: 2,
  },
];

async function seedTrades(
  db: ReturnType<typeof drizzle>,
  userIds: Map<string, string>,
  stock: Map<string, StockCard[]>,
  wantsByUser: Map<string, Set<string>>,
): Promise<number> {
  const now = Date.now();
  for (const [index, plan] of TRADE_PLANS.entries()) {
    const requested = pickCards(stock, wantsByUser, plan.receiver, plan.proposer, plan.receive);
    const offered = pickCards(stock, wantsByUser, plan.proposer, plan.receiver, plan.give);
    const [trade] = await db
      .insert(trades)
      .values({
        proposerId: requiredId(userIds, plan.proposer),
        receiverId: requiredId(userIds, plan.receiver),
        turnUserId: requiredId(userIds, plan.turn),
        status: plan.status,
        proposerFinalizedAt: plan.proposerFinalized ? new Date(now) : null,
        receiverFinalizedAt: plan.receiverFinalized ? new Date(now) : null,
        updatedAt: new Date(now - index * 60_000),
      })
      .returning({ id: trades.id });
    if (!trade) throw new Error(`Could not create the trade for ${plan.proposer}`);
    const lines = [
      ...requested.map((scryfallId) => ({
        tradeId: trade.id,
        side: 'requested' as const,
        scryfallId,
        quantity: 1,
      })),
      ...offered.map((scryfallId) => ({
        tradeId: trade.id,
        side: 'offered' as const,
        scryfallId,
        quantity: 1,
      })),
    ];
    if (lines.length > 0) await db.insert(tradeItems).values(lines);
  }
  return TRADE_PLANS.length;
}

/** Holder's trade stock, with cards the wanter already wants first. */
function pickCards(
  stock: Map<string, StockCard[]>,
  wantsByUser: Map<string, Set<string>>,
  holder: string,
  wanter: string,
  limit: number,
): string[] {
  if (limit <= 0) return [];
  const wish = wantsByUser.get(wanter) ?? new Set<string>();
  const cards = stock.get(holder) ?? [];
  const ordered = [
    ...cards.filter((card) => wish.has(card.oracleId)),
    ...cards.filter((card) => !wish.has(card.oracleId)),
  ];
  const chosen: string[] = [];
  const seen = new Set<string>();
  for (const card of ordered) {
    if (seen.has(card.scryfallId)) continue;
    seen.add(card.scryfallId);
    chosen.push(card.scryfallId);
    if (chosen.length === limit) break;
  }
  if (chosen.length < limit) {
    throw new Error(`${holder} does not have ${limit} cards for a seed trade.`);
  }
  return chosen;
}

function requiredId(userIds: Map<string, string>, username: string): string {
  const id = userIds.get(username);
  if (!id) throw new Error(`Missing seeded user ${username}`);
  return id;
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  runSeed().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}

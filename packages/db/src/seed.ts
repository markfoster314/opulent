import { pathToFileURL } from 'node:url';
import { genericWantMatchKey, type CreateGenericWantInput } from '@opulent/shared';
import { and, eq, inArray, like, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { loadEnv } from './load-env';
import {
  binders,
  binderItems,
  cards,
  friendships,
  genericWants,
  places,
  users,
  wantItems,
  wantLists,
} from './schema';

/**
 * Dev data for local trade tests.
 *
 * Looks up real cities and real card printings already in the database.
 * Each binder and each want list gets 100 cards. Part of each list is shared
 * across these users. The rest of each list is unique.
 * Safe to run again. It replaces seed binders, seed want lists, seed generic
 * wants, and friendships between these ten users. It leaves every other row alone.
 *
 *   pnpm db:seed
 */

/** Each binder and each want list gets this many cards. */
const CARDS_PER_COLLECTION = 100;

/** Cards many people both own and want. The rest of each list is unique. */
const SHARED_POOL_SIZE = 240;
const SHARED_HAVE = 80;
const SHARED_WANT = 80;

/** One English printing per card, enough for the shared pool plus unique fillers. */
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
};

const PEOPLE: Person[] = [
  {
    username: 'mark',
    auth0Sub: 'auth0|6ad52793a07a8bf37e40baf6',
    place: 'Atlanta, Georgia, United States',
    visibility: 'public',
  },
  {
    username: 'ava_lane',
    auth0Sub: 'seed|ava_lane',
    place: 'Atlanta, Georgia, United States',
    visibility: 'public',
  },
  {
    username: 'jordan_cole',
    auth0Sub: 'seed|jordan_cole',
    place: 'Atlanta, Georgia, United States',
    visibility: 'public',
  },
  {
    username: 'priya_shah',
    auth0Sub: 'seed|priya_shah',
    place: 'Atlanta, Georgia, United States',
    visibility: 'public',
  },
  {
    username: 'sam_ortiz',
    auth0Sub: 'seed|sam_ortiz',
    place: 'Atlanta, Georgia, United States',
    visibility: 'public',
  },
  {
    username: 'nia_brooks',
    auth0Sub: 'seed|nia_brooks',
    place: 'Atlanta, Georgia, United States',
    visibility: 'private',
  },
  {
    username: 'chris_hale',
    auth0Sub: 'seed|chris_hale',
    place: 'Marietta, Georgia, United States',
    visibility: 'public',
  },
  {
    username: 'devon_park',
    auth0Sub: 'seed|devon_park',
    place: 'Decatur, Georgia, United States',
    visibility: 'public',
  },
  {
    username: 'riley_nguyen',
    auth0Sub: 'seed|riley_nguyen',
    place: 'Chicago, Illinois, United States',
    visibility: 'public',
  },
  {
    username: 'morgan_ellis',
    auth0Sub: 'seed|morgan_ellis',
    place: 'Seattle, Washington, United States',
    visibility: 'public',
  },
];

const BINDER_SLUGS = ['seed-trade-staples', 'seed-foil-box', 'seed-extra-copies'] as const;
const WANT_SLUGS = ['seed-staples-i-need', 'seed-commander-upgrades', 'seed-specs'] as const;

const BINDER_PLANS = [
  { name: 'Trade staples', slug: BINDER_SLUGS[0], visibility: 'public' as const },
  { name: 'Foil box', slug: BINDER_SLUGS[1], visibility: 'unlisted' as const },
  { name: 'Extra copies', slug: BINDER_SLUGS[2], visibility: 'private' as const },
];

const WANT_PLANS = [
  { name: 'Staples I need', slug: WANT_SLUGS[0], visibility: 'public' as const },
  { name: 'Commander upgrades', slug: WANT_SLUGS[1], visibility: 'private' as const },
  { name: 'Specs', slug: WANT_SLUGS[2], visibility: 'unlisted' as const },
];

type Printing = {
  name: string;
  oracleId: string;
  scryfallId: string;
  setCode: string;
  finishes: string[];
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

  const client = postgres(connectionString, { max: 1, prepare: false });
  const db = drizzle(client);

  try {
    const placeIds = await loadPlaces(db);
    const pool = await loadPrintings(db);
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
    await db.delete(binders).where(and(inArray(binders.userId, ids), like(binders.slug, 'seed-%')));
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
    let binderCount = 0;
    let copyCount = 0;
    let listCount = 0;
    let wantCount = 0;
    let genericCount = 0;

    for (const [index, person] of PEOPLE.entries()) {
      const userId = userIds.get(person.username);
      if (!userId) continue;

      const binderTotal = index % 2 === 0 ? 3 : 2;
      const listTotal = index % 2 === 0 ? 2 : 3;
      const genericTotal = index % 2 === 0 ? 3 : 2;

      const heldShared = take(shared, index * 10, SHARED_HAVE, new Set());
      const userHeld = new Set(heldShared.map((card) => card.oracleId));
      const wantedShared = take(shared, index * 10 + 100, SHARED_WANT, userHeld);
      const userWanted = new Set(wantedShared.map((card) => card.oracleId));

      const binderSlices = splitEven(heldShared, binderTotal);
      for (const [binderIndex, sharedCards] of binderSlices.entries()) {
        const plan = BINDER_PLANS[binderIndex];
        if (!plan) continue;
        const uniqueCards = nextFiller(
          filler,
          fillerCursor,
          CARDS_PER_COLLECTION - sharedCards.length,
          userHeld,
        );
        for (const card of uniqueCards) userHeld.add(card.oracleId);
        const copies = toCopies([...sharedCards, ...uniqueCards], index, binderIndex, russian);
        const [binder] = await db
          .insert(binders)
          .values({
            userId,
            name: plan.name,
            slug: plan.slug,
            description: 'Seed data for local trade tests.',
            visibility: plan.visibility,
          })
          .returning({ id: binders.id });
        if (!binder) throw new Error(`Could not create a binder for ${person.username}`);
        await db.insert(binderItems).values(copies.map((copy) => toBinderItem(binder.id, copy)));
        binderCount += 1;
        copyCount += copies.length;
        for (const copy of copies) {
          const owners = held.get(copy.printing.oracleId) ?? new Set<string>();
          owners.add(person.username);
          held.set(copy.printing.oracleId, owners);
        }
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
        await db.insert(wantItems).values(
          group.map((card, cardIndex) => ({
            userId,
            wantListId: list.id,
            oracleId: card.oracleId,
            quantity: 1,
            priority: ((cardIndex % 3) + 1) as 1 | 2 | 3,
          })),
        );
        listCount += 1;
        wantCount += group.length;
        for (const card of group) {
          const owners = wanted.get(card.oracleId) ?? new Set<string>();
          owners.add(person.username);
          wanted.set(card.oracleId, owners);
        }
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
      `${binderCount} binders, ${copyCount} copies, ${listCount} want lists, ${wantCount} wants, ${genericCount} generic wants.`,
    );
    console.log(`Each binder and each want list has ${CARDS_PER_COLLECTION} cards.`);
    console.log(`${sharedWants} wants are cards another seeded user already has for trade.`);
    console.log(`${friendPairs.length} friend links between these users.`);
  } finally {
    await client.end();
  }
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

function toCopies(
  printings: Printing[],
  personIndex: number,
  binderIndex: number,
  russian: Map<string, { scryfallId: string; finishes: string[] }>,
): OwnedCopy[] {
  const prefer = binderIndex === 1 ? 'foil' : 'nonfoil';
  return printings.map((printing, copyIndex) => {
    const russianPrinting = russian.get(printing.oracleId);
    const chosen =
      binderIndex === 1 && personIndex % 3 === 0 && copyIndex < 2 && russianPrinting
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
      signed: binderIndex === 1 && personIndex % 4 === 1 && copyIndex === 0,
      artistProof: binderIndex === 1 && personIndex % 4 === 2 && copyIndex === 0,
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

function toBinderItem(binderId: string, copy: OwnedCopy) {
  return {
    binderId,
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

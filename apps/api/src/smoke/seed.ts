import { cards, places, users, wantItems } from '@opulent/db';
import type { Database } from '@opulent/db';
import { eq, inArray, sql } from 'drizzle-orm';
import {
  ARENA_ORACLE_ID,
  ART_ORACLE_ID,
  AUSTIN_ID,
  NYC_ID,
  ORACLE_ID,
  PRINTING_A,
  PRINTING_A_JA,
  PRINTING_ARENA,
  PRINTING_ART,
  PRINTING_B,
  PRINTING_C,
  type SmokeWorld,
} from './harness';

/** Wipe leftover smoke rows, then insert the cities, cards, and two users. */
export async function seedSmoke(db: Database, stamp: string): Promise<SmokeWorld> {
  await db.delete(users).where(sql`${users.auth0Sub} LIKE ${'smoke|%'}`);
  await db.delete(places).where(inArray(places.geonameId, [AUSTIN_ID, NYC_ID]));

  // Two cities a continent apart, so a short radius and a long one disagree.
  await db.insert(places).values([
    {
      geonameId: AUSTIN_ID,
      name: 'Austin',
      asciiName: 'Austin',
      countryCode: 'US',
      countryName: 'United States',
      admin1Code: 'TX',
      admin1Name: 'Texas',
      label: 'Austin, Texas, United States',
      population: 1_000_000,
      latitude: 30.2672,
      longitude: -97.7431,
    },
    {
      geonameId: NYC_ID,
      name: 'New York',
      asciiName: 'New York',
      countryCode: 'US',
      countryName: 'United States',
      admin1Code: 'NY',
      admin1Name: 'New York',
      label: 'New York, New York, United States',
      population: 8_000_000,
      latitude: 40.7128,
      longitude: -74.006,
    },
  ]);

  // Two printings of one card concept, so the oracle/printing split is under test.
  await db.insert(cards).values([
    {
      scryfallId: PRINTING_A,
      oracleId: ORACLE_ID,
      name: 'Smoke Test Bolt',
      setCode: 'zzz',
      setName: 'Smoke Set Alpha',
      collectorNumber: '1',
      lang: 'en',
      releasedAt: '2024-01-01',
      // Unknown finish values must drop out; Scryfall can add new ones.
      finishes: ['nonfoil', 'foil', 'not_a_real_finish'],
      prices: { usd: '1.50', usd_foil: '12.00' },
      raw: { games: ['paper'] },
    },
    {
      scryfallId: PRINTING_A_JA,
      oracleId: ORACLE_ID,
      name: 'Smoke Test Bolt',
      setCode: 'zzz',
      setName: 'Smoke Set Alpha',
      collectorNumber: '1',
      lang: 'ja',
      releasedAt: '2024-01-01',
      raw: { games: ['paper'] },
    },
    {
      scryfallId: PRINTING_B,
      oracleId: ORACLE_ID,
      name: 'Smoke Test Bolt',
      setCode: 'zzy',
      setName: 'Smoke Set Beta',
      collectorNumber: '2',
      lang: 'en',
      releasedAt: '2023-01-01',
      raw: { games: ['paper'] },
    },
    // Newest, but non-English; the picker must still sort it last.
    {
      scryfallId: PRINTING_C,
      oracleId: ORACLE_ID,
      name: 'Smoke Test Bolt',
      setCode: 'zzx',
      setName: 'Smoke Set Gamma',
      collectorNumber: '3',
      lang: 'ja',
      releasedAt: '2025-01-01',
      raw: { games: ['paper'] },
    },
    {
      scryfallId: PRINTING_ARENA,
      oracleId: ARENA_ORACLE_ID,
      name: 'Smoke Arena Mythic',
      setCode: 'zzn',
      setName: 'Smoke Set Arena',
      collectorNumber: '4',
      lang: 'en',
      releasedAt: '2026-01-01',
      raw: { games: ['arena'] },
    },
    {
      scryfallId: PRINTING_ART,
      oracleId: ART_ORACLE_ID,
      name: 'Smoke Test Bolt // Smoke Test Bolt',
      setCode: 'zza',
      setName: 'Smoke Art Series',
      collectorNumber: '5',
      lang: 'en',
      layout: 'art_series',
      releasedAt: '2024-06-01',
      raw: { games: ['paper'] },
    },
  ]);

  const [owner] = await db
    .insert(users)
    .values({
      auth0Sub: `smoke|owner|${stamp}`,
      username: `smoke_owner_${stamp}`,
    })
    .returning();
  const [viewer] = await db
    .insert(users)
    .values({
      auth0Sub: `smoke|viewer|${stamp}`,
      username: `smoke_viewer_${stamp}`,
    })
    .returning();
  if (!owner || !viewer) throw new Error('user insert returned nothing');

  return { db, stamp, owner, viewer };
}

export async function cleanupSmoke(db: Database): Promise<void> {
  await db.delete(wantItems).where(eq(wantItems.oracleId, ORACLE_ID));
  await db.delete(users).where(sql`${users.auth0Sub} LIKE ${'smoke|%'}`);
  await db.delete(places).where(inArray(places.geonameId, [AUSTIN_ID, NYC_ID]));
  await db
    .delete(cards)
    .where(inArray(cards.oracleId, [ORACLE_ID, ARENA_ORACLE_ID, ART_ORACLE_ID]));
}

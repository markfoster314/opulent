import { binderItems, binders, cards, createDatabase, places, users, wantItems } from '@opulent/db';
import { loadEnv } from '@opulent/db/env';
import { formatUsd, priceForFinish } from '@opulent/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  addBinderItem,
  assertCanView,
  findTradeMatches,
  getBinderById,
  listBinderItems,
  rotateShareToken,
  toBinderResponse,
  updateBinder,
  updateBinderItem,
} from './modules/binders/service';
import { getPrintingsByOracleId, searchCards } from './modules/cards/service';
import { searchPlaces } from './modules/places/service';
import {
  checkUsernameAvailability,
  completeOnboarding,
  findUsersWithinRadius,
  updateProfile,
} from './modules/users/service';

loadEnv();

/**
 * Exercises the real service functions against a real database, then removes
 * everything it created.
 *
 * This exists because typechecking proves the SQL compiles, not that it runs.
 * The match query in particular joins three tables through two different kinds
 * of card identifier, which is the easiest thing in this schema to get wrong.
 *
 * Run against a local database only.
 */

// Fixed fake identifiers, so a failed run leaves nothing hard to find.
const ORACLE_ID = '00000000-0000-4000-8000-00000000f00d';
const PRINTING_A = '00000000-0000-4000-8000-0000000000a1';
const PRINTING_B = '00000000-0000-4000-8000-0000000000a2';
const PRINTING_C = '00000000-0000-4000-8000-0000000000a3';

// Fake GeoNames ids, far above any real one, so cleanup cannot touch a real city.
const AUSTIN_ID = 2_000_000_001;
const NYC_ID = 2_000_000_002;

function check(label: string, condition: boolean, detail?: string): void {
  if (!condition) throw new Error(`${label} failed${detail ? `: ${detail}` : ''}`);
  console.log(`ok   ${label}`);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const db = createDatabase({ connectionString, maxConnections: 2 });
  const stamp = Date.now().toString().slice(-9);

  try {
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

    const austinTexas = await searchPlaces(db, 'Austin, Texas');
    check(
      'city and state keep that state',
      austinTexas.some((place) => place.geonameId === AUSTIN_ID) &&
        austinTexas.every((place) => place.label.includes(', Texas,')),
      austinTexas.map((place) => place.label).join(' | '),
    );
    const austinCode = await searchPlaces(db, 'Austin, TX');
    check(
      'a state code finds the same city',
      austinCode.some((place) => place.geonameId === AUSTIN_ID),
    );
    const austinFull = await searchPlaces(db, 'Austin, Texas, United States');
    check(
      'city, state, and country find that place',
      austinFull.some((place) => place.geonameId === AUSTIN_ID) &&
        austinFull.every((place) => place.label.includes(', Texas, United States')),
      austinFull.map((place) => place.label).join(' | '),
    );
    const austinElsewhere = await searchPlaces(db, 'Austin, New York');
    check(
      'a different state leaves Austin, Texas out',
      austinElsewhere.every((place) => place.geonameId !== AUSTIN_ID),
    );
    const newYorkFull = await searchPlaces(db, 'New York, New York, United States');
    check(
      'city, state, and country find New York',
      newYorkFull.some((place) => place.geonameId === NYC_ID),
      newYorkFull.map((place) => place.label).join(' | '),
    );

    // Two printings of one card concept, so the oracle/printing split is
    // genuinely under test rather than assumed.
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
        // The third value is deliberately not a finish we model. Scryfall can
        // add new ones, and unknown values must be dropped rather than offered
        // to the user in the edit form.
        finishes: ['nonfoil', 'foil', 'not_a_real_finish'],
        prices: { usd: '1.50', usd_foil: '12.00' },
        raw: {},
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
        raw: {},
      },
      // Newest of the three, but not English. The printing picker must still
      // sort it last, or every card would open on a printing the owner is
      // unlikely to hold.
      {
        scryfallId: PRINTING_C,
        oracleId: ORACLE_ID,
        name: 'Smoke Test Bolt',
        setCode: 'zzx',
        setName: 'Smoke Set Gamma',
        collectorNumber: '3',
        lang: 'ja',
        releasedAt: '2025-01-01',
        raw: {},
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

    // --- Onboarding: the user picks their own username ---
    //
    // Both users start unclaimed, exactly as a real account does after its
    // first API call, so these checks run against the real starting state.
    check('new user is not onboarded', owner.onboardedAt === null);

    check(
      'a capital letter is folded, not refused',
      (await checkUsernameAvailability(db, `Smoke_Free_${stamp}`, owner.id)).username ===
        `smoke_free_${stamp}`,
    );
    check(
      'a reserved username is refused',
      !(await checkUsernameAvailability(db, 'admin', owner.id)).available,
    );
    check(
      'a username with a space is refused',
      !(await checkUsernameAvailability(db, 'smoke free', owner.id)).available,
    );
    check(
      'a free username is offered',
      (await checkUsernameAvailability(db, `smoke_free_${stamp}`, owner.id)).available,
    );
    check(
      "someone else's username is refused",
      !(await checkUsernameAvailability(db, viewer.username, owner.id)).available,
    );

    // Renaming before the welcome screen is refused, so the two paths cannot
    // be mixed up: pick at welcome, change later in profile settings.
    check(
      'profile rename is blocked before onboarding',
      !(await resolves(() => updateProfile(db, owner.id, { username: `smoke_early_${stamp}` }))),
    );

    const onboarded = await completeOnboarding(db, owner.id, {
      username: `smoke_chosen_${stamp}`,
      placeId: AUSTIN_ID,
    });
    check('onboarding set the chosen username', onboarded.username === `smoke_chosen_${stamp}`);
    check('onboarding saved the city', onboarded.placeId === AUSTIN_ID, String(onboarded.placeId));
    check('onboarding stamped the time', onboarded.onboardedAt !== null);
    check(
      'onboarding cannot run twice',
      !(await resolves(() =>
        completeOnboarding(db, owner.id, {
          username: `smoke_again_${stamp}`,
        }),
      )),
    );

    // The second user claims a username already held by the first.
    const viewerOnboarded = await completeOnboarding(db, viewer.id, {
      username: `smoke_viewer2_${stamp}`,
    });
    check('skipping the city leaves it empty', viewerOnboarded.placeId === null);
    check(
      'a taken username is refused',
      !(await resolves(() => updateProfile(db, viewer.id, { username: onboarded.username }))),
    );
    check(
      'a reserved username is refused on rename',
      !(await resolves(() => updateProfile(db, viewer.id, { username: 'binders' }))),
    );
    check(
      'an unknown city is refused',
      !(await resolves(() =>
        updateProfile(db, viewer.id, {
          username: viewerOnboarded.username,
          placeId: 2_000_000_099,
        }),
      )),
    );
    const renamedUser = await updateProfile(db, viewer.id, {
      username: `smoke_moved_${stamp}`,
      placeId: NYC_ID,
    });
    check(
      'profile rename applied after onboarding',
      renamedUser.username === `smoke_moved_${stamp}`,
    );
    check('profile saved the city', renamedUser.placeId === NYC_ID, String(renamedUser.placeId));

    // About 20 km north of Austin. A 50 km radius includes the owner. A point
    // 5 degrees north is hundreds of kilometers away and must miss that radius.
    const nearAustin = await findUsersWithinRadius(
      db,
      viewer.id,
      { latitude: 30.45, longitude: -97.7431 },
      50_000,
    );
    check(
      'ST_DWithin finds the city inside the radius',
      nearAustin.some((person) => person.username === onboarded.username),
      nearAustin.map((person) => person.username).join(','),
    );
    check(
      'a nearby result is a distance, not a pin',
      nearAustin.every(
        (person) =>
          person.distanceMeters >= 0 && person.distanceMeters <= 50_000 && !('latitude' in person),
      ),
    );
    check(
      'the searcher is left out of their own radius',
      nearAustin.every((person) => person.username !== renamedUser.username),
    );
    const farFromAustin = await findUsersWithinRadius(
      db,
      viewer.id,
      { latitude: 35.27, longitude: -97.7431 },
      50_000,
    );
    check(
      'ST_DWithin misses the city outside the radius',
      farFromAustin.every((person) => person.username !== onboarded.username),
    );
    const wideFromAustin = await findUsersWithinRadius(
      db,
      viewer.id,
      { latitude: 35.27, longitude: -97.7431 },
      800_000,
    );
    check(
      'a wider radius reaches the same city',
      wideFromAustin.some((person) => person.username === onboarded.username),
    );

    const clearedCity = await updateProfile(db, viewer.id, {
      username: renamedUser.username,
      placeId: null,
    });
    check('profile can clear the city', clearedCity.placeId === null);

    const [binder] = await db
      .insert(binders)
      .values({
        userId: owner.id,
        slug: 'smoke-binder',
        name: 'Smoke Binder',
        visibility: 'unlisted',
      })
      .returning();
    if (!binder) throw new Error('binder insert returned nothing');

    // Proves pgcrypto's gen_random_bytes is available to the column default.
    check(
      'share token generated by database default',
      /^[0-9a-f]{32}$/.test(binder.shareToken),
      binder.shareToken,
    );

    await addBinderItem(db, binder.id, {
      scryfallId: PRINTING_A,
      quantity: 2,
      finish: 'nonfoil',
      condition: 'NM',
      language: 'en',
      forTrade: true,
    });
    await addBinderItem(db, binder.id, {
      scryfallId: PRINTING_B,
      quantity: 1,
      finish: 'nonfoil',
      condition: 'NM',
      language: 'en',
      forTrade: true,
    });

    // Adding the same stack again must raise the quantity, not create a row.
    const bumped = await addBinderItem(db, binder.id, {
      scryfallId: PRINTING_A,
      quantity: 3,
      finish: 'nonfoil',
      condition: 'NM',
      language: 'en',
      forTrade: true,
    });
    const stacksOfA = await db
      .select()
      .from(binderItems)
      .where(and(eq(binderItems.binderId, binder.id), eq(binderItems.scryfallId, PRINTING_A)));
    check('duplicate add collapsed into one stack', stacksOfA.length === 1, `${stacksOfA.length}`);
    check('duplicate add summed the quantity', bumped.quantity === 5, `${bumped.quantity}`);

    // A different condition is a different stack, because it trades differently.
    await addBinderItem(db, binder.id, {
      scryfallId: PRINTING_A,
      quantity: 1,
      finish: 'nonfoil',
      condition: 'MP',
      language: 'en',
      forTrade: true,
    });
    const allStacksOfA = await db
      .select()
      .from(binderItems)
      .where(and(eq(binderItems.binderId, binder.id), eq(binderItems.scryfallId, PRINTING_A)));
    check('different condition is a separate stack', allStacksOfA.length === 2);

    // The viewer wants the concept, not either specific printing.
    await db.insert(wantItems).values({ userId: viewer.id, oracleId: ORACLE_ID, priority: 1 });

    const matches = await findTradeMatches(db, binder.id, viewer.id);
    check('match query found the want', matches.length === 1, `${matches.length} rows`);
    const match = matches[0]!;
    check('match reported the card name', match.cardName === 'Smoke Test Bolt', match.cardName);
    // 5 near mint + 1 moderately played of printing A, plus 1 of printing B.
    check(
      'match summed every printing',
      match.availableQuantity === 7,
      `${match.availableQuantity}`,
    );
    check('match listed the individual stacks', match.printings.length === 3);

    // Cards marked not for trade must drop out of the results.
    await db
      .update(binderItems)
      .set({ forTrade: false })
      .where(eq(binderItems.binderId, binder.id));
    check(
      'not-for-trade cards excluded',
      (await findTradeMatches(db, binder.id, viewer.id)).length === 0,
    );

    // --- Phase 4: binder settings ---

    const renamed = await updateBinder(db, binder.id, owner.id, { name: 'Renamed Binder' });
    check('binder rename applied', renamed.name === 'Renamed Binder', renamed.name);
    // A rename must not re-slug, or every share link already sent would break.
    check('rename left the slug alone', renamed.slug === binder.slug, renamed.slug);

    await updateBinder(db, binder.id, owner.id, { visibility: 'public' });
    const madePublic = await getBinderById(db, binder.id);
    check('visibility change applied', madePublic.visibility === 'public', madePublic.visibility);

    const rotated = await rotateShareToken(db, binder.id);
    check('rotated token is a new value', rotated !== binder.shareToken);
    check('rotated token is well formed', /^[0-9a-f]{32}$/.test(rotated), rotated);

    // The owner sees the token; nobody else does. Leaking it from a public
    // binder would survive a later switch back to unlisted.
    const ownerView = toBinderResponse(madePublic, owner.id) as Record<string, unknown>;
    const strangerView = toBinderResponse(madePublic, viewer.id) as Record<string, unknown>;
    check('owner response includes the share token', 'shareToken' in ownerView);
    check('stranger response omits the share token', !('shareToken' in strangerView));

    // --- Phase 4: per-stack edits ---

    const edited = await updateBinderItem(db, binder.id, bumped.id, {
      condition: 'LP',
      quantity: 4,
      forTrade: true,
    });
    check('stack condition edited', edited.condition === 'LP', edited.condition);
    check('stack quantity edited', edited.quantity === 4, `${edited.quantity}`);
    check(
      'edited stack reports the printing finishes',
      edited.availableFinishes?.join(',') === 'nonfoil,foil',
      JSON.stringify(edited.availableFinishes),
    );

    // --- Phase 4: keyset pagination ---

    const firstPage = await listBinderItems(db, binder.id, { limit: 2 });
    check(
      'first page respects the limit',
      firstPage.items.length === 2,
      `${firstPage.items.length}`,
    );
    check('first page returns a cursor', Boolean(firstPage.nextCursor));

    const secondPage = await listBinderItems(db, binder.id, {
      limit: 2,
      cursor: firstPage.nextCursor ?? undefined,
    });
    const firstIds = new Set(firstPage.items.map((item) => item.id));
    const overlap = secondPage.items.filter((item) => firstIds.has(item.id));
    check('second page does not repeat the first', overlap.length === 0, `${overlap.length} dupes`);
    check('pagination ended cleanly', secondPage.nextCursor === null);

    // Restore for the access-control checks below.
    await updateBinder(db, binder.id, owner.id, { visibility: 'unlisted' });

    // Access control.
    check(
      'owner can view own unlisted binder',
      passes(() => assertCanView(binder, { userId: owner.id })),
    );
    check(
      'stranger without token is refused',
      !passes(() => assertCanView(binder, { userId: viewer.id })),
    );
    check(
      'stranger with token is allowed',
      passes(() => assertCanView(binder, { userId: viewer.id, shareToken: binder.shareToken })),
    );

    // Fuzzy search must survive a typo, which is what pg_trgm is there for.
    //
    // These assertions deliberately do not require our card to be the only
    // result. Once the Scryfall mirror is populated, real cards match a
    // misspelling too. What must hold either way is that our card is found,
    // ranked first, and collapsed to a single row per concept.
    const typo = await searchCards(db, { q: 'smoke tst bolt', limit: 5, uniqueByOracle: true });
    const ours = typo.filter((card) => card.oracleId === ORACLE_ID);
    check(
      'trigram search matched a misspelling',
      ours.length > 0,
      `${typo.length} rows, none ours`,
    );
    check('misspelling ranked our card first', typo[0]?.oracleId === ORACLE_ID, typo[0]?.name);
    check('uniqueByOracle returned one row per concept', ours.length === 1, `${ours.length} rows`);

    // --- Printing picker ---

    const printings = await getPrintingsByOracleId(db, ORACLE_ID, { limit: 60 });
    check(
      'printings found every printing',
      printings.items.length === 3,
      `${printings.items.length}`,
    );
    check(
      'English printings sort ahead of the newer Japanese one',
      printings.items.map((card) => card.scryfallId).join(',') ===
        [PRINTING_A, PRINTING_B, PRINTING_C].join(','),
      printings.items.map((card) => `${card.setCode}/${card.lang}`).join(' '),
    );
    check(
      'printings carry the prices the picker displays',
      printings.items[0]?.prices?.usd_foil === '12.00',
      JSON.stringify(printings.items[0]?.prices),
    );

    const printingPage1 = await getPrintingsByOracleId(db, ORACLE_ID, { limit: 2 });
    check('printing page respects the limit', printingPage1.items.length === 2);
    check('printing page returns a cursor', Boolean(printingPage1.nextCursor));
    const printingPage2 = await getPrintingsByOracleId(db, ORACLE_ID, {
      limit: 2,
      cursor: printingPage1.nextCursor ?? undefined,
    });
    check(
      'second printing page continues rather than restarts',
      printingPage2.items.length === 1 && printingPage2.items[0]?.scryfallId === PRINTING_C,
      printingPage2.items.map((card) => card.setCode).join(','),
    );
    check('printing pagination ended cleanly', printingPage2.nextCursor === null);

    const byName = await getPrintingsByOracleId(db, ORACLE_ID, { limit: 60, q: 'Set Beta' });
    check(
      'set filter matches on set name',
      byName.items.length === 1 && byName.items[0]?.scryfallId === PRINTING_B,
      `${byName.items.length}`,
    );
    const byCode = await getPrintingsByOracleId(db, ORACLE_ID, { limit: 60, q: 'zzx' });
    check(
      'set filter matches on set code',
      byCode.items.length === 1 && byCode.items[0]?.scryfallId === PRINTING_C,
      `${byCode.items.length}`,
    );
    check(
      'malformed printing cursor is rejected',
      !(await resolves(() =>
        getPrintingsByOracleId(db, ORACLE_ID, { limit: 2, cursor: 'not-a-number' }),
      )),
    );

    // --- Price selection ---
    //
    // Reading `usd` for a foil is the mistake this guards against. A foil-only
    // printing has no `usd` at all and would silently display as unpriced.
    const alpha = printings.items[0];
    check(
      'foil price comes from the foil field',
      priceForFinish(alpha?.prices, 'foil') === '12.00',
    );
    check(
      'plain price comes from the plain field',
      priceForFinish(alpha?.prices, 'nonfoil') === '1.50',
    );
    check('missing finish price is null', priceForFinish(alpha?.prices, 'etched') === null);
    check('absent prices are null, not a crash', priceForFinish(null, 'nonfoil') === null);
    check(
      'money formats as US dollars',
      formatUsd('1234.5') === '$1,234.50',
      `${formatUsd('1234.5')}`,
    );
    check('no price formats as null', formatUsd(null) === null);

    console.log('\nall checks passed');
  } finally {
    await db.delete(wantItems).where(eq(wantItems.oracleId, ORACLE_ID));
    await db.delete(users).where(sql`${users.auth0Sub} LIKE ${'smoke|%'}`);
    await db.delete(places).where(inArray(places.geonameId, [AUSTIN_ID, NYC_ID]));
    await db.delete(cards).where(eq(cards.oracleId, ORACLE_ID));
  }
}

/** Async sibling of `passes`, for service calls that reject on bad input. */
async function resolves(action: () => Promise<unknown>): Promise<boolean> {
  try {
    await action();
    return true;
  } catch {
    return false;
  }
}

function passes(action: () => void): boolean {
  try {
    action();
    return true;
  } catch {
    return false;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('\nsmoke test failed');
    console.error(error);
    process.exit(1);
  });

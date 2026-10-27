import {
  collectionItems,
  cards,
  createDatabase,
  places,
  users,
  wantItems,
  wantLists,
} from '@opulent/db';
import { loadEnv } from '@opulent/db/env';
import { askingPrice, formatUsd, marketPrices, priceForFinish } from '@opulent/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  addCollectionItem,
  assertCanViewTradeBinder,
  type CollectionItemInput,
  findTradeBinderMatches,
  getCollectionItem,
  listCollectionCardsByValue,
  listCollectionHighlights,
  listCollectionItems,
  updateCollectionItem,
} from './modules/collection/service';
import {
  addMembership,
  createGroup,
  deleteGroup,
  getGroupForOwner,
  listGroupItems,
  listGroupsForOwner,
  removeMembership,
} from './modules/groups/service';
import {
  getCardPriceSeries,
  getPrintingsByOracleId,
  listLanguagePrintings,
  listLanguagesForPrinting,
  listSetsByOracleId,
  searchCards,
} from './modules/cards/service';
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
const PRINTING_A_JA = '00000000-0000-4000-8000-0000000000a6';
const PRINTING_B = '00000000-0000-4000-8000-0000000000a2';
const PRINTING_C = '00000000-0000-4000-8000-0000000000a3';
const PRINTING_ARENA = '00000000-0000-4000-8000-0000000000a4';
const PRINTING_ART = '00000000-0000-4000-8000-0000000000a5';
const ARENA_ORACLE_ID = '00000000-0000-4000-8000-00000000f00e';
const ART_ORACLE_ID = '00000000-0000-4000-8000-00000000f00f';

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

    // --- The collection model: groups, memberships, one stack per person ---

    const group = await createGroup(db, owner.id, { name: 'Smoke Binder' });
    check('a group is owned by its creator', group.userId === owner.id, group.userId);
    check(
      'group names ignore case',
      !(await resolves(() => createGroup(db, owner.id, { name: 'smoke binder' }))),
    );

    /** Every stack belongs to the person. A group is only a label on it. */
    const addToBinder = (input: CollectionItemInput) => addCollectionItem(db, owner.id, input);

    await addToBinder({
      scryfallId: PRINTING_A,
      quantity: 2,
      finish: 'nonfoil',
      condition: 'NM',
      language: 'en',
      forTrade: true,
      price: { kind: 'market' },
    });
    await addToBinder({
      scryfallId: PRINTING_B,
      quantity: 1,
      finish: 'nonfoil',
      condition: 'NM',
      language: 'en',
      forTrade: true,
      price: { kind: 'market' },
    });

    // Adding the same stack again must raise the quantity, not create a row.
    const bumped = await addToBinder({
      scryfallId: PRINTING_A,
      quantity: 3,
      finish: 'nonfoil',
      condition: 'NM',
      language: 'en',
      forTrade: true,
      price: { kind: 'market' },
    });
    const stacksOfA = await db
      .select()
      .from(collectionItems)
      .where(and(eq(collectionItems.userId, owner.id), eq(collectionItems.scryfallId, PRINTING_A)));
    check('duplicate add collapsed into one stack', stacksOfA.length === 1, `${stacksOfA.length}`);
    check('duplicate add summed the quantity', bumped.quantity === 5, `${bumped.quantity}`);
    check('a new card starts at the market price', bumped.price.kind === 'market');

    // A different condition is a different stack, because it trades differently.
    await addToBinder({
      scryfallId: PRINTING_A,
      quantity: 1,
      finish: 'nonfoil',
      condition: 'MP',
      language: 'en',
      forTrade: true,
      price: { kind: 'market' },
    });
    const allStacksOfA = await db
      .select()
      .from(collectionItems)
      .where(and(eq(collectionItems.userId, owner.id), eq(collectionItems.scryfallId, PRINTING_A)));
    check('different condition is a separate stack', allStacksOfA.length === 2);

    // Price is an attribute of the stack, not part of what makes it distinct.
    const repriced = await addToBinder({
      scryfallId: PRINTING_A,
      quantity: 1,
      finish: 'nonfoil',
      condition: 'NM',
      language: 'en',
      forTrade: true,
      price: { kind: 'custom', amount: '4.5' },
    });
    check('price is not part of the stack key', repriced.id === bumped.id, repriced.id);
    check('a second price did not make a stack', stacksOfA.length === 1, `${stacksOfA.length}`);
    check(
      'a duplicate add kept the stored price',
      repriced.price.kind === 'market',
      repriced.price.kind,
    );
    const changedPrice = await updateCollectionItem(db, owner.id, bumped.id, {
      price: { kind: 'percent', percent: 80 },
    });
    check(
      'a stack price can be changed',
      changedPrice.price.kind === 'percent' && changedPrice.price.percent === 80,
    );

    // A group is a label joined through a membership. It never owns the card.
    await addMembership(db, owner.id, group.id, bumped.id);
    const inGroup = await listGroupItems(db, owner.id, group.id, { limit: 10 });
    check(
      'a membership puts the card in the group',
      inGroup.items.some((item) => item.id === bumped.id),
    );
    check(
      'the group item carries its label',
      inGroup.items
        .find((item) => item.id === bumped.id)
        ?.groups.some((ref) => ref.id === group.id) === true,
    );

    const secondGroup = await createGroup(db, owner.id, { name: 'Second pile' });
    await addMembership(db, owner.id, secondGroup.id, bumped.id);
    check(
      'a card can sit in two groups',
      (await listGroupItems(db, owner.id, secondGroup.id, { limit: 10 })).items.some(
        (item) => item.id === bumped.id,
      ),
    );
    await removeMembership(db, owner.id, secondGroup.id, bumped.id);
    check(
      'removing a label keeps the card',
      (await listCollectionItems(db, owner.id, { limit: 50 })).items.some(
        (item) => item.id === bumped.id,
      ),
    );
    check(
      'removing the last label empties that group',
      (await listGroupItems(db, owner.id, secondGroup.id, { limit: 10 })).items.length === 0,
    );

    const throwaway = await createGroup(db, owner.id, { name: 'Throwaway' });
    await addMembership(db, owner.id, throwaway.id, bumped.id);
    await deleteGroup(db, owner.id, throwaway.id);
    check(
      'deleting a group keeps the card',
      (await listCollectionItems(db, owner.id, { limit: 50 })).items.some(
        (item) => item.id === bumped.id,
      ),
    );
    check(
      'a deleted group is gone',
      !(await resolves(() => getGroupForOwner(db, owner.id, throwaway.id))),
    );
    const groupsWithCounts = await listGroupsForOwner(db, owner.id);
    check(
      'the group list counts its copies',
      groupsWithCounts.find((row) => row.id === group.id)?.itemCount === 6,
      `${groupsWithCounts.find((row) => row.id === group.id)?.itemCount}`,
    );

    // The viewer wants the concept, not either specific printing.
    const [smokeList] = await db
      .insert(wantLists)
      .values({ userId: viewer.id, name: 'Smoke wants', slug: 'smoke-wants' })
      .returning({ id: wantLists.id });
    await db.insert(wantItems).values({
      userId: viewer.id,
      wantListId: smokeList!.id,
      oracleId: ORACLE_ID,
      priority: 1,
    });

    const matches = await findTradeBinderMatches(db, owner.id, viewer.id);
    check('match query found the want', matches.length === 1, `${matches.length} rows`);
    const match = matches[0]!;
    check('match reported the card name', match.cardName === 'Smoke Test Bolt', match.cardName);
    // 6 near mint + 1 moderately played of printing A, plus 1 of printing B.
    check(
      'match summed every printing',
      match.availableQuantity === 8,
      `${match.availableQuantity}`,
    );
    check('match listed the individual stacks', match.printings.length === 3);

    // Cards marked not for trade must drop out of the results.
    await db
      .update(collectionItems)
      .set({ forTrade: false })
      .where(eq(collectionItems.userId, owner.id));
    check(
      'not-for-trade cards excluded',
      (await findTradeBinderMatches(db, owner.id, viewer.id)).length === 0,
    );
    await db
      .update(collectionItems)
      .set({ forTrade: true })
      .where(eq(collectionItems.userId, owner.id));

    // --- Per-stack edits ---

    const edited = await updateCollectionItem(db, owner.id, bumped.id, {
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

    const marked = await addToBinder({
      scryfallId: PRINTING_A,
      quantity: 1,
      finish: 'nonfoil',
      condition: 'NM',
      language: 'en',
      forTrade: true,
      price: { kind: 'market' },
      signed: true,
      altered: false,
      misprint: true,
      miscut: false,
    });
    check(
      'language and marks are stored',
      marked.language === 'en' &&
        marked.signed &&
        !marked.altered &&
        marked.misprint &&
        !marked.miscut,
    );
    const markedAgain = await addToBinder({
      scryfallId: PRINTING_A,
      quantity: 2,
      finish: 'nonfoil',
      condition: 'NM',
      language: 'en',
      forTrade: true,
      price: { kind: 'market' },
      signed: true,
      altered: false,
      misprint: true,
      miscut: false,
    });
    check(
      'the same marks collapse into one stack',
      markedAgain.quantity === 3,
      `${markedAgain.quantity}`,
    );
    const unmarked = await addToBinder({
      scryfallId: PRINTING_A,
      quantity: 1,
      finish: 'nonfoil',
      condition: 'NM',
      language: 'en',
      forTrade: true,
      price: { kind: 'market' },
    });
    check('a copy without those marks is its own stack', unmarked.id !== marked.id);
    const proof = await addToBinder({
      scryfallId: PRINTING_A,
      quantity: 1,
      finish: 'nonfoil',
      condition: 'NM',
      language: 'en',
      forTrade: true,
      artistProof: true,
      price: { kind: 'custom', amount: '12' },
    });
    check(
      'an artist proof is stored with its custom price',
      proof.artistProof && proof.price.kind === 'custom' && proof.price.amount === '12.00',
      proof.price.kind === 'custom' ? proof.price.amount : proof.price.kind,
    );
    check('an artist proof is its own stack', proof.id !== unmarked.id);
    const proofAgain = await addToBinder({
      scryfallId: PRINTING_A,
      quantity: 2,
      finish: 'nonfoil',
      condition: 'NM',
      language: 'en',
      forTrade: true,
      artistProof: true,
      price: { kind: 'custom', amount: '12.00' },
    });
    check(
      'the same artist proof collapses into one stack',
      proofAgain.quantity === 3,
      `${proofAgain.quantity}`,
    );
    const withPhotos = await updateCollectionItem(db, owner.id, unmarked.id, {
      photoUrl: 'https://imgur.com/a/example',
    });
    check(
      'photo link is stored',
      withPhotos.photoUrl === 'https://imgur.com/a/example',
      withPhotos.photoUrl ?? '',
    );
    const clearedPhotos = await updateCollectionItem(db, owner.id, unmarked.id, { photoUrl: null });
    check(
      'photo link can be cleared',
      clearedPhotos.photoUrl === null,
      String(clearedPhotos.photoUrl),
    );

    const printedLanguages = await listLanguagesForPrinting(db, PRINTING_A);
    check(
      'language list is only what this printing was made in',
      printedLanguages.join(',') === 'en,ja',
      printedLanguages.join(','),
    );
    const japaneseLanguages = await listLanguagesForPrinting(db, PRINTING_C);
    check(
      'a Japanese-only printing lists Japanese',
      japaneseLanguages.join(',') === 'ja',
      japaneseLanguages.join(','),
    );
    check(
      'an unprinted language is refused',
      !(await resolves(() =>
        addToBinder({
          scryfallId: PRINTING_A,
          quantity: 1,
          finish: 'nonfoil',
          condition: 'NM',
          language: 'de',
          forTrade: true,
          price: { kind: 'market' },
        }),
      )),
    );

    // --- Dashboard highlights ---

    const highlights = await listCollectionHighlights(db, owner.id, 10);
    check('highlights returned rows', highlights.length > 0, `${highlights.length}`);
    check(
      'highlights are sorted by asking price',
      highlights.every(
        (row, index) =>
          index === 0 || Number(highlights[index - 1]!.price ?? 0) >= Number(row.price ?? 0),
      ),
    );
    check(
      'highlight prices are dollar strings',
      highlights.every((row) => row.price !== null && /^\d+\.\d{2}$/.test(row.price)),
    );
    check(
      'weekly change is signed or empty',
      highlights.every((row) => row.weekChange === null || /^[+-]\d+\.\d{2}$/.test(row.weekChange)),
    );
    const cheapest = highlights[highlights.length - 1]!;
    await updateCollectionItem(db, owner.id, cheapest.id, {
      price: { kind: 'custom', amount: '900' },
    });
    const withCustom = await listCollectionHighlights(db, owner.id, 10);
    check(
      'a custom price beats the market price',
      withCustom[0]?.id === cheapest.id && withCustom[0]?.price === '900.00',
      `${withCustom[0]?.price}`,
    );
    check(
      'the highlights limit is respected',
      (await listCollectionHighlights(db, owner.id, 2)).length <= 2,
    );

    const allCards = await listCollectionCardsByValue(db, owner.id, { limit: 2 });
    check(
      'the cards page respects its page size',
      allCards.items.length === 2,
      `${allCards.items.length}`,
    );
    check('the cards page returns a cursor', Boolean(allCards.nextCursor));
    const nextCards = await listCollectionCardsByValue(db, owner.id, {
      limit: 2,
      cursor: allCards.nextCursor ?? undefined,
    });
    const allCardIds = new Set(allCards.items.map((item) => item.id));
    check(
      'the next cards page does not repeat a row',
      nextCards.items.every((item) => !allCardIds.has(item.id)),
    );

    // --- Expanded row: detail and price history ---

    const detail = await getCollectionItem(db, owner.id, bumped.id);
    check(
      'the detail returns the card record',
      detail.card?.name === 'Smoke Test Bolt',
      detail.card?.name,
    );
    check(
      'the detail refuses another owner',
      !(await resolves(() => getCollectionItem(db, viewer.id, bumped.id))),
    );

    // Two change points: one just outside the week window, one inside it.
    await db.execute(sql`
      INSERT INTO card_price_history (scryfall_id, recorded_on, usd, usd_foil, usd_etched)
      VALUES
        (${PRINTING_A}::uuid, CURRENT_DATE - 8, 10.00, 20.00, NULL),
        (${PRINTING_A}::uuid, CURRENT_DATE - 2, 11.00, 22.00, NULL)
      ON CONFLICT (scryfall_id, recorded_on) DO UPDATE SET
        usd = excluded.usd,
        usd_foil = excluded.usd_foil
    `);
    const week = await getCardPriceSeries(db, PRINTING_A, '1w');
    check('a week of prices has eight days', week.points.length === 8, `${week.points.length}`);
    check(
      'the week carries the old price forward and ends on the new one',
      week.points[0]?.prices.usd === '10.00' && week.points[7]?.prices.usd === '11.00',
      `${week.points[0]?.prices.usd} -> ${week.points[7]?.prices.usd}`,
    );
    await db.execute(sql`DELETE FROM card_price_history WHERE scryfall_id = ${PRINTING_A}::uuid`);

    // --- Trade binder doors ---

    const ownerRow = (await db.select().from(users).where(eq(users.id, owner.id)).limit(1))[0]!;
    check(
      'a trade binder starts private',
      !passes(() => assertCanViewTradeBinder(ownerRow, { userId: viewer.id })),
    );
    await updateProfile(db, owner.id, { tradeBinderVisibility: 'public' });
    const openOwner = (await db.select().from(users).where(eq(users.id, owner.id)).limit(1))[0]!;
    check(
      'a public trade binder opens to a stranger',
      passes(() => assertCanViewTradeBinder(openOwner, { userId: viewer.id })),
    );

    // --- Keyset pagination ---

    // Leave three stacks so the page walk has a second page.
    await db.delete(collectionItems).where(inArray(collectionItems.id, [marked.id, proof.id]));

    const firstPage = await listCollectionItems(db, owner.id, { limit: 2 });
    check(
      'first page respects the limit',
      firstPage.items.length === 2,
      `${firstPage.items.length}`,
    );
    check('first page returns a cursor', Boolean(firstPage.nextCursor));

    const secondPage = await listCollectionItems(db, owner.id, {
      limit: 2,
      cursor: firstPage.nextCursor ?? undefined,
    });
    const firstIds = new Set(firstPage.items.map((item) => item.id));
    const overlap = secondPage.items.filter((item) => firstIds.has(item.id));
    check('second page does not repeat the first', overlap.length === 0, `${overlap.length} dupes`);
    check('pagination ended cleanly', secondPage.nextCursor === null);

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
      'another language of the same printing is one tile',
      printings.items.filter((card) => card.setCode === 'zzz').length === 1 &&
        printings.items.some((card) => card.scryfallId === PRINTING_A),
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

    const arenaSearch = await searchCards(db, {
      q: 'Smoke Arena Mythic',
      limit: 5,
      uniqueByOracle: true,
    });
    check(
      'an arena-only card is left out of search',
      arenaSearch.every((card) => card.scryfallId !== PRINTING_ARENA),
    );
    check(
      'an arena-only card cannot be added to a collection',
      !(await resolves(() =>
        addToBinder({
          scryfallId: PRINTING_ARENA,
          quantity: 1,
          finish: 'nonfoil',
          condition: 'NM',
          language: 'en',
          forTrade: true,
          price: { kind: 'market' },
        }),
      )),
    );
    const artSearch = await searchCards(db, {
      q: 'Smoke Test Bolt',
      limit: 20,
      uniqueByOracle: true,
    });
    check(
      'an art card is left out of search',
      artSearch.every((card) => card.scryfallId !== PRINTING_ART) &&
        artSearch.some((card) => card.oracleId === ORACLE_ID),
    );
    check(
      'an art card cannot be added to a collection',
      !(await resolves(() =>
        addToBinder({
          scryfallId: PRINTING_ART,
          quantity: 1,
          finish: 'nonfoil',
          condition: 'NM',
          language: 'en',
          forTrade: true,
          price: { kind: 'market' },
        }),
      )),
    );

    const sets = await listSetsByOracleId(db, ORACLE_ID);
    check(
      'set list has one row per set',
      sets.length === 3 &&
        sets.some((set) => set.setName === 'Smoke Set Beta' && set.setCode === 'zzy'),
      sets.map((set) => set.setCode).join(','),
    );

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
    const kept = marketPrices({ usd: null, usd_foil: '3.00' }, { usd: '1.50', usd_foil: '12.00' });
    check(
      'a foreign price that exists is kept',
      kept?.usd === '1.50' && kept?.usd_foil === '3.00',
      JSON.stringify(kept),
    );
    const languagePrintings = await listLanguagePrintings(db, PRINTING_A);
    const japanesePrinting = languagePrintings.find((card) => card.lang === 'ja');
    check(
      'a foreign printing uses the English market price',
      japanesePrinting?.prices?.usd === '1.50' && japanesePrinting?.prices?.usd_foil === '12.00',
      JSON.stringify(japanesePrinting?.prices),
    );
    const foreignCopy = await addToBinder({
      scryfallId: PRINTING_A_JA,
      quantity: 1,
      finish: 'nonfoil',
      condition: 'NM',
      language: 'ja',
      forTrade: true,
      price: { kind: 'market' },
    });
    check(
      'a saved foreign copy prices from the English printing',
      foreignCopy.card?.prices?.usd === '1.50',
      JSON.stringify(foreignCopy.card?.prices),
    );
    // The English copy of this exact stack already exists, and moving onto an
    // existing stack is refused. Clear it so the language switch has a target.
    await db
      .delete(collectionItems)
      .where(
        and(
          eq(collectionItems.userId, owner.id),
          eq(collectionItems.scryfallId, PRINTING_A),
          eq(collectionItems.language, 'en'),
          eq(collectionItems.condition, 'NM'),
        ),
      );
    const switched = await updateCollectionItem(db, owner.id, foreignCopy.id, { language: 'en' });
    check(
      'changing language points the picture at that printing',
      switched.language === 'en' && switched.scryfallId === PRINTING_A,
      switched.scryfallId,
    );
    await db.delete(collectionItems).where(eq(collectionItems.id, foreignCopy.id));
    check(
      'money formats as US dollars',
      formatUsd('1234.5') === '$1,234.50',
      `${formatUsd('1234.5')}`,
    );
    check('no price formats as null', formatUsd(null) === null);
    check(
      'percent price is that share of market',
      askingPrice('1.50', { kind: 'percent', percent: 90 }) === '1.35',
    );
    check(
      '100 percent is the full market price',
      askingPrice('1.50', { kind: 'percent', percent: 100 }) === '1.50',
    );
    check(
      '0 percent is zero dollars',
      askingPrice('1.50', { kind: 'percent', percent: 0 }) === '0.00',
    );
    check(
      'market asking price is the stored price',
      askingPrice('1.50', { kind: 'market' }) === '1.50',
    );
    check(
      'custom asking price keeps cents',
      askingPrice('1.50', { kind: 'custom', amount: '4.5' }) === '4.50',
    );
    check(
      'a percent with no market price has no dollar amount',
      askingPrice(null, { kind: 'percent', percent: 90 }) === null,
    );

    console.log('\nall checks passed');
  } finally {
    await db.delete(wantItems).where(eq(wantItems.oracleId, ORACLE_ID));
    await db.delete(users).where(sql`${users.auth0Sub} LIKE ${'smoke|%'}`);
    await db.delete(places).where(inArray(places.geonameId, [AUSTIN_ID, NYC_ID]));
    await db
      .delete(cards)
      .where(inArray(cards.oracleId, [ORACLE_ID, ARENA_ORACLE_ID, ART_ORACLE_ID]));
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

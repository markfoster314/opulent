import {
  collectionItems,
  collectionValueSnapshots,
  wantItems,
  wantListItems,
  wantLists,
} from '@opulent/db';
import { askingPrice, priceForFinish, wantScopeKey } from '@opulent/shared';
import { and, eq, inArray } from 'drizzle-orm';
import {
  addCollectionItem,
  findTradeBinderMatches,
  getCollectionItem,
  getCollectionSummary,
  getCollectionValueBreakdown,
  getCollectionValueHistory,
  listCollectionCardsByValue,
  listCollectionHighlights,
  listCollectionItems,
  snapshotCollectionValues,
  type CollectionItemInput,
  updateCollectionItem,
} from '../modules/collection/service';
import {
  addMembership,
  createGroup,
  deleteGroup,
  getGroupForOwner,
  listGroupItems,
  listGroupsForOwner,
  removeMembership,
} from '../modules/groups/service';
import { listLanguagesForPrinting } from '../modules/cards/service';
import {
  check,
  ORACLE_ID,
  PRINTING_A,
  PRINTING_B,
  PRINTING_C,
  resolves,
  type CollectionMarks,
  type SmokeWorld,
} from './harness';

export async function checkCollection(world: SmokeWorld): Promise<CollectionMarks> {
  const { db, owner, viewer } = world;

  const group = await createGroup(db, owner.id, { name: 'Smoke Binder' });
  check('a group is owned by its creator', group.userId === owner.id, group.userId);
  check(
    'group names ignore case',
    !(await resolves(() => createGroup(db, owner.id, { name: 'smoke binder' }))),
  );

  /** Every stack belongs to the person; a group is only a label on it. */
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

  // A group is a label joined through a membership; it never owns the card.
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

  const groupItems = await listGroupItems(db, owner.id, group.id, { limit: 50 });
  const expectedGroupValue = groupItems.items.reduce((sum, item) => {
    const market = item.card ? priceForFinish(item.card.prices, item.finish) : null;
    const unit = askingPrice(market, item.price);
    return sum + Number(unit ?? 0) * item.quantity;
  }, 0);
  const listedGroup = groupsWithCounts.find((row) => row.id === group.id);
  check(
    'the group list values its copies',
    Math.abs(Number(listedGroup?.value ?? 0) - expectedGroupValue) < 0.05,
    `${listedGroup?.value} vs ${expectedGroupValue}`,
  );

  // The viewer wants the concept, not either specific printing.
  const [smokeList] = await db
    .insert(wantLists)
    .values({ userId: viewer.id, name: 'Smoke wants', slug: 'smoke-wants' })
    .returning({ id: wantLists.id });
  const [smokeWant] = await db
    .insert(wantItems)
    .values({
      userId: viewer.id,
      oracleId: ORACLE_ID,
      priority: 1,
      scopeKey: wantScopeKey({
        wantedLanguages: [],
        wantedFinishes: [],
        wantedConditions: [],
        wantedSets: [],
      }),
    })
    .returning({ id: wantItems.id });
  await db.insert(wantListItems).values({
    wantListId: smokeList!.id,
    wantItemId: smokeWant!.id,
    userId: viewer.id,
  });

  const matches = await findTradeBinderMatches(db, owner.id, viewer.id);
  check('match query found the want', matches.length === 1, `${matches.length} rows`);
  const match = matches[0]!;
  check('match reported the card name', match.cardName === 'Smoke Test Bolt', match.cardName);
  // 6 near mint + 1 moderately played of printing A, plus 1 of printing B.
  check('match summed every printing', match.availableQuantity === 8, `${match.availableQuantity}`);
  check('match listed the individual stacks', match.printings.length === 3);

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
    highlights.every((row) => row.change === null || /^[+-]\d+\.\d{2}$/.test(row.change)),
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

  const summaryAfterCustom = await getCollectionSummary(db, owner.id);
  const setsAfterCustom = await getCollectionValueBreakdown(db, owner.id, 'set');
  check(
    'the summary follows the custom price',
    Math.abs(Number(summaryAfterCustom.marketValue) - setsAfterCustom.total) < 0.05,
    `${summaryAfterCustom.marketValue} vs ${setsAfterCustom.total}`,
  );

  check(
    'the summary counts cards on the table',
    summaryAfterCustom.onTheTable === 0,
    `${summaryAfterCustom.onTheTable}`,
  );

  const allCards = await listCollectionCardsByValue(db, owner.id, {
    limit: 2,
    sort: 'price',
    dir: 'desc',
    range: '1w',
  });
  check(
    'the cards page respects its page size',
    allCards.items.length === 2,
    `${allCards.items.length}`,
  );
  check('the cards page returns a cursor', Boolean(allCards.nextCursor));
  const nextCards = await listCollectionCardsByValue(db, owner.id, {
    limit: 2,
    sort: 'price',
    dir: 'desc',
    range: '1w',
    cursor: allCards.nextCursor ?? undefined,
  });
  const allCardIds = new Set(allCards.items.map((item) => item.id));
  check(
    'the next cards page does not repeat a row',
    nextCards.items.every((item) => !allCardIds.has(item.id)),
  );

  const sortedByName = await listCollectionCardsByValue(db, owner.id, {
    limit: 50,
    sort: 'name',
    dir: 'asc',
    range: '1w',
  });
  check(
    'name sort is alphabetical',
    sortedByName.items.every(
      (row, index) =>
        index === 0 || sortedByName.items[index - 1]!.name.localeCompare(row.name) <= 0,
    ),
  );

  check(
    'cards report the trade flag',
    sortedByName.items.every((row) => typeof row.forTrade === 'boolean'),
  );

  const sortedByPrice = await listCollectionCardsByValue(db, owner.id, {
    limit: 50,
    sort: 'price',
    dir: 'desc',
    range: '1w',
  });
  check(
    'price sort runs high to low',
    sortedByPrice.items.every(
      (row, index) =>
        index === 0 || Number(sortedByPrice.items[index - 1]!.price ?? 0) >= Number(row.price ?? 0),
    ),
  );

  const valueHistory = await getCollectionValueHistory(db, owner.id, '1m');
  check(
    'a month of collection value has points',
    valueHistory.points.length > 0 && valueHistory.points.length <= 31,
    `${valueHistory.points.length} points`,
  );
  check(
    'collection value is never negative',
    valueHistory.points.every((point) => point.value >= 0),
  );

  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await db
    .insert(collectionValueSnapshots)
    .values({ userId: owner.id, day: yesterday, value: '4321.00' })
    .onConflictDoUpdate({
      target: [collectionValueSnapshots.userId, collectionValueSnapshots.day],
      set: { value: '4321.00' },
    });
  const snappedHistory = await getCollectionValueHistory(db, owner.id, '1w');
  check(
    'a past day uses its snapshot',
    snappedHistory.points.find((point) => point.date === yesterday)?.value === 4321,
  );
  await db
    .delete(collectionValueSnapshots)
    .where(
      and(
        eq(collectionValueSnapshots.userId, owner.id),
        eq(collectionValueSnapshots.day, yesterday),
      ),
    );

  const snapshotCount = await snapshotCollectionValues(db);
  check('daily snapshots are written', snapshotCount > 0, `${snapshotCount} rows`);

  const bySet = await getCollectionValueBreakdown(db, owner.id, 'set');
  check(
    'value buckets add up',
    Math.abs(bySet.buckets.reduce((sum, bucket) => sum + bucket.value, 0) - bySet.total) < 0.05,
  );
  check(
    'value buckets run high to low',
    bySet.buckets.every(
      (bucket, index) => index === 0 || bySet.buckets[index - 1]!.value >= bucket.value,
    ),
  );

  const byPercent = await listCollectionCardsByValue(db, owner.id, {
    limit: 50,
    sort: 'change',
    dir: 'desc',
    range: '1w',
    changeBy: 'percent',
  });
  check(
    'percent change is formatted',
    byPercent.items.every(
      (row) => row.changePercent === null || /^[+-]\d+\.\d{2}%$/.test(row.changePercent),
    ),
  );

  const namedCards = await listCollectionCardsByValue(db, owner.id, {
    limit: 50,
    sort: 'name',
    dir: 'asc',
    range: '1w',
    filters: { q: 'Smoke Test Bolt' },
  });
  check(
    'the name filter narrowed the list',
    namedCards.items.length > 0 &&
      namedCards.items.every((row) => row.name.includes('Smoke Test Bolt')),
    `${namedCards.items.length}`,
  );

  const groupedCards = await listCollectionCardsByValue(db, owner.id, {
    limit: 50,
    sort: 'name',
    dir: 'asc',
    range: '1w',
    filters: { groupId: group.id },
  });
  check(
    'the group filter keeps that group',
    groupedCards.items.length > 0 && groupedCards.items.every((row) => row.id === bumped.id),
    `${groupedCards.items.length}`,
  );

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

  return { markedId: marked.id, proofId: proof.id };
}

export async function checkCollectionPages(
  world: SmokeWorld,
  marks: CollectionMarks,
): Promise<void> {
  const { db, owner } = world;

  // Leave three stacks so the page walk has a second page.
  await db
    .delete(collectionItems)
    .where(inArray(collectionItems.id, [marks.markedId, marks.proofId]));

  const firstPage = await listCollectionItems(db, owner.id, { limit: 2 });
  check('first page respects the limit', firstPage.items.length === 2, `${firstPage.items.length}`);
  check('first page returns a cursor', Boolean(firstPage.nextCursor));

  const secondPage = await listCollectionItems(db, owner.id, {
    limit: 2,
    cursor: firstPage.nextCursor ?? undefined,
  });
  const firstIds = new Set(firstPage.items.map((item) => item.id));
  const overlap = secondPage.items.filter((item) => firstIds.has(item.id));
  check('second page does not repeat the first', overlap.length === 0, `${overlap.length} dupes`);
  check('pagination ended cleanly', secondPage.nextCursor === null);
}

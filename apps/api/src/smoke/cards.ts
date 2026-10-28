import { collectionItems } from '@opulent/db';
import { marketPrices, priceForFinish } from '@opulent/shared';
import { and, eq, sql } from 'drizzle-orm';
import {
  addCollectionItem,
  type CollectionItemInput,
  listCollectionMovers,
  updateCollectionItem,
} from '../modules/collection/service';
import {
  getCardPriceSeries,
  getPrintingsByOracleId,
  listLanguagePrintings,
  listSetsByOracleId,
  searchCards,
} from '../modules/cards/service';
import {
  check,
  ORACLE_ID,
  PRINTING_A,
  PRINTING_A_JA,
  PRINTING_ARENA,
  PRINTING_ART,
  PRINTING_B,
  PRINTING_C,
  resolves,
  type SmokeWorld,
} from './harness';

export async function checkMovers(world: SmokeWorld): Promise<void> {
  const { db, owner } = world;

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
  const movers = await listCollectionMovers(db, owner.id, {
    limit: 5,
    range: '1w',
    changeBy: 'amount',
  });
  check(
    'movers split into gains and losses',
    movers.gainers.every((row) => row.change !== null && Number(row.change) > 0) &&
      movers.losers.every((row) => row.change !== null && Number(row.change) < 0),
  );
  check(
    'movers list the changed cards',
    movers.gainers.length + movers.losers.length > 0,
    `${movers.gainers.length} gainers, ${movers.losers.length} losers`,
  );
  await db.execute(sql`DELETE FROM card_price_history WHERE scryfall_id = ${PRINTING_A}::uuid`);
}

export async function checkCards(world: SmokeWorld): Promise<void> {
  const { db, owner } = world;
  const addToBinder = (input: CollectionItemInput) => addCollectionItem(db, owner.id, input);

  // A populated mirror can match the typo too; our card must still be found, first, and deduped.
  const typo = await searchCards(db, { q: 'smoke tst bolt', limit: 5, uniqueByOracle: true });
  const ours = typo.filter((card) => card.oracleId === ORACLE_ID);
  check('trigram search matched a misspelling', ours.length > 0, `${typo.length} rows, none ours`);
  check('misspelling ranked our card first', typo[0]?.oracleId === ORACLE_ID, typo[0]?.name);
  check('uniqueByOracle returned one row per concept', ours.length === 1, `${ours.length} rows`);

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

  // A foil-only printing has no usd, so reading usd would silently show it unpriced.
  const alpha = printings.items[0];
  check('foil price comes from the foil field', priceForFinish(alpha?.prices, 'foil') === '12.00');
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
  // The English stack already exists, and moving onto it is refused; clear it first.
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
}

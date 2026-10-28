import { createDatabase } from '@opulent/db';
import { loadEnv } from '@opulent/db/env';
import { checkCards, checkMovers } from './smoke/cards';
import { checkCollection, checkCollectionPages } from './smoke/collection';
import { checkMoney } from './smoke/money';
import { checkPlaces } from './smoke/places';
import { cleanupSmoke, seedSmoke } from './smoke/seed';
import { checkTrades } from './smoke/trades';
import { checkSignInRace, checkUsers } from './smoke/users';

loadEnv();

/** Runs real services against a real database, cleans up, and must target a local database only. */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');

  const db = createDatabase({ connectionString, maxConnections: 2 });
  const stamp = Date.now().toString().slice(-9);

  try {
    const world = await seedSmoke(db, stamp);
    await checkPlaces(world);
    await checkUsers(world);
    const marks = await checkCollection(world);
    await checkMovers(world);
    await checkTrades(world);
    await checkCollectionPages(world, marks);
    await checkCards(world);
    checkMoney();
    await checkSignInRace(world);
    console.log('\nall checks passed');
  } finally {
    await cleanupSmoke(db);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error('\nsmoke test failed');
    console.error(error);
    process.exit(1);
  });

import {
  closeDatabase,
  createDatabase,
  resolveConnectionString,
  snapshotCollectionValues,
} from '@opulent/db';
import { loadEnv } from '@opulent/db/env';
import { importCatalog } from './importer';
import { recordDailyPrices } from './prices';
import { scryfallSource } from './scryfall';

loadEnv();

// Session lock. A second run exits while this connection stays open.
const CARD_SYNC_LOCK = 842184218;

function maxRows(): number | undefined {
  const raw = process.env.SCRYFALL_MAX_ROWS;
  if (!raw) return undefined;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error('SCRYFALL_MAX_ROWS must be a positive integer');
  }
  return value;
}

/** Nightly Fargate job (exceeds Lambda's 15 min); EventBridge triggers it after Scryfall rebuilds. */
async function main() {
  const connectionString = await resolveConnectionString();
  // Same file the deployed task requests. The catalog includes non-English printings.
  const bulkType = process.env.SCRYFALL_BULK_TYPE ?? 'all_cards';
  const startedAt = Date.now();

  // Bigger pool than the API: one long batch writer, not many concurrent Lambdas.
  const db = createDatabase({ connectionString, maxConnections: 4 });
  const hold = await db.$client.reserve();
  let locked = false;

  try {
    const rows = await hold<{ locked: boolean }[]>`
      SELECT pg_try_advisory_lock(${CARD_SYNC_LOCK}::bigint) AS locked
    `;
    locked = Boolean(rows[0]?.locked);
    if (!locked) {
      console.log('card sync already running');
      return;
    }

    const source = scryfallSource(bulkType, maxRows());
    const stats = await importCatalog(db, source);
    const priced = await recordDailyPrices(db);
    const snapped = await snapshotCollectionValues(db);

    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(
      `${source.name} done in ${seconds}s: read ${stats.read}, written ${stats.written}, skipped ${stats.skipped}`,
    );
    console.log(`${priced} price rows recorded for today.`);
    console.log(`${snapped} collection value snapshots written.`);
  } finally {
    try {
      if (locked) {
        await hold`SELECT pg_advisory_unlock(${CARD_SYNC_LOCK}::bigint)`;
      }
    } finally {
      hold.release();
      await closeDatabase(db);
    }
  }
}

main().catch((error: unknown) => {
  console.error('card sync failed', error);
  process.exit(1);
});

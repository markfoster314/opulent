import { createDatabase, resolveConnectionString } from '@opulent/db';
import { loadEnv } from '@opulent/db/env';
import { importCatalog } from './importer';
import { recordDailyPrices } from './prices';
import { snapshotCollectionValues } from './snapshots';
import { scryfallSource } from './scryfall';

loadEnv();

/** Nightly Fargate job (exceeds Lambda's 15 min); EventBridge triggers it after Scryfall rebuilds. */
async function main() {
  const connectionString = await resolveConnectionString();
  const bulkType = process.env.SCRYFALL_BULK_TYPE ?? 'default_cards';
  const startedAt = Date.now();

  // Bigger pool than the API: one long batch writer, not many concurrent Lambdas.
  const db = createDatabase({ connectionString, maxConnections: 4 });

  const source = scryfallSource(bulkType);
  const stats = await importCatalog(db, source);
  const priced = await recordDailyPrices(db);
  const snapped = await snapshotCollectionValues(db);

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `${source.name} done in ${seconds}s: read ${stats.read}, written ${stats.written}, skipped ${stats.skipped}`,
  );
  console.log(`${priced} price rows recorded for today.`);
  console.log(`${snapped} collection value snapshots written.`);
}

main().catch((error: unknown) => {
  console.error('card sync failed', error);
  process.exit(1);
});

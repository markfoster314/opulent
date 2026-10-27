import { createDatabase, resolveConnectionString } from '@opulent/db';
import { loadEnv } from '@opulent/db/env';
import { importCatalog } from './importer';
import { recordDailyPrices } from './prices';
import { scryfallSource } from './scryfall';

loadEnv();

/**
 * Nightly catalog refresh.
 *
 * Runs on AWS Fargate, not Lambda: the download and upsert of roughly 100,000
 * cards takes longer than Lambda's 15 minute ceiling.
 *
 * Triggered by Amazon EventBridge Scheduler once a day, a little after
 * Scryfall's own bulk files are rebuilt. A second game adds a second source
 * here; the importer is the same.
 */
async function main() {
  const connectionString = await resolveConnectionString();
  const bulkType = process.env.SCRYFALL_BULK_TYPE ?? 'default_cards';
  const startedAt = Date.now();

  // A slightly larger pool than the API uses: this is one long batch writer,
  // not hundreds of concurrent Lambda copies.
  const db = createDatabase({ connectionString, maxConnections: 4 });

  const source = scryfallSource(bulkType);
  const stats = await importCatalog(db, source);
  const priced = await recordDailyPrices(db);

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `${source.name} done in ${seconds}s: read ${stats.read}, written ${stats.written}, skipped ${stats.skipped}`,
  );
  console.log(`${priced} price rows recorded for today.`);
}

main().catch((error: unknown) => {
  console.error('card sync failed', error);
  process.exit(1);
});

import { createDatabase, resolveConnectionString } from '@opulent/db';
import { loadEnv } from '@opulent/db/env';
import { importCards } from './importer';
import { findBulkData, streamBulkCards } from './scryfall';

loadEnv();

/**
 * Nightly Scryfall mirror refresh.
 *
 * Runs on AWS Fargate, not Lambda: the download and upsert of roughly 100,000
 * cards takes longer than Lambda's 15 minute ceiling.
 *
 * Triggered by Amazon EventBridge Scheduler once a day, a little after
 * Scryfall's own bulk files are rebuilt.
 */
async function main() {
  const connectionString = await resolveConnectionString();
  const bulkType = process.env.SCRYFALL_BULK_TYPE ?? 'default_cards';
  const startedAt = Date.now();

  const entry = await findBulkData(bulkType);
  console.log(
    `source: ${entry.name} (${bulkType}), updated ${entry.updated_at}, ` +
      `${(entry.compressed_size / 1024 / 1024).toFixed(1)} MB compressed`,
  );

  // A slightly larger pool than the API uses: this is one long batch writer,
  // not hundreds of concurrent Lambda copies.
  const db = createDatabase({ connectionString, maxConnections: 4 });

  const stats = await importCards(db, streamBulkCards(entry));

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `done in ${seconds}s: read ${stats.read}, written ${stats.written}, skipped ${stats.skipped}`,
  );
}

main().catch((error: unknown) => {
  console.error('card sync failed', error);
  process.exit(1);
});

import type { Database, NewCardRow } from '@opulent/db';
import { cards } from '@opulent/db';
import { sql } from 'drizzle-orm';
import type { CatalogSource } from './catalog';

const BATCH_SIZE = 500;

/** Refresh existing rows instead of skipping; daily price changes are the point. */
async function writeBatch(db: Database, batch: NewCardRow[]): Promise<void> {
  if (batch.length === 0) return;

  await db
    .insert(cards)
    .values(batch)
    .onConflictDoUpdate({
      target: cards.scryfallId,
      set: {
        oracleId: sql`excluded.oracle_id`,
        game: sql`excluded.game`,
        name: sql`excluded.name`,
        setCode: sql`excluded.set_code`,
        setName: sql`excluded.set_name`,
        collectorNumber: sql`excluded.collector_number`,
        rarity: sql`excluded.rarity`,
        lang: sql`excluded.lang`,
        layout: sql`excluded.layout`,
        typeLine: sql`excluded.type_line`,
        manaCost: sql`excluded.mana_cost`,
        finishes: sql`excluded.finishes`,
        imageUris: sql`excluded.image_uris`,
        prices: sql`excluded.prices`,
        scryfallUri: sql`excluded.scryfall_uri`,
        releasedAt: sql`excluded.released_at`,
        raw: sql`excluded.raw`,
        syncedAt: sql`excluded.synced_at`,
      },
    });
}

export interface ImportStats {
  read: number;
  written: number;
  skipped: number;
}

export async function importCatalog<Item>(
  db: Database,
  source: CatalogSource<Item>,
): Promise<ImportStats> {
  const stats: ImportStats = { read: 0, written: 0, skipped: 0 };
  let batch: NewCardRow[] = [];

  for await (const item of source.list()) {
    stats.read += 1;

    const row = source.toRow(item);
    if (!row) {
      stats.skipped += 1;
      continue;
    }
    if (row.game !== source.game) {
      throw new Error(`${source.name} produced a row for game "${row.game}"`);
    }

    batch.push(row);

    if (batch.length >= BATCH_SIZE) {
      await writeBatch(db, batch);
      stats.written += batch.length;
      batch = [];

      if (stats.written % 25_000 === 0) {
        console.log(`progress: ${stats.written} cards written`);
      }
    }
  }

  await writeBatch(db, batch);
  stats.written += batch.length;

  return stats;
}

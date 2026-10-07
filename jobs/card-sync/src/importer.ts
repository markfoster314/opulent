import type { Database, NewCardRow } from '@opulent/db';
import { cards } from '@opulent/db';
import type { CardImageUris, CardPrices } from '@opulent/shared';
import { sql } from 'drizzle-orm';
import type { ScryfallCard } from './scryfall';

const BATCH_SIZE = 500;

/**
 * Double-faced cards carry no top-level `image_uris`; the art lives on each
 * face. Fall back to the front face so every card has a picture.
 */
function pickImageUris(card: ScryfallCard): CardImageUris | null {
  const source = card.image_uris ?? card.card_faces?.[0]?.image_uris;
  return (source as CardImageUris | undefined) ?? null;
}

export function toCardRow(card: ScryfallCard): NewCardRow | null {
  // A handful of Scryfall objects (tokens, art series oddities) have no
  // oracle_id. Want lists are keyed on oracle_id, so such rows are unusable.
  if (!card.oracle_id) return null;

  return {
    scryfallId: card.id,
    oracleId: card.oracle_id,
    name: card.name,
    setCode: card.set,
    setName: card.set_name ?? null,
    collectorNumber: card.collector_number,
    rarity: card.rarity ?? null,
    lang: card.lang ?? 'en',
    layout: card.layout ?? null,
    typeLine: card.type_line ?? card.card_faces?.[0]?.type_line ?? null,
    manaCost: card.mana_cost ?? card.card_faces?.[0]?.mana_cost ?? null,
    finishes: card.finishes ?? [],
    imageUris: pickImageUris(card),
    prices: (card.prices as CardPrices | undefined) ?? null,
    scryfallUri: card.scryfall_uri ?? null,
    releasedAt: card.released_at ?? null,
    raw: card,
    syncedAt: new Date(),
  };
}

/**
 * Upserts a batch. Existing rows are refreshed rather than skipped, because
 * prices change daily and that is a large part of why we re-import.
 */
async function writeBatch(db: Database, batch: NewCardRow[]): Promise<void> {
  if (batch.length === 0) return;

  await db
    .insert(cards)
    .values(batch)
    .onConflictDoUpdate({
      target: cards.scryfallId,
      set: {
        oracleId: sql`excluded.oracle_id`,
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

export async function importCards(
  db: Database,
  source: AsyncIterable<ScryfallCard>,
): Promise<ImportStats> {
  const stats: ImportStats = { read: 0, written: 0, skipped: 0 };
  let batch: NewCardRow[] = [];

  for await (const card of source) {
    stats.read += 1;

    const row = toCardRow(card);
    if (!row) {
      stats.skipped += 1;
      continue;
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

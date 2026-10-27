import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline';
import type { NewCardRow } from '@opulent/db';
import { CARD_GAME, type CardImageUris, type CardPrices } from '@opulent/shared';
import type { CatalogSource } from './catalog';

const BULK_DATA_URL = 'https://api.scryfall.com/bulk-data';

/**
 * Scryfall requires an accurate User-Agent and an explicit Accept header on
 * every request. A generic library default can get the project blocked.
 */
function headers(): Record<string, string> {
  return {
    'User-Agent': process.env.SCRYFALL_USER_AGENT ?? 'OpulentTutor/0.1 (+https://opulenttutor.com)',
    Accept: 'application/json',
  };
}

export interface BulkDataEntry {
  id: string;
  type: string;
  name: string;
  updated_at: string;
  jsonl_download_uri: string;
  compressed_size: number;
}

export async function listBulkData(): Promise<BulkDataEntry[]> {
  const response = await fetch(BULK_DATA_URL, { headers: headers() });
  if (!response.ok) {
    throw new Error(`Scryfall bulk-data listing failed: ${response.status} ${response.statusText}`);
  }
  const body = (await response.json()) as { data: BulkDataEntry[] };
  return body.data;
}

export async function findBulkData(type: string): Promise<BulkDataEntry> {
  const entries = await listBulkData();
  const entry = entries.find((candidate) => candidate.type === type);
  if (!entry) {
    const available = entries.map((candidate) => candidate.type).join(', ');
    throw new Error(`No bulk data of type "${type}". Available: ${available}`);
  }
  return entry;
}

/**
 * Yields one Scryfall card object at a time.
 *
 * The file is gzipped JSONL, roughly 80 MB compressed and far larger expanded,
 * so it is streamed and gunzipped line by line. Nothing is ever held whole in
 * memory and nothing is written to disk.
 */
export async function* streamBulkCards(entry: BulkDataEntry): AsyncGenerator<ScryfallCard> {
  const response = await fetch(entry.jsonl_download_uri, { headers: headers() });
  if (!response.ok || !response.body) {
    throw new Error(`Bulk download failed: ${response.status} ${response.statusText}`);
  }

  const lines = createInterface({
    input: Readable.fromWeb(response.body).pipe(createGunzip()),
    crlfDelay: Infinity,
  });

  for await (const line of lines) {
    if (!line.trim()) continue;
    yield JSON.parse(line) as ScryfallCard;
  }
}

/** Scryfall as a catalog source. `bulkType` is usually default_cards or all_cards. */
export function scryfallSource(bulkType: string): CatalogSource<ScryfallCard> {
  return {
    name: `scryfall:${bulkType}`,
    game: CARD_GAME,
    async *list() {
      const entry = await findBulkData(bulkType);
      console.log(
        `source: ${entry.name} (${bulkType}), updated ${entry.updated_at}, ` +
          `${(entry.compressed_size / 1024 / 1024).toFixed(1)} MB compressed`,
      );
      yield* streamBulkCards(entry);
    },
    toRow: toCardRow,
  };
}

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
    game: CARD_GAME,
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

/** Only the fields we promote to columns. The rest travels in the `raw` column. */
export interface ScryfallCard {
  id: string;
  oracle_id?: string;
  name: string;
  set: string;
  set_name?: string;
  collector_number: string;
  rarity?: string;
  lang?: string;
  layout?: string;
  type_line?: string;
  mana_cost?: string;
  finishes?: string[];
  image_uris?: Record<string, string>;
  prices?: Record<string, string | null>;
  scryfall_uri?: string;
  released_at?: string;
  card_faces?: { image_uris?: Record<string, string>; mana_cost?: string; type_line?: string }[];
}

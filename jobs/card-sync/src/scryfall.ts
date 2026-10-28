import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline';
import type { NewCardRow } from '@opulent/db';
import { CARD_GAME, type CardImageUris, type CardPrices } from '@opulent/shared';
import type { CatalogSource } from './catalog';

const BULK_DATA_URL = 'https://api.scryfall.com/bulk-data';
const LISTING_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 20 * 60 * 1000;

/** Scryfall requires a real User-Agent and explicit Accept; generic defaults can get us blocked. */
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

function retryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

class ScryfallHttpError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

/** One retry. A 503 or a stall should not fail the night. A 404 should. */
async function fetchScryfall(url: string, timeoutMs: number): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: headers(),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok && response.body) return response;
      await response.body?.cancel();
      throw new ScryfallHttpError(
        `Scryfall request failed: ${response.status} ${response.statusText}`,
        retryableStatus(response.status),
      );
    } catch (error) {
      if (error instanceof ScryfallHttpError && !error.retryable) throw error;
      lastError = error;
      if (attempt === 1) throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Scryfall request failed');
}

export async function listBulkData(): Promise<BulkDataEntry[]> {
  const response = await fetchScryfall(BULK_DATA_URL, LISTING_TIMEOUT_MS);
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

/** Gzipped JSONL streams line by line; nothing is held whole or written to disk. */
export async function* streamBulkCards(
  entry: BulkDataEntry,
  maxRows?: number,
): AsyncGenerator<ScryfallCard> {
  const response = await fetchScryfall(entry.jsonl_download_uri, DOWNLOAD_TIMEOUT_MS);
  if (!response.body) throw new Error('Scryfall download has no body');
  const lines = createInterface({
    input: Readable.fromWeb(response.body).pipe(createGunzip()),
    crlfDelay: Infinity,
  });

  try {
    let seen = 0;
    for await (const line of lines) {
      if (maxRows !== undefined && seen >= maxRows) break;
      if (!line.trim()) continue;
      seen += 1;
      yield JSON.parse(line) as ScryfallCard;
    }
  } finally {
    lines.close();
    // The reader may already be done. Cancel stops a capped download.
    await response.body.cancel().catch(() => undefined);
  }
}

export function scryfallSource(bulkType: string, maxRows?: number): CatalogSource<ScryfallCard> {
  return {
    name: `scryfall:${bulkType}`,
    game: CARD_GAME,
    async *list() {
      const entry = await findBulkData(bulkType);
      console.log(
        `source: ${entry.name} (${bulkType}), updated ${entry.updated_at}, ` +
          `${(entry.compressed_size / 1024 / 1024).toFixed(1)} MB compressed`,
      );
      yield* streamBulkCards(entry, maxRows);
    },
    toRow: toCardRow,
  };
}

/** Double-faced cards keep art on faces; use the front face so every card has a picture. */
function pickImageUris(card: ScryfallCard): CardImageUris | null {
  const source = card.image_uris ?? card.card_faces?.[0]?.image_uris;
  return (source as CardImageUris | undefined) ?? null;
}

export function toCardRow(card: ScryfallCard): NewCardRow | null {
  // Tokens and art-series oddities lack oracle_id; want lists need it, so skip those rows.
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

/** Only promoted fields; the full object still travels in raw. */
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

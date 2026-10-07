import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import { createInterface } from 'node:readline';

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

import type { NewCardRow } from '@opulent/db';

/** One source shape; future games add a file without changing the importer. */
export interface CatalogSource<Item = unknown> {
  readonly name: string;
  /** The cards.game value every row from this source must carry. */
  readonly game: string;
  /** Streams one item at a time, never the whole catalog in memory. */
  list(): AsyncIterable<Item>;
  toRow(item: Item): NewCardRow | null;
}

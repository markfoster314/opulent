import type { NewCardRow } from '@opulent/db';

/**
 * One place cards come from.
 *
 * Scryfall is the first source. A later game (Pokemon, Lorcana, comics) adds a
 * second file that fills this same shape: say which `game` value it writes,
 * stream its items, and turn each one into a row. The importer does not care
 * which source it is given.
 */
export interface CatalogSource<Item = unknown> {
  /** Short name for logs. */
  readonly name: string;
  /** The `cards.game` value every row from this source carries. */
  readonly game: string;
  /** Yields one raw item at a time. Never holds the whole catalog in memory. */
  list(): AsyncIterable<Item>;
  /** One raw item to one row, or null to skip it. */
  toRow(item: Item): NewCardRow | null;
}

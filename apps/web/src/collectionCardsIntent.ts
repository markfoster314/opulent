import type { CollectionSort, PriceRange, SortDirection } from '@opulent/shared';
import type { BinderSearch } from './binderSearch';

/** One-shot, non-shareable card-list intent carried by navigation; never written to the URL. */
export interface CollectionCardsIntent {
  cardId?: string;
  sort?: CollectionSort;
  dir?: SortDirection;
  range?: PriceRange;
  changeMode?: 'amount' | 'percent';
}

const SORTS: CollectionSort[] = ['name', 'price', 'change'];
const DIRECTIONS: SortDirection[] = ['asc', 'desc'];
const RANGES: PriceRange[] = ['1w', '1m', '6m', '1y'];

/** Validates an unknown router state, so a stale link cannot break the page. */
export function readCollectionCardsIntent(state: unknown): CollectionCardsIntent {
  if (typeof state !== 'object' || state === null) return {};
  const value = state as Record<string, unknown>;
  const intent: CollectionCardsIntent = {};

  if (typeof value.cardId === 'string' && value.cardId.length > 0) intent.cardId = value.cardId;
  if (SORTS.includes(value.sort as CollectionSort)) intent.sort = value.sort as CollectionSort;
  if (DIRECTIONS.includes(value.dir as SortDirection)) intent.dir = value.dir as SortDirection;
  if (RANGES.includes(value.range as PriceRange)) intent.range = value.range as PriceRange;
  if (value.changeMode === 'amount' || value.changeMode === 'percent') {
    intent.changeMode = value.changeMode;
  }
  return intent;
}

/** Seeds page state; card id is separate because it opens a row. */
export function applyCollectionCardsIntent(
  search: BinderSearch,
  intent: CollectionCardsIntent,
): BinderSearch {
  return {
    ...search,
    ...(intent.sort ? { sort: intent.sort } : {}),
    ...(intent.dir ? { dir: intent.dir } : {}),
    ...(intent.range ? { range: intent.range } : {}),
    ...(intent.changeMode ? { changeMode: intent.changeMode } : {}),
  };
}

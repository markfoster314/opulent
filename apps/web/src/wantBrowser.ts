import type { WantItem } from '@opulent/shared';

export type WantSort = 'priority' | 'name' | 'quantity';
export type WantSortDir = 'asc' | 'desc';

export const WANT_VIEW_KEY = 'want-card-view';
export const WANT_PAGE_SIZE = 60;

export const wantSortOptions: { value: string; label: string }[] = [
  { value: 'priority:asc', label: 'Priority high–low' },
  { value: 'priority:desc', label: 'Priority low–high' },
  { value: 'name:asc', label: 'Name A–Z' },
  { value: 'name:desc', label: 'Name Z–A' },
  { value: 'quantity:desc', label: 'Quantity high–low' },
  { value: 'quantity:asc', label: 'Quantity low–high' },
];

export function sortWants(
  items: readonly WantItem[],
  sort: WantSort,
  dir: WantSortDir,
): WantItem[] {
  const direction = dir === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    if (sort === 'priority') {
      return ((a.priority ?? 2) - (b.priority ?? 2)) * direction;
    }
    if (sort === 'quantity') {
      return (a.quantity - b.quantity) * direction;
    }
    return (
      (a.cardName ?? '').localeCompare(b.cardName ?? '', undefined, { sensitivity: 'base' }) *
      direction
    );
  });
}

export function naturalWantDir(sort: WantSort): WantSortDir {
  return sort === 'quantity' ? 'desc' : 'asc';
}

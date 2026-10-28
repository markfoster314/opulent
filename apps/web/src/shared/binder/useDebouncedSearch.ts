import type { BinderSearch } from '@/shared/binder/binderSearch';
import { useDebounced } from '@/shared/hooks/useDebounced';

/** Balances a full grid against a slow first load. */
export const BINDER_PAGE_SIZE = 24;

export function useDebouncedSearch(search: BinderSearch): BinderSearch {
  const q = useDebounced(search.q);
  const set = useDebounced(search.set);
  const type = useDebounced(search.type);
  const artist = useDebounced(search.artist);
  return { ...search, q, set, type, artist };
}

import type {
  CardRarity,
  CardCondition,
  CardFinish,
  CardLanguage,
  CollectionSort,
  PriceRange,
  SortDirection,
} from '@opulent/shared';

/** The choices on the collection filter form. Empty text and false mean that rule is off. */
export interface BinderSearch {
  q: string;
  set: string;
  /** Matched against the type line. */
  type: string;
  /** Matched against the illustrator. */
  artist: string;
  /** Only cards carrying this group label. Empty means any. */
  groupId: string;
  finish: CardFinish | '';
  condition: CardCondition | '';
  language: CardLanguage | '';
  rarity: CardRarity | '';
  forTrade: boolean;
  signed: boolean;
  altered: boolean;
  misprint: boolean;
  miscut: boolean;
  artistProof: boolean;
  onWantList: boolean;
  sort: CollectionSort;
  dir: SortDirection;
  /** The window used for the change column and the price chart. */
  range: PriceRange;
  /** Show the move as dollars or as a percent. */
  changeMode: 'amount' | 'percent';
}

export const emptyBinderSearch: BinderSearch = {
  q: '',
  set: '',
  type: '',
  artist: '',
  groupId: '',
  finish: '',
  condition: '',
  language: '',
  rarity: '',
  forTrade: false,
  signed: false,
  altered: false,
  misprint: false,
  miscut: false,
  artistProof: false,
  onWantList: false,
  sort: 'price',
  dir: 'desc',
  range: '1w',
  changeMode: 'amount',
};

/** True when any filter rule is on. Ordering and the window are not filters. */
export function binderSearchIsActive(search: BinderSearch): boolean {
  return (
    search.q.trim() !== '' ||
    search.set.trim() !== '' ||
    search.type.trim() !== '' ||
    search.artist.trim() !== '' ||
    search.groupId !== '' ||
    search.finish !== '' ||
    search.condition !== '' ||
    search.language !== '' ||
    search.rarity !== '' ||
    search.forTrade ||
    search.signed ||
    search.altered ||
    search.misprint ||
    search.miscut ||
    search.artistProof ||
    search.onWantList
  );
}

/** Clears the rules but keeps the ordering and window the user chose. */
export function clearBinderFilters(search: BinderSearch): BinderSearch {
  return {
    ...emptyBinderSearch,
    sort: search.sort,
    dir: search.dir,
    range: search.range,
    changeMode: search.changeMode,
  };
}

/** Query string for one page of cards. Only rules that are on are sent. */
export function binderSearchParams(search: BinderSearch, pageParam: string | null, limit: number) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (pageParam) params.set('cursor', pageParam);
  const name = search.q.trim();
  const set = search.set.trim();
  const type = search.type.trim();
  const artist = search.artist.trim();
  if (name) params.set('q', name);
  if (set) params.set('set', set);
  if (type) params.set('type', type);
  if (artist) params.set('artist', artist);
  if (search.groupId) params.set('groupId', search.groupId);
  if (search.finish) params.set('finish', search.finish);
  if (search.condition) params.set('condition', search.condition);
  if (search.language) params.set('language', search.language);
  if (search.rarity) params.set('rarity', search.rarity);
  if (search.forTrade) params.set('forTrade', 'true');
  if (search.signed) params.set('signed', 'true');
  if (search.altered) params.set('altered', 'true');
  if (search.misprint) params.set('misprint', 'true');
  if (search.miscut) params.set('miscut', 'true');
  if (search.artistProof) params.set('artistProof', 'true');
  if (search.onWantList) params.set('onWantList', 'true');
  params.set('sort', search.sort);
  params.set('dir', search.dir);
  params.set('range', search.range);
  params.set('changeBy', search.changeMode);
  return params;
}

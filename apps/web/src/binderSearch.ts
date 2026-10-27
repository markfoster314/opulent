import type { CardRarity, CardCondition, CardFinish, CardLanguage } from '@opulent/shared';

/** The choices on the binder search form. Empty text and false mean that rule is off. */
export interface BinderSearch {
  q: string;
  set: string;
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
}

export const emptyBinderSearch: BinderSearch = {
  q: '',
  set: '',
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
};

export function binderSearchIsActive(search: BinderSearch): boolean {
  return (
    search.q.trim() !== '' ||
    search.set.trim() !== '' ||
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

/** Query string for one page of binder cards. Only rules that are on are sent. */
export function binderSearchParams(search: BinderSearch, pageParam: string | null, limit: number) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (pageParam) params.set('cursor', pageParam);
  const name = search.q.trim();
  const set = search.set.trim();
  if (name) params.set('q', name);
  if (set) params.set('set', set);
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
  return params;
}

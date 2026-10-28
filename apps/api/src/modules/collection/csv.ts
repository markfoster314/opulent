import type { CardCondition, CardFinish, CardLanguage } from '@opulent/shared';
import { cardLanguageSchema } from '@opulent/shared';

export { parseCsv, toCsvLine } from '../../lib/csv';

export type ImportFormat = 'manabox' | 'moxfield' | 'plain';

const columnNames: Record<ImportFormat, Record<keyof RawRow, string[]>> = {
  manabox: {
    name: ['name'],
    set: ['set code'],
    number: ['collector number'],
    quantity: ['quantity'],
    condition: ['condition'],
    finish: ['foil'],
    language: ['language'],
    forTrade: [],
    scryfallId: ['scryfall id'],
  },
  moxfield: {
    name: ['name'],
    set: ['edition'],
    number: ['collector number'],
    quantity: ['count'],
    condition: ['condition'],
    finish: ['foil'],
    language: ['language'],
    forTrade: ['tradelist count'],
    scryfallId: [],
  },
  plain: {
    name: ['name', 'card', 'card name'],
    set: ['set', 'set code', 'edition'],
    number: ['number', 'collector number', 'collector_number'],
    quantity: ['quantity', 'qty', 'count'],
    condition: ['condition'],
    finish: ['finish', 'foil'],
    language: ['language', 'lang'],
    forTrade: ['for trade', 'for_trade', 'trade', 'tradelist count'],
    scryfallId: ['scryfall id', 'scryfall_id'],
  },
};

export interface RawRow {
  name: string;
  set: string;
  number: string;
  quantity: string;
  condition: string;
  finish: string;
  language: string;
  forTrade: string;
  scryfallId: string;
}

export function detectFormat(header: string[]): ImportFormat {
  const lower = new Set(header.map((cell) => cell.trim().toLowerCase()));
  if (lower.has('manabox id') || (lower.has('set code') && lower.has('scryfall id'))) {
    return 'manabox';
  }
  if (lower.has('edition') && lower.has('count')) return 'moxfield';
  return 'plain';
}

/** -1 means the column is absent; readRow treats it as blank. */
export function columnIndexes(
  header: string[],
  format: ImportFormat,
): Record<keyof RawRow, number> {
  const lower = header.map((cell) => cell.trim().toLowerCase());
  const find = (names: string[]) => {
    for (const name of names) {
      const at = lower.indexOf(name);
      if (at !== -1) return at;
    }
    return -1;
  };
  const columns = columnNames[format];
  return {
    name: find(columns.name),
    set: find(columns.set),
    number: find(columns.number),
    quantity: find(columns.quantity),
    condition: find(columns.condition),
    finish: find(columns.finish),
    language: find(columns.language),
    forTrade: find(columns.forTrade),
    scryfallId: find(columns.scryfallId),
  };
}

export function readRow(cells: string[], at: Record<keyof RawRow, number>): RawRow {
  const pick = (index: number) => (index === -1 ? '' : (cells[index] ?? '').trim());
  return {
    name: pick(at.name),
    set: pick(at.set),
    number: pick(at.number),
    quantity: pick(at.quantity),
    condition: pick(at.condition),
    finish: pick(at.finish),
    language: pick(at.language),
    forTrade: pick(at.forTrade),
    scryfallId: pick(at.scryfallId),
  };
}

const conditionWords: Record<string, CardCondition> = {
  nm: 'NM',
  'near mint': 'NM',
  near_mint: 'NM',
  mint: 'NM',
  m: 'NM',
  lp: 'LP',
  'lightly played': 'LP',
  lightly_played: 'LP',
  'light play': 'LP',
  'light played': 'LP',
  ex: 'LP',
  excellent: 'LP',
  mp: 'MP',
  'moderately played': 'MP',
  moderately_played: 'MP',
  'moderate play': 'MP',
  played: 'MP',
  pl: 'MP',
  gd: 'MP',
  good: 'MP',
  hp: 'HP',
  'heavily played': 'HP',
  heavily_played: 'HP',
  'heavy play': 'HP',
  poor: 'HP',
  dmg: 'DMG',
  damaged: 'DMG',
  d: 'DMG',
};

export function parseCondition(value: string): CardCondition {
  return conditionWords[value.trim().toLowerCase()] ?? 'NM';
}

export function parseFinish(value: string): CardFinish {
  const word = value.trim().toLowerCase();
  if (word === 'etched' || word === 'etched foil') return 'etched';
  if (word === 'foil' || word === 'true' || word === 'yes' || word === '1') return 'foil';
  return 'nonfoil';
}

const languageWords: Record<string, CardLanguage> = {
  english: 'en',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  italian: 'it',
  portuguese: 'pt',
  'portuguese (brazil)': 'pt',
  japanese: 'ja',
  korean: 'ko',
  russian: 'ru',
  'chinese simplified': 'zhs',
  'simplified chinese': 'zhs',
  'chinese traditional': 'zht',
  'traditional chinese': 'zht',
  hebrew: 'he',
  latin: 'la',
  'ancient greek': 'grc',
  arabic: 'ar',
  sanskrit: 'sa',
  phyrexian: 'ph',
  sp: 'es',
  jp: 'ja',
  kr: 'ko',
  cs: 'zhs',
  ct: 'zht',
  'zh-cn': 'zhs',
  'zh-tw': 'zht',
};

export function parseLanguage(value: string): CardLanguage {
  const word = value.trim().toLowerCase();
  if (!word) return 'en';
  const code = cardLanguageSchema.safeParse(word);
  if (code.success) return code.data;
  return languageWords[word] ?? 'en';
}

export function parseQuantity(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 1;
  const amount = Number(trimmed);
  if (!Number.isInteger(amount) || amount < 0) return null;
  return amount;
}

/** Blank uses the fallback; Moxfield tradelist counts are numeric. */
export function parseForTrade(value: string, fallback: boolean): boolean {
  const word = value.trim().toLowerCase();
  if (!word) return fallback;
  if (['true', 'yes', 'y', '1', 'x'].includes(word)) return true;
  if (['false', 'no', 'n', '0'].includes(word)) return false;
  const amount = Number(word);
  if (Number.isFinite(amount)) return amount > 0;
  return fallback;
}

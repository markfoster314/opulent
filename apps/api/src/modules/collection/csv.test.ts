import { describe, expect, it } from 'vitest';
import {
  columnIndexes,
  detectFormat,
  parseCondition,
  parseFinish,
  parseForTrade,
  parseLanguage,
  parseQuantity,
  readRow,
} from './csv';

const emptyAt = {
  name: -1,
  set: -1,
  number: -1,
  quantity: -1,
  condition: -1,
  finish: -1,
  language: -1,
  forTrade: -1,
  scryfallId: -1,
};

describe('detectFormat', () => {
  it('recognizes a manabox header', () => {
    expect(detectFormat(['Name', 'Set code', 'Scryfall ID'])).toBe('manabox');
    expect(detectFormat(['ManaBox ID'])).toBe('manabox');
  });

  it('recognizes a moxfield header', () => {
    expect(detectFormat(['Name', 'Edition', 'Count'])).toBe('moxfield');
  });

  it('uses the plain map for any other header', () => {
    expect(detectFormat(['Card', 'Set'])).toBe('plain');
  });
});

describe('columnIndexes', () => {
  it('finds a plain name column and leaves a missing column blank', () => {
    expect(columnIndexes(['Card Name', 'Qty'], 'plain').name).toBe(0);
    expect(columnIndexes(['Card Name'], 'plain').quantity).toBe(-1);
  });
});

describe('readRow', () => {
  it('trims a present cell and treats a missing column as blank', () => {
    expect(readRow([' Solitude '], { ...emptyAt, name: 0 })).toMatchObject({
      name: 'Solitude',
      set: '',
    });
  });
});

describe('parseCondition', () => {
  it.each([
    ['NM', 'NM'],
    ['near mint', 'NM'],
    ['mint', 'NM'],
    ['LP', 'LP'],
    ['excellent', 'LP'],
    ['played', 'MP'],
    ['good', 'MP'],
    ['heavily played', 'HP'],
    ['poor', 'HP'],
    ['damaged', 'DMG'],
    ['mystery', 'NM'],
  ])('reads %s as %s', (value, condition) => {
    expect(parseCondition(value)).toBe(condition);
  });
});

describe('parseFinish', () => {
  it.each([
    ['etched foil', 'etched'],
    ['foil', 'foil'],
    ['yes', 'foil'],
    ['1', 'foil'],
    ['', 'nonfoil'],
  ])('reads %s as %s', (value, finish) => {
    expect(parseFinish(value)).toBe(finish);
  });
});

describe('parseLanguage', () => {
  it.each([
    ['', 'en'],
    ['fr', 'fr'],
    ['french', 'fr'],
    ['portuguese (brazil)', 'pt'],
    ['jp', 'ja'],
    ['zh-cn', 'zhs'],
    ['klingon', 'en'],
  ])('reads %s as %s', (value, language) => {
    expect(parseLanguage(value)).toBe(language);
  });
});

describe('parseQuantity', () => {
  it('uses one when the cell is blank', () => {
    expect(parseQuantity('')).toBe(1);
    expect(parseQuantity(' 2 ')).toBe(2);
  });

  it('returns null when the cell is not a whole number', () => {
    expect(parseQuantity('1.5')).toBeNull();
    expect(parseQuantity('-1')).toBeNull();
  });
});

describe('parseForTrade', () => {
  it('uses the fallback when the cell is blank or unknown', () => {
    expect(parseForTrade('', true)).toBe(true);
    expect(parseForTrade('maybe', false)).toBe(false);
  });

  it('reads yes, no, and a count', () => {
    expect(parseForTrade('yes', false)).toBe(true);
    expect(parseForTrade('0', true)).toBe(false);
    expect(parseForTrade('3', false)).toBe(true);
  });
});

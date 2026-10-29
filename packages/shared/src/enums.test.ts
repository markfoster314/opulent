import { describe, expect, it } from 'vitest';
import { cardLanguageOrEnglish } from './enums';

describe('cardLanguageOrEnglish', () => {
  it('keeps a known code', () => {
    expect(cardLanguageOrEnglish('fr')).toBe('fr');
  });

  it('uses english when the code is not listed', () => {
    expect(cardLanguageOrEnglish('xx')).toBe('en');
  });
});

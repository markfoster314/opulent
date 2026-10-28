import { describe, expect, it } from 'vitest';
import { genericWantMatchKey, wantScopeKey } from './want';

describe('wantScopeKey', () => {
  it('is order-independent and normalizes choice case', () => {
    const a = wantScopeKey({
      wantedLanguages: ['FR', 'en'],
      wantedFinishes: ['foil'],
      wantedConditions: ['nm'],
      wantedSets: ['MH2'],
    });
    const b = wantScopeKey({
      wantedLanguages: ['en', 'fr'],
      wantedFinishes: ['foil'],
      wantedConditions: ['NM'],
      wantedSets: ['mh2'],
    });
    expect(a).toBe(b);
  });
});

describe('genericWantMatchKey', () => {
  it('changes when a mark changes', () => {
    const base = {
      languages: ['en' as const],
      finishes: [],
      conditions: [],
      sets: [],
      signed: false,
      altered: false,
      misprint: false,
      miscut: false,
      artistProof: false,
    };
    expect(genericWantMatchKey(base)).not.toBe(genericWantMatchKey({ ...base, signed: true }));
  });
});

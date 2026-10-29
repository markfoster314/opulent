import { describe, expect, it } from 'vitest';
import { describeGenericWant, describeWantScope, genericWantMatchKey, wantScopeKey } from './want';

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

describe('describeWantScope', () => {
  it('says any version when nothing is chosen', () => {
    expect(
      describeWantScope({
        wantedLanguages: [],
        wantedFinishes: [],
        wantedConditions: [],
        wantedSets: [],
      }),
    ).toBe('Any version');
  });

  it('names the chosen language, finish, and set', () => {
    expect(
      describeWantScope({
        wantedLanguages: ['en', 'zz'],
        wantedFinishes: ['foil'],
        wantedConditions: ['NM'],
        wantedSets: ['mh2'],
      }),
    ).toBe('English, ZZ, Foil, Near mint, MH2');
  });
});

describe('describeGenericWant', () => {
  it('names a set and the marks', () => {
    expect(
      describeGenericWant({
        languages: ['fr'],
        finishes: [],
        conditions: [],
        sets: [
          { setCode: 'mh2', setName: 'Modern Horizons 2' },
          { setCode: 'tst', setName: null },
        ],
        signed: true,
        altered: false,
        misprint: true,
        miscut: false,
        artistProof: true,
      }),
    ).toBe('French, Modern Horizons 2 (MH2), TST, Signed, Misprint, Artist proof');
  });
});

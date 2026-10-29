import { describe, expect, it } from 'vitest';
import { toCardRow, type ScryfallCard } from './scryfall';

const card: ScryfallCard = {
  id: '00000000-0000-4000-8000-000000000001',
  oracle_id: '00000000-0000-4000-8000-000000000002',
  name: 'Test Card',
  set: 'tst',
  set_name: 'Test Set',
  collector_number: '1',
  rarity: 'rare',
  lang: 'en',
  layout: 'normal',
  type_line: 'Instant',
  mana_cost: '{1}{U}',
  finishes: ['nonfoil'],
  image_uris: { normal: 'https://example.com/card.jpg' },
  prices: { usd: '1.00' },
  scryfall_uri: 'https://scryfall.com/card/tst/1',
  released_at: '2024-01-01',
};

describe('toCardRow', () => {
  it('promotes the fields the database needs', () => {
    const row = toCardRow(card);
    expect(row?.scryfallId).toBe(card.id);
    expect(row?.oracleId).toBe(card.oracle_id);
    expect(row?.imageUris).toEqual(card.image_uris);
  });

  it('uses the front face image for a double-faced card', () => {
    const row = toCardRow({
      ...card,
      image_uris: undefined,
      card_faces: [{ image_uris: { normal: 'https://example.com/front.jpg' } }],
    });
    expect(row?.imageUris).toEqual({ normal: 'https://example.com/front.jpg' });
  });

  it('skips cards without an oracle id', () => {
    expect(toCardRow({ ...card, oracle_id: undefined })).toBeNull();
  });

  it('fills blanks when the bulk row omits optional fields', () => {
    const row = toCardRow({
      id: card.id,
      oracle_id: card.oracle_id,
      name: card.name,
      set: card.set,
      collector_number: card.collector_number,
    });
    expect(row?.setName).toBeNull();
    expect(row?.lang).toBe('en');
    expect(row?.finishes).toEqual([]);
    expect(row?.imageUris).toBeNull();
    expect(row?.prices).toBeNull();
  });

  it('reads type and mana cost from the front face', () => {
    const row = toCardRow({
      ...card,
      type_line: undefined,
      mana_cost: undefined,
      card_faces: [{ type_line: 'Creature', mana_cost: '{G}' }],
    });
    expect(row?.typeLine).toBe('Creature');
    expect(row?.manaCost).toBe('{G}');
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { hasPendingAdd, readPendingAdd, savePendingAdd, takePendingAdd } from './pendingAdd';

const input = {
  scryfallId: '00000000-0000-4000-8000-000000000001',
  quantity: 1,
  finish: 'nonfoil' as const,
  condition: 'NM' as const,
  language: 'en' as const,
  forTrade: false,
  price: { kind: 'market' as const },
  signed: false,
  altered: false,
  misprint: false,
  miscut: false,
  artistProof: false,
};

afterEach(() => {
  window.sessionStorage.clear();
});

describe('pending add', () => {
  it('saves a draft and reads it back', () => {
    savePendingAdd(input, 'Solitude');
    expect(hasPendingAdd()).toBe(true);
    expect(readPendingAdd()).toMatchObject({ input, cardName: 'Solitude' });
  });

  it('removes the draft when it is taken', () => {
    savePendingAdd(input, 'Solitude');
    expect(takePendingAdd()?.cardName).toBe('Solitude');
    expect(readPendingAdd()).toBeNull();
    expect(hasPendingAdd()).toBe(false);
  });

  it('returns null when the stored text is not a draft', () => {
    window.sessionStorage.setItem('opulent-tutor.pending-add', '{');
    expect(readPendingAdd()).toBeNull();
    window.sessionStorage.setItem('opulent-tutor.pending-add', JSON.stringify({ cardName: 1 }));
    expect(readPendingAdd()).toBeNull();
  });

  it('returns null when the draft is older than thirty minutes', () => {
    window.sessionStorage.setItem(
      'opulent-tutor.pending-add',
      JSON.stringify({ input, cardName: 'Solitude', savedAt: Date.now() - 31 * 60 * 1000 }),
    );
    expect(readPendingAdd()).toBeNull();
  });
});

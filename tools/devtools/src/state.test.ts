import { beforeEach, describe, expect, it } from 'vitest';
import { initDevState, readDevState, resetDevState, writeDevState } from './state';

describe('dev state', () => {
  beforeEach(() => {
    localStorage.clear();
    initDevState({ mockApi: false, mockAuth: false });
    resetDevState();
  });

  it('starts with mocks off and a returning session', () => {
    expect(readDevState().mockApi).toBe(false);
    expect(readDevState().auth).toBe('returning');
    expect(readDevState().scenario).toBe('ok');
  });

  it('keeps the chosen values', () => {
    writeDevState({ scenario: '500', latencyMs: 2000, endpoints: { trades: 'offline' } });
    expect(readDevState().scenario).toBe('500');
    expect(readDevState().latencyMs).toBe(2000);
    expect(readDevState().endpoints.trades).toBe('offline');
  });

  it('ignores a stored value that is not a choice', () => {
    localStorage.setItem('ot-dev-state', JSON.stringify({ scenario: 'nope', latencyMs: 7 }));
    expect(readDevState().scenario).toBe('ok');
    expect(readDevState().latencyMs).toBe(0);
  });

  it('resets to the defaults', () => {
    writeDevState({ mockApi: true, auth: 'signedOut' });
    resetDevState();
    expect(readDevState().mockApi).toBe(false);
    expect(readDevState().auth).toBe('returning');
  });
});

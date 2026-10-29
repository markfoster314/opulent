import { describe, expect, it } from 'vitest';
import type { DevState } from '@opulent/devtools/state';
import { endpointFor, resolveMock } from './plan';

function state(patch: Partial<DevState> = {}): DevState {
  return {
    mockApi: true,
    mockAuth: true,
    auth: 'returning',
    scenario: 'ok',
    latencyMs: 0,
    endpoints: {},
    ...patch,
  };
}

describe('mock plan', () => {
  it('maps paths to endpoint groups', () => {
    expect(endpointFor('/v1/users/me')).toBe('account');
    expect(endpointFor('/v1/users/me/onboarding')).toBe('account');
    expect(endpointFor('/v1/users/friend_one')).toBe('profiles');
    expect(endpointFor('/v1/trades/abc')).toBe('trades');
    expect(endpointFor('/health')).toBeNull();
  });

  it('lets an endpoint rule beat the global scenario', () => {
    const plan = resolveMock({
      state: state({ scenario: '500', endpoints: { trades: 'real' } }),
      auth: 'returning',
      path: '/v1/trades',
    });
    expect(plan.kind).toBe('pass');
  });

  it('uses the endpoint status over a good global scenario', () => {
    const plan = resolveMock({
      state: state({ scenario: 'ok', endpoints: { collection: '404' } }),
      auth: 'returning',
      path: '/v1/collection/summary',
    });
    expect(plan).toEqual({ kind: 'status', status: 404 });
  });

  it('falls back to the global scenario', () => {
    expect(
      resolveMock({ state: state({ scenario: 'offline' }), auth: 'returning', path: '/v1/wants' }),
    ).toEqual({
      kind: 'network-error',
    });
    expect(
      resolveMock({ state: state({ scenario: 'timeout' }), auth: 'returning', path: '/v1/wants' }),
    ).toEqual({
      kind: 'timeout',
    });
    expect(
      resolveMock({ state: state({ scenario: 'empty' }), auth: 'returning', path: '/v1/wants' }),
    ).toEqual({
      kind: 'empty',
    });
  });

  it('signs out the account call', () => {
    const plan = resolveMock({ state: state(), auth: 'signedOut', path: '/v1/users/me' });
    expect(plan).toEqual({ kind: 'status', status: 401 });
  });

  it('keeps an unknown path on a fixture', () => {
    expect(resolveMock({ state: state(), auth: 'returning', path: '/v1/unknown' })).toEqual({
      kind: 'fixture',
    });
  });

  it('marks slow as a delayed fixture', () => {
    expect(
      resolveMock({ state: state({ scenario: 'slow' }), auth: 'returning', path: '/v1/trades' }),
    ).toEqual({
      kind: 'fixture',
      slow: true,
    });
  });
});

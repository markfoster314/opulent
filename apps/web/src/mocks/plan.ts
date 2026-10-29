import type { AuthPreset, DevState, EndpointId, EndpointRule } from '@opulent/devtools/state';

export interface MockPlan {
  kind: 'fixture' | 'empty' | 'status' | 'network-error' | 'timeout' | 'pass';
  status?: 401 | 404 | 500;
  slow?: boolean;
}

export const ENDPOINT_MATCHERS: readonly { id: EndpointId; match: (path: string) => boolean }[] = [
  { id: 'account', match: (path) => path === '/v1/users/me' || path.startsWith('/v1/users/me/') },
  { id: 'profiles', match: (path) => path.startsWith('/v1/users/') },
  { id: 'collection', match: (path) => path.startsWith('/v1/collection') },
  { id: 'wants', match: (path) => path.startsWith('/v1/wants') },
  { id: 'trades', match: (path) => path.startsWith('/v1/trades') },
  { id: 'matches', match: (path) => path === '/v1/matches' },
  { id: 'groups', match: (path) => path.startsWith('/v1/groups') },
  { id: 'cards', match: (path) => path.startsWith('/v1/cards') },
  { id: 'places', match: (path) => path.startsWith('/v1/places') },
];

export function endpointFor(path: string): EndpointId | null {
  for (const endpoint of ENDPOINT_MATCHERS) {
    if (endpoint.match(path)) return endpoint.id;
  }
  return null;
}

function planFromRule(rule: EndpointRule): MockPlan {
  switch (rule) {
    case 'ok':
      return { kind: 'fixture' };
    case 'slow':
      return { kind: 'fixture', slow: true };
    case 'empty':
      return { kind: 'empty' };
    case 'offline':
      return { kind: 'network-error' };
    case 'timeout':
      return { kind: 'timeout' };
    case '401':
      return { kind: 'status', status: 401 };
    case '404':
      return { kind: 'status', status: 404 };
    case '500':
      return { kind: 'status', status: 500 };
    case 'real':
      return { kind: 'pass' };
    case 'inherit':
      return { kind: 'fixture' };
  }
}

/** Endpoint rule wins, then the session rule, then the global scenario. */
export function resolveMock(input: { state: DevState; auth: AuthPreset; path: string }): MockPlan {
  const endpoint = endpointFor(input.path);
  const rule = endpoint ? (input.state.endpoints[endpoint] ?? 'inherit') : 'inherit';
  if (rule !== 'inherit') return planFromRule(rule);

  if (endpoint === 'account' && (input.auth === 'signedOut' || input.auth === 'tokenExpired')) {
    return { kind: 'status', status: 401 };
  }

  return planFromRule(input.state.scenario);
}

export const AUTH_PRESETS = [
  'signedOut',
  'newUser',
  'returning',
  'tokenExpired',
  'loading',
] as const;
export type AuthPreset = (typeof AUTH_PRESETS)[number];

export const SCENARIOS = [
  'ok',
  'empty',
  'slow',
  '401',
  '404',
  '500',
  'offline',
  'timeout',
] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const LATENCIES = [0, 500, 2000, 5000] as const;
export type Latency = (typeof LATENCIES)[number];

export const ENDPOINTS = [
  { id: 'account', label: 'Account' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'collection', label: 'Collection' },
  { id: 'wants', label: 'Wants' },
  { id: 'trades', label: 'Trades' },
  { id: 'matches', label: 'Matches' },
  { id: 'groups', label: 'Groups' },
  { id: 'cards', label: 'Cards' },
  { id: 'places', label: 'Places' },
] as const;
export type EndpointId = (typeof ENDPOINTS)[number]['id'];

export type EndpointRule = Scenario | 'inherit' | 'real';
export type DevEvent = 'trade' | 'match' | 'price' | 'refetch' | 'clear' | 'reset';

export interface DevState {
  mockApi: boolean;
  mockAuth: boolean;
  auth: AuthPreset;
  scenario: Scenario;
  latencyMs: Latency;
  endpoints: Partial<Record<EndpointId, EndpointRule>>;
}

export const DEV_STORAGE_KEY = 'ot-dev-state';
export const DEV_CHANNEL = 'ot-devtools';

let defaults: { mockApi: boolean; mockAuth: boolean } = { mockApi: false, mockAuth: false };
let cache: DevState | null = null;
const listeners = new Set<() => void>();

export function initDevState(next: { mockApi: boolean; mockAuth: boolean }): void {
  defaults = next;
  cache = null;
}

export function defaultDevState(): DevState {
  return {
    mockApi: defaults.mockApi,
    mockAuth: defaults.mockAuth,
    auth: 'returning',
    scenario: 'ok',
    latencyMs: 0,
    endpoints: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function readEndpoints(value: unknown): Partial<Record<EndpointId, EndpointRule>> {
  if (!isRecord(value)) return {};
  const allowed: readonly EndpointRule[] = [...SCENARIOS, 'inherit', 'real'];
  const result: Partial<Record<EndpointId, EndpointRule>> = {};
  for (const endpoint of ENDPOINTS) {
    const raw = value[endpoint.id];
    if (typeof raw === 'string' && (allowed as readonly string[]).includes(raw)) {
      result[endpoint.id] = raw as EndpointRule;
    }
  }
  return result;
}

function readLatency(value: unknown, fallback: Latency): Latency {
  return typeof value === 'number'
    ? (LATENCIES.find((option) => option === value) ?? fallback)
    : fallback;
}

function sanitize(value: unknown): DevState {
  const base = defaultDevState();
  if (!isRecord(value)) return base;
  return {
    mockApi: typeof value.mockApi === 'boolean' ? value.mockApi : base.mockApi,
    mockAuth: typeof value.mockAuth === 'boolean' ? value.mockAuth : base.mockAuth,
    auth: pick(value.auth, AUTH_PRESETS, base.auth),
    scenario: pick(value.scenario, SCENARIOS, base.scenario),
    latencyMs: readLatency(value.latencyMs, base.latencyMs),
    endpoints: readEndpoints(value.endpoints),
  };
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function readDevState(): DevState {
  if (cache) return cache;
  const raw = storage()?.getItem(DEV_STORAGE_KEY);
  if (!raw) {
    cache = defaultDevState();
    return cache;
  }
  try {
    cache = sanitize(JSON.parse(raw) as unknown);
  } catch {
    cache = defaultDevState();
  }
  return cache;
}

export function writeDevState(patch: Partial<DevState>): void {
  const current = readDevState();
  const next = sanitize({
    ...current,
    ...patch,
    endpoints: { ...current.endpoints, ...(patch.endpoints ?? {}) },
  });
  cache = next;
  storage()?.setItem(DEV_STORAGE_KEY, JSON.stringify(next));
  notify();
}

export function resetDevState(): void {
  storage()?.removeItem(DEV_STORAGE_KEY);
  cache = defaultDevState();
  notify();
}

export function subscribeDevState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== DEV_STORAGE_KEY) return;
    cache = null;
    notify();
  });
}

import type { AuthPreset, Latency, Scenario } from './state';

export const AUTH_LABELS: Record<AuthPreset, string> = {
  signedOut: 'Out',
  newUser: 'New',
  returning: 'Returning',
  tokenExpired: 'Expired',
  loading: 'Loading',
};

export const SCENARIO_LABELS: Record<Scenario, string> = {
  ok: 'Ok',
  empty: 'Empty',
  slow: 'Slow',
  '401': '401',
  '404': '404',
  '500': '500',
  offline: 'Offline',
  timeout: 'Timeout',
};

export const LATENCY_LABELS: Record<Latency, string> = {
  0: 'Off',
  500: '0.5 s',
  2000: '2 s',
  5000: '5 s',
};

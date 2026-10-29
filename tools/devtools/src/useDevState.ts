import { useSyncExternalStore } from 'react';
import { readDevState, subscribeDevState, type DevState } from './state';

export function useDevState(): DevState {
  return useSyncExternalStore(subscribeDevState, readDevState, readDevState);
}

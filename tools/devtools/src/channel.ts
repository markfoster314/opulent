import { DEV_CHANNEL, type DevEvent, type DevState } from './state';

export interface RequestEntry {
  id: number;
  tab: string;
  method: string;
  path: string;
  status: number;
  source: 'mock' | 'real';
}

export type DevMessage =
  | { type: 'hello' }
  | { type: 'snapshot'; state: DevState; entries: RequestEntry[] }
  | { type: 'request'; entry: RequestEntry }
  | { type: 'event'; name: DevEvent };

export interface DevChannel {
  post(message: DevMessage): void;
  close(): void;
}

/** Same-origin tabs only, so BroadcastChannel is enough; older browsers simply get no live log. */
export function createDevChannel(onMessage: (message: DevMessage) => void): DevChannel {
  if (typeof BroadcastChannel === 'undefined') {
    return { post: () => undefined, close: () => undefined };
  }

  const channel = new BroadcastChannel(DEV_CHANNEL);
  channel.onmessage = (event: MessageEvent<DevMessage>) => onMessage(event.data);

  return {
    post: (message) => channel.postMessage(message),
    close: () => {
      channel.onmessage = null;
      channel.close();
    },
  };
}

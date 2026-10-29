import type { QueryClient } from '@tanstack/react-query';
import { createDevChannel, type RequestEntry } from '@opulent/devtools/channel';
import {
  initDevState,
  readDevState,
  resetDevState,
  subscribeDevState,
  writeDevState,
  type AuthPreset,
  type DevEvent,
} from '@opulent/devtools/state';
import { currentAuthPreset, setAuthOverride, subscribeAuthOverride } from '@/app/session';

const MAX_ENTRIES = 50;

/** Runs in the app tab only; the console tab mounts through mount.tsx. */
export async function startDevAgent(queryClient: QueryClient): Promise<void> {
  const mockDefaults = import.meta.env.VITE_USE_MOCKS === 'true';
  initDevState({ mockApi: mockDefaults, mockAuth: mockDefaults });

  const tab = Math.random().toString(36).slice(2, 8);
  let sequence = 0;
  let entries: RequestEntry[] = [];

  const channel = createDevChannel((message) => {
    if (message.type === 'hello') {
      channel.post({ type: 'snapshot', state: readDevState(), entries });
    }
    if (message.type === 'event') {
      void runEvent(message.name);
    }
  });

  async function runEvent(name: DevEvent): Promise<void> {
    const live = await import('@/mocks/live');
    switch (name) {
      case 'trade':
        live.addTradeRequest();
        await queryClient.invalidateQueries({ queryKey: ['trades'] });
        break;
      case 'match':
        live.addMatch();
        await queryClient.invalidateQueries({ queryKey: ['matches'] });
        break;
      case 'price':
        live.bumpPrice();
        await queryClient.invalidateQueries({ queryKey: ['collection'] });
        break;
      case 'refetch':
        await queryClient.invalidateQueries();
        break;
      case 'clear':
        queryClient.clear();
        break;
      case 'reset':
        live.resetLive();
        resetDevState();
        await queryClient.resetQueries();
        break;
    }
  }

  const { worker } = await import('@/mocks/browser');

  let networkOn = false;
  let networkQueue: Promise<void> = Promise.resolve();

  function applyNetwork(on: boolean): Promise<void> {
    if (on === networkOn) return networkQueue;
    networkOn = on;
    networkQueue = networkQueue
      .then(async () => {
        if (on) {
          await worker.start({ onUnhandledFrame: 'bypass' });
        } else {
          await worker.stop();
        }
      })
      .catch((error: unknown) => {
        // Keep the toggle usable if the worker cannot start, for example after a stale registration.
        networkOn = !on;
        console.error('Dev mocks failed', error);
      });
    return networkQueue;
  }

  for (const type of ['response:mocked', 'response:bypass'] as const) {
    worker.events.on(type, ({ request, response }) => {
      const path = new URL(request.url).pathname;
      if (!path.startsWith('/v1/')) return;
      sequence += 1;
      const entry: RequestEntry = {
        id: sequence,
        tab,
        method: request.method,
        path,
        status: response.status,
        source: type === 'response:mocked' ? 'mock' : 'real',
      };
      entries = [entry, ...entries].slice(0, MAX_ENTRIES);
      channel.post({ type: 'request', entry });
    });
  }

  let lastPreset: AuthPreset | null | undefined;

  function applySession(): void {
    const state = readDevState();
    const next = state.mockAuth ? state.auth : null;
    if (lastPreset !== undefined && next !== lastPreset) {
      void import('@/mocks/live').then(({ resetLive }) => resetLive());
    }
    lastPreset = next;
    setAuthOverride(next);
  }

  subscribeDevState(() => {
    const state = readDevState();
    applySession();
    void applyNetwork(state.mockApi);
  });

  subscribeAuthOverride(() => {
    const preset = currentAuthPreset();
    const state = readDevState();
    if (preset && state.mockAuth && state.auth !== preset) {
      writeDevState({ auth: preset });
    }
  });

  applySession();
  await applyNetwork(readDevState().mockApi);
}

import type { AuthPreset } from '@opulent/devtools/state';
import { readDevState } from '@opulent/devtools/state';
import { HttpResponse, http } from 'msw/http';
import { delay } from 'msw/utils/delay';
import { passthrough } from 'msw/utils/passthrough';
import { currentAuthPreset } from '@/app/session';
import {
  emptySummary,
  mockCards,
  mockCollectionItem,
  mockGroup,
  mockHighlight,
  mockMe,
  mockNewUser,
  mockProfile,
  mockTradeBinder,
  mockTradeDetail,
  mockWantItem,
  mockWantList,
} from './fixtures';
import { live } from './live';
import { resolveMock } from './plan';

function errorBody(status: number, code: string, message: string) {
  return HttpResponse.json({ error: { code, message } }, { status });
}

function failureFor(status: 401 | 404 | 500) {
  if (status === 401) return errorBody(401, 'unauthorized', 'Sign in again.');
  if (status === 404) return errorBody(404, 'not_found', 'Not found.');
  return errorBody(500, 'internal_error', 'Something went wrong.');
}

function withoutLists(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const record = body as Record<string, unknown>;
  if (Array.isArray(record.items)) return { ...record, items: [] };
  if ('cardCount' in record) return emptySummary;
  if (Array.isArray(record.points)) return { ...record, points: [] };
  if (Array.isArray(record.buckets)) return { ...record, buckets: [], total: 0 };
  if (Array.isArray(record.gainers)) return { gainers: [], losers: [] };
  if (Array.isArray(record.youReceive)) return { ...record, youReceive: [], youGive: [] };
  return body;
}

function fixtureFor(path: string, url: URL, preset: AuthPreset | null): unknown {
  if (path === '/v1/users/me') {
    if (live.me) return live.me;
    return preset === 'newUser' ? mockNewUser : mockMe;
  }
  if (path === '/v1/users/me/username-available') {
    return {
      username: url.searchParams.get('username') ?? '',
      available: true,
      reason: null,
    };
  }
  if (path.endsWith('/trade-binder/items')) {
    return { items: [mockCollectionItem], nextCursor: null };
  }
  if (path.endsWith('/trade-binder')) return mockTradeBinder;
  if (path === '/v1/collection/summary') return live.summary;
  if (path === '/v1/collection/cards') return { items: [mockHighlight], nextCursor: null };
  if (path === '/v1/collection/highlights') return { items: [mockHighlight] };
  if (path === '/v1/collection/movers') return { gainers: [mockHighlight], losers: [] };
  if (path === '/v1/collection/value-history') {
    return {
      range: url.searchParams.get('range') ?? '1m',
      points: [{ date: '2026-10-01', value: 24 }],
    };
  }
  if (path === '/v1/collection/value-breakdown') {
    return {
      by: url.searchParams.get('by') ?? 'set',
      total: 24,
      buckets: [{ key: 'mh2', label: 'Modern Horizons 2', value: 24 }],
    };
  }
  if (path.startsWith('/v1/collection/items/')) return mockCollectionItem;
  if (path === '/v1/groups') return { items: [mockGroup] };
  if (/^\/v1\/groups\/[^/]+$/.test(path)) return mockGroup;
  if (path === '/v1/wants/lists') return { items: [mockWantList] };
  if (/^\/v1\/wants\/lists\/[^/]+$/.test(path)) return mockWantList;
  if (path === '/v1/wants/mine/items' || path.endsWith('/items')) {
    return { items: [mockWantItem] };
  }
  if (path === '/v1/matches') return { items: live.matches };
  if (path === '/v1/trades') return { items: live.trades };
  if (/^\/v1\/trades\/[^/]+$/.test(path)) return mockTradeDetail;
  if (path.endsWith('/choices')) return { items: [], mine: [] };
  if (path === '/v1/cards/search') return { items: mockCards };
  if (path.startsWith('/v1/cards/')) return mockCards[0];
  if (path.endsWith('/followers') || path.endsWith('/following')) {
    return { items: [{ username: 'friend_one', avatarUrl: null }] };
  }
  if (/^\/v1\/users\/[^/]+$/.test(path)) return mockProfile;
  return { items: [] };
}

export const handlers = [
  http.all(/\/v1\//, async ({ request }) => {
    const state = readDevState();
    const url = new URL(request.url);
    const path = url.pathname;
    const preset = currentAuthPreset();
    const plan = resolveMock({ state, auth: preset ?? 'returning', path });

    if (plan.slow) await delay(2000);
    else if (state.latencyMs > 0) await delay(state.latencyMs);

    if (plan.kind === 'pass') return passthrough();
    if (plan.kind === 'network-error') return HttpResponse.error();
    if (plan.kind === 'timeout') {
      await delay('infinite');
      return new HttpResponse(null);
    }
    if (plan.kind === 'status') return failureFor(plan.status ?? 500);

    if (request.method === 'POST' && path === '/v1/users/me/onboarding') {
      const body = (await request.json().catch(() => ({}))) as {
        username?: string;
        placeId?: number | null;
      };
      const base = live.me ?? mockNewUser;
      live.me = {
        ...base,
        username: body.username ?? base.username,
        onboarded: true,
        city: body.placeId ? { geonameId: body.placeId, label: 'Mock City' } : base.city,
      };
      return HttpResponse.json(live.me);
    }

    if (request.method === 'GET' && path.endsWith('.csv')) {
      const text = plan.kind === 'empty' ? '' : 'Name,Set,Quantity\nSolitude,mh2,1\n';
      return new HttpResponse(text, { headers: { 'Content-Type': 'text/csv' } });
    }

    if (request.method === 'GET') {
      const body = fixtureFor(path, url, preset);
      return HttpResponse.json(
        (plan.kind === 'empty' ? withoutLists(body) : body) as Record<string, unknown>,
      );
    }

    if (request.method === 'DELETE') return new HttpResponse(null, { status: 204 });

    try {
      return HttpResponse.json(await request.json());
    } catch {
      return HttpResponse.json({ ok: true });
    }
  }),
];

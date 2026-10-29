import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, createApiClient } from './client';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(status: number, body: unknown, statusText = 'OK') {
  return {
    status,
    ok: status >= 200 && status < 300,
    statusText,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(''),
  } as Response;
}

function firstFetchCall(mock: ReturnType<typeof vi.fn>): [URL, RequestInit] {
  const call = mock.mock.calls[0];
  expect(call).toBeDefined();
  expect(call).toHaveLength(2);
  return call as unknown as [URL, RequestInit];
}

describe('createApiClient', () => {
  it('sends a bearer token and returns the json body', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(200, { status: 'ok' })));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const request = createApiClient(() => Promise.resolve('token-1'));

    await expect(request('/v1/users/me')).resolves.toEqual({ status: 'ok' });

    const [url, init] = firstFetchCall(fetchMock);
    expect(String(url)).toBe('http://127.0.0.1:8787/v1/users/me');
    expect(init.headers).toMatchObject({
      Accept: 'application/json',
      Authorization: 'Bearer token-1',
    });
    expect(init.method).toBe('GET');
  });

  it('omits the token when the lookup returns nothing', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(200, { ok: true })));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const request = createApiClient(() => Promise.resolve(null));
    await request('/v1/health');
    const [, init] = firstFetchCall(fetchMock);
    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('adds a share token and a json body', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ status: 204, ok: true } as Response));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const request = createApiClient(() => Promise.resolve(null));
    const signal = new AbortController().signal;
    await expect(
      request('/v1/wants', {
        method: 'POST',
        body: { name: 'Trades' },
        shareToken: 'share-1',
        signal,
      }),
    ).resolves.toBeUndefined();
    const [url, init] = firstFetchCall(fetchMock);
    expect(String(url)).toBe('http://127.0.0.1:8787/v1/wants?t=share-1');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"name":"Trades"}');
    expect(init.signal).toBe(signal);
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
  });

  it('returns text when the caller asks for a download', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        status: 200,
        ok: true,
        text: () => Promise.resolve('a,b'),
      } as Response),
    ) as unknown as typeof fetch;
    const request = createApiClient(() => Promise.resolve(null));
    await expect(request<string>('/v1/collection.csv', { asText: true })).resolves.toBe('a,b');
  });

  it('throws the api error when the response is not ok', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        jsonResponse(404, { error: { code: 'not_found', message: 'Missing card' } }, 'Not Found'),
      ),
    ) as unknown as typeof fetch;
    const request = createApiClient(() => Promise.resolve(null));
    await expect(request('/v1/cards/1')).rejects.toMatchObject({
      name: 'ApiRequestError',
      status: 404,
      code: 'not_found',
      message: 'Missing card',
    } satisfies Partial<ApiRequestError>);
  });

  it('uses the status text when the error body is not json', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({
        status: 500,
        ok: false,
        statusText: 'Server Error',
        json: () => Promise.reject(new Error('not json')),
      } as Response),
    ) as unknown as typeof fetch;
    const request = createApiClient(() => Promise.resolve(null));
    await expect(request('/v1/boom')).rejects.toMatchObject({
      status: 500,
      code: 'internal_error',
      message: 'Server Error',
    });
  });
});

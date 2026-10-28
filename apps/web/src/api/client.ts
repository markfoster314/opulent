import type { ApiErrorBody } from '@opulent/shared';
import { env } from '@/app/env';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

export type TokenProvider = () => Promise<string | null>;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Share token for viewing an unlisted binder without signing in. */
  shareToken?: string;
  signal?: AbortSignal;
  /** Read as text instead of JSON, for downloads such as the CSV export. */
  asText?: boolean;
}

/** API client with injected token lookup, so Auth0 stays outside and tests can stub it. */
export function createApiClient(getToken: TokenProvider) {
  return async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = new URL(path, env.apiBaseUrl);
    if (options.shareToken) url.searchParams.set('t', options.shareToken);

    const headers: Record<string, string> = {
      Accept: options.asText ? 'text/csv, text/plain' : 'application/json',
    };
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';

    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });

    if (response.status === 204) return undefined as T;
    if (options.asText && response.ok) return (await response.text()) as T;

    const payload = (await response.json().catch(() => null)) as T | ApiErrorBody | null;

    if (!response.ok) {
      const failure = payload as ApiErrorBody | null;
      throw new ApiRequestError(
        response.status,
        failure?.error.code ?? 'internal_error',
        failure?.error.message ?? response.statusText,
      );
    }

    return payload as T;
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

import type { ApiErrorCode } from '@opulent/shared';
import { httpStatusByErrorCode } from '@opulent/shared';

/**
 * The only error type route handlers should throw. The error middleware turns it
 * into the response shape the web app expects.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = httpStatusByErrorCode[code];
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError('bad_request', message, details);
  }
  static unauthorized(message = 'Authentication required') {
    return new ApiError('unauthorized', message);
  }
  static forbidden(message = 'You do not have access to this resource') {
    return new ApiError('forbidden', message);
  }
  static notFound(message = 'Not found') {
    return new ApiError('not_found', message);
  }
  static conflict(message: string, details?: unknown) {
    return new ApiError('conflict', message, details);
  }
}

/** Turns "Mark's Trade Binder" into "marks-trade-binder". */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

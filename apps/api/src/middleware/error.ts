import type { ApiErrorBody } from '@opulent/shared';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import type { AppEnv } from '../lib/context';
import { ApiError } from '../lib/http';
import { errorText, log, redactEmails } from '../lib/log';

/** Single failure exit: hide internals from responses but log enough to debug. */
export function onError(error: Error, c: Context<AppEnv>): Response {
  if (error instanceof ApiError) {
    const body: ApiErrorBody = {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    };
    return c.json(body, error.status as 400);
  }

  if (error instanceof ZodError) {
    const body: ApiErrorBody = {
      error: { code: 'bad_request', message: 'Request validation failed', details: error.issues },
    };
    return c.json(body, 400);
  }

  if (error instanceof HTTPException) {
    const body: ApiErrorBody = {
      error: { code: 'bad_request', message: error.message },
    };
    return c.json(body, error.status as 400);
  }

  log.error(
    {
      requestId: c.get('requestId'),
      path: c.req.path,
      method: c.req.method,
      message: errorText(error),
      stack: error.stack ? redactEmails(error.stack) : undefined,
    },
    'unhandled_error',
  );

  const body: ApiErrorBody = {
    error: { code: 'internal_error', message: 'Something went wrong on our side' },
  };
  return c.json(body, 500);
}

export function onNotFound(c: Context): Response {
  const body: ApiErrorBody = {
    error: { code: 'not_found', message: `No route for ${c.req.method} ${c.req.path}` },
  };
  return c.json(body, 404);
}

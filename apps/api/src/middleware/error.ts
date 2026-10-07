import type { ApiErrorBody } from '@opulent/shared';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { ApiError } from '../lib/http';

/**
 * Single exit point for failures. Keeps internal messages and stack traces out
 * of responses while still logging enough to debug.
 */
export function onError(error: Error, c: Context): Response {
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

  console.error('unhandled_error', {
    path: c.req.path,
    method: c.req.method,
    message: error.message,
    stack: error.stack,
  });

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

import { zValidator as honoZValidator } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import type { ZodType } from 'zod';
import { ApiError } from './http';

/** Same call as zValidator. A failed check throws, so the error body matches every other failure. */
export function zValidator<T extends ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return honoZValidator(target, schema, (result) => {
    if (!result.success) {
      throw ApiError.badRequest('Request validation failed', result.error.issues);
    }
  });
}

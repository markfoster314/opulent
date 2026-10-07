import { z } from 'zod';

/**
 * Keyset pagination. The client sends back the opaque `nextCursor` it was given
 * rather than a page number, so inserts do not shift rows between pages.
 */
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

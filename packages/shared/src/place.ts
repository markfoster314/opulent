import { z } from 'zod';

/** Coordinates stay on the server: share links omit them and a radius search returns a distance, not a pin. */
export const placeRefSchema = z.object({
  geonameId: z.number().int().positive(),
  label: z.string(),
});
export type PlaceRef = z.infer<typeof placeRefSchema>;

export const placeIdSchema = z.number().int().positive();

export const placeSearchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters').max(80),
});
export type PlaceSearchQuery = z.infer<typeof placeSearchQuerySchema>;

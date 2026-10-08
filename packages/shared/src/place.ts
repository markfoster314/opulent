import { z } from 'zod';

/**
 * A city the picker can show and save.
 *
 * Coordinates stay on the server. A share link never includes them, and a
 * radius search returns a distance rather than another person's pin.
 */
export const placeRefSchema = z.object({
  geonameId: z.number().int().positive(),
  label: z.string(),
});
export type PlaceRef = z.infer<typeof placeRefSchema>;

/** The id of a GeoNames city, as stored on the user. */
export const placeIdSchema = z.number().int().positive();

export const placeSearchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Type at least 2 characters').max(80),
});
export type PlaceSearchQuery = z.infer<typeof placeSearchQuerySchema>;

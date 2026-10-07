import { z } from 'zod';
import { cardFinishSchema } from './enums';

/**
 * Scryfall serves several image sizes per card. We keep them all so the UI can
 * pick a small thumbnail for grids and a large scan for the detail view.
 */
export const cardImageUrisSchema = z.object({
  small: z.string().url().optional(),
  normal: z.string().url().optional(),
  large: z.string().url().optional(),
  png: z.string().url().optional(),
  art_crop: z.string().url().optional(),
  border_crop: z.string().url().optional(),
});
export type CardImageUris = z.infer<typeof cardImageUrisSchema>;

/** Daily estimates from Scryfall. Strings because they are decimal money values. */
export const cardPricesSchema = z.object({
  usd: z.string().nullable().optional(),
  usd_foil: z.string().nullable().optional(),
  usd_etched: z.string().nullable().optional(),
  eur: z.string().nullable().optional(),
  eur_foil: z.string().nullable().optional(),
  tix: z.string().nullable().optional(),
});
export type CardPrices = z.infer<typeof cardPricesSchema>;

/**
 * The slice of a Scryfall card we promote to real columns.
 *
 * `scryfallId` identifies one exact printing. `oracleId` identifies the card
 * concept across every printing. Binders hold printings; want lists hold
 * concepts, because most traders do not care which set a card came from.
 */
export const cardSchema = z.object({
  scryfallId: z.string().uuid(),
  oracleId: z.string().uuid(),
  name: z.string(),
  setCode: z.string(),
  setName: z.string().nullable(),
  collectorNumber: z.string(),
  rarity: z.string().nullable(),
  lang: z.string(),
  layout: z.string().nullable(),
  typeLine: z.string().nullable(),
  manaCost: z.string().nullable(),
  finishes: z.array(cardFinishSchema),
  imageUris: cardImageUrisSchema.nullable(),
  prices: cardPricesSchema.nullable(),
  scryfallUri: z.string().nullable(),
  releasedAt: z.string().nullable(),
});
export type Card = z.infer<typeof cardSchema>;

export const cardSearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  /** Collapse results to one row per card concept instead of one per printing. */
  uniqueByOracle: z.coerce.boolean().default(false),
});
export type CardSearchQuery = z.infer<typeof cardSearchQuerySchema>;

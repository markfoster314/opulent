import { z } from 'zod';
import { cardFinishSchema, cardLanguageSchema, type CardFinish } from './enums';

/** Every Scryfall image size, so the UI can pick a grid thumbnail or a detail scan. */
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

/** One exact printing; a single type so a future rename to `printingId` is one pass, while clients and the database column keep `scryfallId`. */
export const printingIdSchema = z.string().uuid();
export type PrintingId = z.infer<typeof printingIdSchema>;

/** The Scryfall fields we promote to columns; binders hold printings, while want lists hold oracle concepts. */
export const cardSchema = z.object({
  scryfallId: printingIdSchema,
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
  oracleText: z.string().nullable().optional(),
  artist: z.string().nullable().optional(),
  /** Shop links from Scryfall; a missing field means that shop has no page. */
  purchaseUris: z
    .object({
      tcgplayer: z.string().nullable().optional(),
      cardmarket: z.string().nullable().optional(),
      cardhoarder: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  releasedAt: z.string().nullable(),
});
export type Card = z.infer<typeof cardSchema>;

export const setSearchQuerySchema = z.object({
  q: z.string().trim().min(2).max(80),
  limit: z.coerce.number().int().min(1).max(30).default(15),
});
export type SetSearchQuery = z.infer<typeof setSearchQuerySchema>;

export const cardSearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  /** Collapse results to one row per card concept instead of one per printing. */
  uniqueByOracle: z.coerce.boolean().default(false),
});
export type CardSearchQuery = z.infer<typeof cardSearchQuerySchema>;

export const cardPrintingsQuerySchema = z.object({
  /** Narrows by set name or code; Plains has over 900 printings, so scrolling cannot find one. */
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(60),
  cursor: z.string().optional(),
});
export type CardPrintingsQuery = z.infer<typeof cardPrintingsQuerySchema>;

export const cardSetSchema = z.object({
  setCode: z.string(),
  setName: z.string().nullable(),
});
export type CardSet = z.infer<typeof cardSetSchema>;

export const cardChoicesSchema = z.object({
  languages: z.array(cardLanguageSchema),
  finishes: z.array(cardFinishSchema),
  sets: z.array(cardSetSchema),
});
export type CardChoices = z.infer<typeof cardChoicesSchema>;

/** Foils are priced separately, so reading `usd` alone is misleading: a foil-only printing has no `usd` and would look free. */
export function priceForFinish(
  prices: CardPrices | null | undefined,
  finish: CardFinish,
): string | null {
  if (!prices) return null;
  if (finish === 'foil') return prices.usd_foil ?? null;
  if (finish === 'etched') return prices.usd_etched ?? null;
  return prices.usd ?? null;
}

const marketPriceFields = ['usd', 'usd_foil', 'usd_etched', 'eur', 'eur_foil', 'tix'] as const;

/** Scryfall prices only the English row, so each missing finish on a foreign printing falls back to the English price. */
export function marketPrices(
  prices: CardPrices | null | undefined,
  englishPrices: CardPrices | null | undefined,
): CardPrices | null {
  const merged: CardPrices = {};
  let any = false;
  for (const field of marketPriceFields) {
    const own = prices?.[field];
    const fallback = englishPrices?.[field];
    const value = (own || null) ?? (fallback || null);
    if (!value) continue;
    merged[field] = value;
    any = true;
  }
  return any ? merged : null;
}

/** Formats a Scryfall money string; null is a normal answer, since about a quarter of printings were never priced. */
export function formatUsd(value: string | null | undefined): string | null {
  if (!value) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export const priceRangeSchema = z.enum(['1w', '1m', '6m', '1y']);
export type PriceRange = z.infer<typeof priceRangeSchema>;

/** Days back per window; one source for the API and the client. */
export const priceRangeDays: Record<PriceRange, number> = {
  '1w': 7,
  '1m': 30,
  '6m': 182,
  '1y': 365,
};

/** One day of prices; history carries the last known price forward. */
export const cardPricePointSchema = z.object({
  recordedOn: z.string(),
  prices: cardPricesSchema,
});
export type CardPricePoint = z.infer<typeof cardPricePointSchema>;

export const cardPriceSeriesSchema = z.object({
  range: priceRangeSchema,
  points: z.array(cardPricePointSchema),
});
export type CardPriceSeries = z.infer<typeof cardPriceSeriesSchema>;

export const cardPriceSeriesQuerySchema = z.object({
  range: priceRangeSchema.default('1y'),
});

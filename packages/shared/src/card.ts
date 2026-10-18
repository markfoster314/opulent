import { z } from 'zod';
import { cardFinishSchema, cardLanguageSchema, type CardFinish } from './enums';

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
  /**
   * Shop links Scryfall attaches to this printing. A field is missing when that
   * shop has no page for the card.
   */
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

export const cardSearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  /** Collapse results to one row per card concept instead of one per printing. */
  uniqueByOracle: z.coerce.boolean().default(false),
});
export type CardSearchQuery = z.infer<typeof cardSearchQuerySchema>;

export const cardPrintingsQuerySchema = z.object({
  /**
   * Narrows by set name or set code. Not a nicety: Plains has over 900
   * printings, and scrolling is not a realistic way to find one of them.
   */
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(60),
  cursor: z.string().optional(),
});
export type CardPrintingsQuery = z.infer<typeof cardPrintingsQuerySchema>;

/** One set a card was printed in. The picker uses this for the set dropdown. */
export const cardSetSchema = z.object({
  setCode: z.string(),
  setName: z.string().nullable(),
});
export type CardSet = z.infer<typeof cardSetSchema>;

/** Languages, finishes, and sets a card concept was printed in. The want form uses this. */
export const cardChoicesSchema = z.object({
  languages: z.array(cardLanguageSchema),
  finishes: z.array(cardFinishSchema),
  sets: z.array(cardSetSchema),
});
export type CardChoices = z.infer<typeof cardChoicesSchema>;

/**
 * The price that applies to one finish of one printing.
 *
 * Foils are priced separately and the gap is large, so reading `usd` alone is
 * actively misleading. A foil-only Secret Lair printing has no `usd` at all,
 * and would look free.
 */
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

/**
 * The market price for a finish.
 *
 * Scryfall prices the English printing. A foreign row of the same set and
 * collector number usually has that field empty, so the English price fills
 * the gap. A price that is present on the foreign printing stays, one finish
 * at a time.
 */
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

/**
 * Formats a Scryfall money string for display, or returns null when there is no
 * price. Roughly a quarter of printings have never been priced, so "no price"
 * is a normal outcome rather than an error.
 */
export function formatUsd(value: string | null | undefined): string | null {
  if (!value) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

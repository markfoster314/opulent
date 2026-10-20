import { z } from 'zod';
import {
  binderVisibilitySchema,
  cardConditionSchema,
  cardFinishSchema,
  cardLanguageSchema,
  type CardFinish,
} from './enums';
import { cardSchema, priceForFinish, type CardPrices } from './card';
import { paginationQuerySchema } from './pagination';

/** Lowercase letters, numbers and single hyphens. Used in share URLs. */
export const slugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only');

export const binderSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  slug: slugSchema,
  name: z.string(),
  description: z.string().nullable(),
  visibility: binderVisibilitySchema,
  itemCount: z.number().int().nonnegative().optional(),
  /** Present only when the caller owns the binder. Strangers never receive it. */
  shareToken: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Binder = z.infer<typeof binderSchema>;

/** A dollar string from $0.01 to $99,999.99, normalized to cents. */
export function parseCustomAmount(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{1,5}(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0.01 || amount > 99999.99) return null;
  return amount.toFixed(2);
}

/**
 * How this stack is priced.
 *
 * `percent` is a share of the stored market price, from 0 to 100. `custom` is a
 * dollar amount for this stack alone.
 */
export const itemPriceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('market') }),
  z.object({
    kind: z.literal('percent'),
    percent: z.number().int().min(0).max(100),
  }),
  z.object({
    kind: z.literal('custom'),
    amount: z.string().refine((value) => parseCustomAmount(value) !== null, {
      message: 'Use a price from $0.01 to $99,999.99.',
    }),
  }),
]);
export type ItemPrice = z.infer<typeof itemPriceSchema>;

const PHOTO_LINK_MAX = 2000;

/**
 * A page of photos on an image host. Blank is no link. Anything else must be
 * an http or https address, so a pasted sentence cannot be stored as a link.
 */
export function parsePhotoLink(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > PHOTO_LINK_MAX) return null;
  if (!/^https?:\/\/\S+$/i.test(trimmed)) return null;
  return trimmed;
}

export const photoLinkSchema = z
  .string()
  .trim()
  .max(PHOTO_LINK_MAX)
  .refine((value) => parsePhotoLink(value) !== null, {
    message: 'Paste a link that starts with http:// or https://.',
  });

/**
 * The dollar amount the owner is asking, before quantity.
 *
 * A percent with no stored market price has no dollar amount yet.
 */
export function askingPrice(market: string | null | undefined, price: ItemPrice): string | null {
  if (price.kind === 'custom') return parseCustomAmount(price.amount);
  if (price.kind === 'market') return market ?? null;
  if (!market) return null;
  const cents = Math.round(Number(market) * 100);
  if (!Number.isFinite(cents)) return null;
  return (Math.round((cents * price.percent) / 100) / 100).toFixed(2);
}

/** Asking price for one finish, using the market price stored for that finish. */
export function askingPriceForFinish(
  prices: CardPrices | null | undefined,
  finish: CardFinish,
  price: ItemPrice,
): string | null {
  return askingPrice(priceForFinish(prices, finish), price);
}

export const createBinderSchema = z.object({
  name: z.string().min(1).max(80),
  slug: slugSchema.optional(),
  description: z.string().max(500).optional(),
  visibility: binderVisibilitySchema.default('private'),
});
export type CreateBinderInput = z.infer<typeof createBinderSchema>;

export const updateBinderSchema = createBinderSchema.partial();
export type UpdateBinderInput = z.infer<typeof updateBinderSchema>;

export const binderItemSchema = z.object({
  id: z.string().uuid(),
  binderId: z.string().uuid(),
  scryfallId: z.string().uuid(),
  quantity: z.number().int().positive(),
  finish: cardFinishSchema,
  condition: cardConditionSchema,
  language: cardLanguageSchema,
  notes: z.string().nullable(),
  /** A page of photos of this physical copy. Empty when the owner has not added one. */
  photoUrl: z.string().nullable(),
  forTrade: z.boolean(),
  signed: z.boolean(),
  altered: z.boolean(),
  misprint: z.boolean(),
  miscut: z.boolean(),
  artistProof: z.boolean(),
  /** How the owner priced this stack. Older rows are full market. */
  price: itemPriceSchema,
  card: cardSchema.optional(),
  /**
   * Which finishes this printing was actually produced in. The edit form uses
   * it to avoid offering, say, etched foil for a card that never had one.
   */
  availableFinishes: z.array(cardFinishSchema).optional(),
});
export type BinderItem = z.infer<typeof binderItemSchema>;

export const addBinderItemSchema = z.object({
  scryfallId: z.string().uuid(),
  quantity: z.number().int().positive().max(999).default(1),
  finish: cardFinishSchema.default('nonfoil'),
  condition: cardConditionSchema.default('NM'),
  language: cardLanguageSchema.default('en'),
  signed: z.boolean().default(false),
  altered: z.boolean().default(false),
  misprint: z.boolean().default(false),
  miscut: z.boolean().default(false),
  artistProof: z.boolean().default(false),
  notes: z.string().max(280).optional(),
  photoUrl: photoLinkSchema.nullable().optional(),
  forTrade: z.boolean().default(true),
  price: itemPriceSchema.default({ kind: 'market' }),
});
export type AddBinderItemInput = z.infer<typeof addBinderItemSchema>;

export const updateBinderItemSchema = addBinderItemSchema.partial().omit({ scryfallId: true });
export type UpdateBinderItemInput = z.infer<typeof updateBinderItemSchema>;

/**
 * One row of the headline feature: a card the viewer wants that the binder
 * owner is holding for trade.
 */
export const tradeMatchSchema = z.object({
  wantId: z.string().uuid(),
  oracleId: z.string().uuid(),
  cardName: z.string(),
  wantQuantity: z.number().int().positive(),
  wantPriority: z.number().int(),
  availableQuantity: z.number().int().positive(),
  printings: z.array(binderItemSchema),
});
export type TradeMatch = z.infer<typeof tradeMatchSchema>;

/** Rarities a binder search can narrow to. These are the ones Scryfall prints on a card. */
export const binderRaritySchema = z.enum([
  'common',
  'uncommon',
  'rare',
  'mythic',
  'special',
  'bonus',
]);
export type BinderRarity = z.infer<typeof binderRaritySchema>;

export const binderRarityLabels: Record<BinderRarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  mythic: 'Mythic',
  special: 'Special',
  bonus: 'Bonus',
};

function blankToUndefined(value: unknown) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** A checked box arrives as the string "true". Missing means leave that rule off. */
function queryFlag() {
  return z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true');
}

/**
 * Filters for the cards inside a binder.
 *
 * Name and set are typed text. The rest pick one value, or a mark that must be present.
 * `onWantList` keeps cards that sit on one of the signed-in viewer's want lists.
 */
export const binderItemQuerySchema = paginationQuerySchema.extend({
  q: z.preprocess(blankToUndefined, z.string().max(80).optional()),
  set: z.preprocess(blankToUndefined, z.string().max(80).optional()),
  finish: z.preprocess(blankToUndefined, cardFinishSchema.optional()),
  condition: z.preprocess(blankToUndefined, cardConditionSchema.optional()),
  language: z.preprocess(blankToUndefined, cardLanguageSchema.optional()),
  rarity: z.preprocess(blankToUndefined, binderRaritySchema.optional()),
  forTrade: queryFlag(),
  signed: queryFlag(),
  altered: queryFlag(),
  misprint: queryFlag(),
  miscut: queryFlag(),
  artistProof: queryFlag(),
  onWantList: queryFlag(),
});
export type BinderItemQuery = z.infer<typeof binderItemQuerySchema>;

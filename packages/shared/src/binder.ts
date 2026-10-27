import { z } from 'zod';
import {
  binderVisibilitySchema,
  cardConditionSchema,
  cardFinishSchema,
  cardLanguageSchema,
  type CardFinish,
} from './enums';
import { cardSchema, priceForFinish, printingIdSchema, type CardPrices } from './card';
import { paginationQuerySchema } from './pagination';

/** Lowercase letters, numbers and single hyphens. Used in share URLs. */
export const slugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only');

/**
 * A named lump of cards from someone's collection.
 *
 * Groups are private labels: a card can sit in several or none, and there is no
 * link to share. The public surface is the trade binder, built from the cards
 * marked for trade.
 */
export const cardGroupSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  /** Copies in the group. Present when the caller asked for it. */
  itemCount: z.number().int().nonnegative().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CardGroup = z.infer<typeof cardGroupSchema>;

/** The group chip shown on a collection item. */
export const groupRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});
export type GroupRef = z.infer<typeof groupRefSchema>;

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

export const createCardGroupSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).optional(),
});
export type CreateCardGroupInput = z.infer<typeof createCardGroupSchema>;

export const updateCardGroupSchema = createCardGroupSchema.partial();
export type UpdateCardGroupInput = z.infer<typeof updateCardGroupSchema>;

/**
 * One stack in a person's collection. `groups` is every group the owner has put
 * it in, and may be empty. `forTrade` puts it in the public trade binder.
 */
export const collectionItemSchema = z.object({
  id: z.string().uuid(),
  scryfallId: printingIdSchema,
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
  /** The groups this stack sits in. Empty when it is filed nowhere. */
  groups: z.array(groupRefSchema),
  card: cardSchema.optional(),
  /**
   * Which finishes this printing was actually produced in. The edit form uses
   * it to avoid offering, say, etched foil for a card that never had one.
   */
  availableFinishes: z.array(cardFinishSchema).optional(),
});
export type CollectionItem = z.infer<typeof collectionItemSchema>;

export const addCollectionItemSchema = z.object({
  scryfallId: printingIdSchema,
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
  /** A personal collection starts private; the owner marks cards for trade. */
  forTrade: z.boolean().default(false),
  price: itemPriceSchema.default({ kind: 'market' }),
});
export type AddCollectionItemInput = z.infer<typeof addCollectionItemSchema>;

export const updateCollectionItemSchema = addCollectionItemSchema
  .partial()
  .omit({ scryfallId: true });
export type UpdateCollectionItemInput = z.infer<typeof updateCollectionItemSchema>;

/** The numbers at the top of the collection page. */
export const collectionSummarySchema = z.object({
  /** Total copies across every stack. */
  cardCount: z.number().int().nonnegative(),
  /** Copies marked for trade. */
  forTradeCount: z.number().int().nonnegative(),
  /** Market value of every copy, as a dollar string. Copies with no price add nothing. */
  marketValue: z.string(),
  /** Market value of the copies marked for trade. */
  forTradeValue: z.string(),
});
export type CollectionSummary = z.infer<typeof collectionSummarySchema>;

/** One row of the most expensive cards table on the collection dashboard. */
export const collectionHighlightSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  /** Short set code, for the narrow column. */
  setCode: z.string(),
  finish: cardFinishSchema,
  quantity: z.number().int().positive(),
  imageUrl: z.string().nullable(),
  /** Asking price for one copy, in dollars. Null when no price is known. */
  price: z.string().nullable(),
  /** Dollars gained or lost in the past week. Null means no change, or nothing to compare. */
  weekChange: z.string().nullable(),
});
export type CollectionHighlight = z.infer<typeof collectionHighlightSchema>;

export const collectionHighlightsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type CollectionHighlightsQuery = z.infer<typeof collectionHighlightsQuerySchema>;

/** What a visitor learns about a trade binder before the cards load. */
export const tradeBinderSchema = z.object({
  username: z.string(),
  visibility: binderVisibilitySchema,
  /** Total copies marked for trade. */
  cardCount: z.number().int().nonnegative(),
  /** Present only for the owner. */
  shareToken: z.string().optional(),
});
export type TradeBinder = z.infer<typeof tradeBinderSchema>;

/**
 * One row of the headline feature: a card the viewer wants that the collection
 * owner is holding for trade.
 */
export const tradeMatchSchema = z.object({
  wantId: z.string().uuid(),
  oracleId: z.string().uuid(),
  cardName: z.string(),
  wantQuantity: z.number().int().positive(),
  wantPriority: z.number().int(),
  availableQuantity: z.number().int().positive(),
  printings: z.array(collectionItemSchema),
});
export type TradeMatch = z.infer<typeof tradeMatchSchema>;

/** One person who holds cards on the viewer's want lists. The Find trades page shows one per paper. */
export const matchOwnerSchema = z.object({
  username: z.string(),
  /** Their saved city, or null if they did not set one. */
  city: z.string().nullable(),
  /** Meters from the viewer's city. Null when either side has no city. */
  distanceMeters: z.number().int().nonnegative().nullable(),
  /** How many distinct wants of the viewer this person can fill. */
  matchCount: z.number().int().positive(),
  /** A few of the card names, for the paper. */
  cardNames: z.array(z.string()),
});
export type MatchOwner = z.infer<typeof matchOwnerSchema>;

export const matchesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type MatchesQuery = z.infer<typeof matchesQuerySchema>;

/** Rarities a collection search can narrow to. These are the ones Scryfall prints on a card. */
export const cardRaritySchema = z.enum([
  'common',
  'uncommon',
  'rare',
  'mythic',
  'special',
  'bonus',
]);
export type CardRarity = z.infer<typeof cardRaritySchema>;

export const cardRarityLabels: Record<CardRarity, string> = {
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
 * Filters for the cards inside a collection or a group.
 *
 * Name and set are typed text. The rest pick one value, or a mark that must be present.
 * `onWantList` keeps cards that sit on one of the signed-in viewer's want lists.
 */
export const collectionItemQuerySchema = paginationQuerySchema.extend({
  q: z.preprocess(blankToUndefined, z.string().max(80).optional()),
  set: z.preprocess(blankToUndefined, z.string().max(80).optional()),
  finish: z.preprocess(blankToUndefined, cardFinishSchema.optional()),
  condition: z.preprocess(blankToUndefined, cardConditionSchema.optional()),
  language: z.preprocess(blankToUndefined, cardLanguageSchema.optional()),
  rarity: z.preprocess(blankToUndefined, cardRaritySchema.optional()),
  forTrade: queryFlag(),
  signed: queryFlag(),
  altered: queryFlag(),
  misprint: queryFlag(),
  miscut: queryFlag(),
  artistProof: queryFlag(),
  onWantList: queryFlag(),
});
export type CollectionItemQuery = z.infer<typeof collectionItemQuerySchema>;

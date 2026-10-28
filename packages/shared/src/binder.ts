import { z } from 'zod';
import {
  binderVisibilitySchema,
  cardConditionSchema,
  cardFinishSchema,
  cardLanguageSchema,
  type CardFinish,
} from './enums';
import {
  cardSchema,
  priceForFinish,
  priceRangeSchema,
  printingIdSchema,
  type CardPrices,
} from './card';
import { paginationQuerySchema } from './pagination';

export const slugSchema = z
  .string()
  .min(3)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens only');

/** Private labels with no share link; the trade binder is the only public surface. */
export const cardGroupSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  itemCount: z.number().int().nonnegative().optional(),
  value: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CardGroup = z.infer<typeof cardGroupSchema>;

export const groupRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
});
export type GroupRef = z.infer<typeof groupRefSchema>;

export function parseCustomAmount(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{1,5}(?:\.\d{1,2})?$/.test(trimmed)) return null;
  const amount = Number(trimmed);
  if (!Number.isFinite(amount) || amount < 0.01 || amount > 99999.99) return null;
  return amount.toFixed(2);
}

/** `percent` scales the stored market price; `custom` is a flat dollar amount for this stack. */
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

/** Only http(s) addresses are stored, so a pasted sentence cannot become a link. */
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

/** Asking price before quantity; a percent with no stored market price has none yet. */
export function askingPrice(market: string | null | undefined, price: ItemPrice): string | null {
  if (price.kind === 'custom') return parseCustomAmount(price.amount);
  if (price.kind === 'market') return market ?? null;
  if (!market) return null;
  const cents = Math.round(Number(market) * 100);
  if (!Number.isFinite(cents)) return null;
  return (Math.round((cents * price.percent) / 100) / 100).toFixed(2);
}

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

/** `groups` may be empty; `forTrade` is what puts a stack in the public binder. */
export const collectionItemSchema = z.object({
  id: z.string().uuid(),
  scryfallId: printingIdSchema,
  quantity: z.number().int().positive(),
  finish: cardFinishSchema,
  condition: cardConditionSchema,
  language: cardLanguageSchema,
  notes: z.string().nullable(),
  photoUrl: z
    .string()
    .nullable()
    .transform((value) => (value ? parsePhotoLink(value) : null)),
  forTrade: z.boolean(),
  signed: z.boolean(),
  altered: z.boolean(),
  misprint: z.boolean(),
  miscut: z.boolean(),
  artistProof: z.boolean(),
  /** How this stack is priced; older rows are full market. */
  price: itemPriceSchema,
  /** The groups this stack sits in. Empty when it is filed nowhere. */
  groups: z.array(groupRefSchema),
  card: cardSchema.optional(),
  /** Finishes this printing actually came in, so the edit form cannot offer a wrong one. */
  availableFinishes: z.array(cardFinishSchema).optional(),
});
export type CollectionItem = z.infer<typeof collectionItemSchema>;

export const NOTES_MAX_LENGTH = 280;

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
  notes: z.string().max(NOTES_MAX_LENGTH).optional(),
  photoUrl: photoLinkSchema.nullable().optional(),
  /** Collections start private; the owner opts in to trade. */
  forTrade: z.boolean().default(false),
  price: itemPriceSchema.default({ kind: 'market' }),
  groupIds: z.array(z.string().uuid()).max(50).optional(),
});
export type AddCollectionItemInput = z.infer<typeof addCollectionItemSchema>;

export const updateCollectionItemSchema = addCollectionItemSchema
  .partial()
  .omit({ scryfallId: true });
export type UpdateCollectionItemInput = z.infer<typeof updateCollectionItemSchema>;

export const splitCollectionItemSchema = updateCollectionItemSchema.omit({ quantity: true });
export type SplitCollectionItemInput = z.infer<typeof splitCollectionItemSchema>;

export const collectionSummarySchema = z.object({
  cardCount: z.number().int().nonnegative(),
  forTradeCount: z.number().int().nonnegative(),
  /** Sum of asking prices in dollars; copies with no price add nothing. */
  marketValue: z.string(),
  forTradeValue: z.string(),
  onTheTable: z.number().int().nonnegative(),
});
export type CollectionSummary = z.infer<typeof collectionSummarySchema>;

export const collectionHighlightSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  setCode: z.string(),
  finish: cardFinishSchema,
  quantity: z.number().int().positive(),
  forTrade: z.boolean(),
  signed: z.boolean(),
  altered: z.boolean(),
  misprint: z.boolean(),
  miscut: z.boolean(),
  artistProof: z.boolean(),
  imageUrl: z.string().nullable(),
  price: z.string().nullable(),
  /** Null means no change, or nothing to compare. */
  change: z.string().nullable(),
  changePercent: z.string().nullable(),
});
export type CollectionHighlight = z.infer<typeof collectionHighlightSchema>;

export const collectionHighlightsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type CollectionHighlightsQuery = z.infer<typeof collectionHighlightsQuerySchema>;

export const tradeBinderSchema = z.object({
  username: z.string(),
  visibility: binderVisibilitySchema,
  cardCount: z.number().int().nonnegative(),
  /** Only the owner receives it. */
  shareToken: z.string().optional(),
});
export type TradeBinder = z.infer<typeof tradeBinderSchema>;

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

export const matchOwnerSchema = z.object({
  username: z.string(),
  city: z.string().nullable(),
  /** Meters from the viewer's city; null when either side has no city. */
  distanceMeters: z.number().int().nonnegative().nullable(),
  matchCount: z.number().int().positive(),
  cardNames: z.array(z.string()),
});
export type MatchOwner = z.infer<typeof matchOwnerSchema>;

export const matchesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type MatchesQuery = z.infer<typeof matchesQuerySchema>;

/** The rarity values Scryfall prints; collection search narrows to these. */
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

/** Query strings carry "true"/"false"; missing means leave the rule off. */
function queryFlag() {
  return z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true');
}

/** `onWantList` and `onGenericWant` are mutually exclusive in the UI. */
export const collectionItemQuerySchema = paginationQuerySchema.extend({
  q: z.preprocess(blankToUndefined, z.string().max(80).optional()),
  set: z.preprocess(blankToUndefined, z.string().max(80).optional()),
  finish: z.preprocess(blankToUndefined, cardFinishSchema.optional()),
  condition: z.preprocess(blankToUndefined, cardConditionSchema.optional()),
  language: z.preprocess(blankToUndefined, cardLanguageSchema.optional()),
  rarity: z.preprocess(blankToUndefined, cardRaritySchema.optional()),
  type: z.preprocess(blankToUndefined, z.string().max(80).optional()),
  artist: z.preprocess(blankToUndefined, z.string().max(120).optional()),
  groupId: z.preprocess(blankToUndefined, z.string().uuid().optional()),
  forTrade: queryFlag(),
  signed: queryFlag(),
  altered: queryFlag(),
  misprint: queryFlag(),
  miscut: queryFlag(),
  artistProof: queryFlag(),
  onWantList: queryFlag(),
  onGenericWant: queryFlag(),
});
export type CollectionItemQuery = z.infer<typeof collectionItemQuerySchema>;

export const collectionSortSchema = z.enum(['name', 'price', 'change']);
export type CollectionSort = z.infer<typeof collectionSortSchema>;

export const sortDirectionSchema = z.enum(['asc', 'desc']);
export type SortDirection = z.infer<typeof sortDirectionSchema>;

export const collectionCardsQuerySchema = collectionItemQuerySchema.extend({
  sort: collectionSortSchema.default('price'),
  dir: sortDirectionSchema.default('desc'),
  range: priceRangeSchema.default('1w'),
  /** Which change the "change" sort uses; display is chosen by the client. */
  changeBy: z.enum(['amount', 'percent']).default('amount'),
});
export type CollectionCardsQuery = z.infer<typeof collectionCardsQuerySchema>;

export const collectionMoversQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(20).default(5),
  range: priceRangeSchema.default('1w'),
  changeBy: z.enum(['amount', 'percent']).default('amount'),
});
export type CollectionMoversQuery = z.infer<typeof collectionMoversQuerySchema>;

export const collectionValuePointSchema = z.object({
  date: z.string(),
  value: z.number().nonnegative(),
});
export type CollectionValuePoint = z.infer<typeof collectionValuePointSchema>;

export const collectionValueHistorySchema = z.object({
  range: priceRangeSchema,
  points: z.array(collectionValuePointSchema),
});
export type CollectionValueHistory = z.infer<typeof collectionValueHistorySchema>;

export const collectionValueHistoryQuerySchema = z.object({
  range: priceRangeSchema.default('1m'),
});

export const collectionValueBreakdownBySchema = z.enum([
  'set',
  'rarity',
  'finish',
  'condition',
  'language',
  'marks',
  'trade',
]);
export type CollectionValueBreakdownBy = z.infer<typeof collectionValueBreakdownBySchema>;

export const collectionValueBreakdownQuerySchema = z.object({
  by: collectionValueBreakdownBySchema.default('set'),
});

export const collectionValueBucketSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number().nonnegative(),
});
export type CollectionValueBucket = z.infer<typeof collectionValueBucketSchema>;

export const collectionValueBreakdownSchema = z.object({
  by: collectionValueBreakdownBySchema,
  total: z.number().nonnegative(),
  buckets: z.array(collectionValueBucketSchema),
});
export type CollectionValueBreakdown = z.infer<typeof collectionValueBreakdownSchema>;

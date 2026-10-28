import { z } from 'zod';
import { cardImageUrisSchema, printingIdSchema } from './card';
import { tradeStatusSchema } from './enums';
import { usernameSchema } from './user';

const tradeLineSchema = z.object({
  scryfallId: printingIdSchema,
  quantity: z.number().int().positive().max(999),
});

/** Cards the opener wants, plus an optional `give` they offer in return; omitting `give` decides that side later. */
export const createTradeSchema = z.object({
  username: usernameSchema,
  items: z.array(tradeLineSchema).min(1).max(100),
  give: z.array(tradeLineSchema).max(100).optional(),
});
export type CreateTradeInput = z.infer<typeof createTradeSchema>;

/** Both sides from this person's view: `items` is what they receive, `give` what they hand over; omitting `give` keeps that side unchanged. */
export const tradeLinesSchema = z.object({
  items: z.array(tradeLineSchema).max(100),
  give: z.array(tradeLineSchema).max(100).optional(),
});
export type TradeLinesInput = z.infer<typeof tradeLinesSchema>;

export const tradeCardSchema = z.object({
  scryfallId: printingIdSchema,
  quantity: z.number().int().positive(),
  name: z.string(),
  setCode: z.string(),
  imageUris: cardImageUrisSchema.nullable(),
  /** How many of this printing the giver still has marked for trade. */
  availableQuantity: z.number().int().nonnegative(),
  /** Market price of one copy, for the finish the giver holds most of. Null when unpriced. */
  marketPrice: z.string().nullable(),
});
export type TradeCard = z.infer<typeof tradeCardSchema>;

export const tradeSummarySchema = z.object({
  id: z.string().uuid(),
  status: tradeStatusSchema,
  partnerUsername: z.string(),
  yourTurn: z.boolean(),
  youFinalized: z.boolean(),
  theyFinalized: z.boolean(),
  youReceiveCount: z.number().int().nonnegative(),
  youGiveCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
});
export type TradeSummary = z.infer<typeof tradeSummarySchema>;

export const tradeDetailSchema = tradeSummarySchema.extend({
  youReceive: z.array(tradeCardSchema),
  youGive: z.array(tradeCardSchema),
});
export type TradeDetail = z.infer<typeof tradeDetailSchema>;

export const tradeChoiceSchema = z.object({
  scryfallId: printingIdSchema,
  name: z.string(),
  setCode: z.string(),
  availableQuantity: z.number().int().positive(),
  imageUris: cardImageUrisSchema.nullable(),
  marketPrice: z.string().nullable(),
});
export type TradeChoice = z.infer<typeof tradeChoiceSchema>;

/** What each side can put on the table: their stock for "You get", yours for "You give". */
export const tradeChoicesSchema = z.object({
  items: z.array(tradeChoiceSchema),
  mine: z.array(tradeChoiceSchema),
});
export type TradeChoices = z.infer<typeof tradeChoicesSchema>;

/** Unpriced cards count as zero. */
export function tradeSideValue(cards: { quantity: number; marketPrice: string | null }[]): number {
  return cards.reduce((sum, card) => {
    const price = Number(card.marketPrice ?? 0);
    return sum + (Number.isFinite(price) ? price * card.quantity : 0);
  }, 0);
}

import { z } from 'zod';
import { cardImageUrisSchema } from './card';
import { tradeStatusSchema } from './enums';
import { usernameSchema } from './user';

const tradeLineSchema = z.object({
  scryfallId: z.string().uuid(),
  quantity: z.number().int().positive().max(999),
});

/** Cards the opener wants to receive, sent when a trade is started. */
export const createTradeSchema = z.object({
  username: usernameSchema,
  items: z.array(tradeLineSchema).min(1).max(100),
});
export type CreateTradeInput = z.infer<typeof createTradeSchema>;

/** The cards this person wants to receive. Propose and Finalize both send this. */
export const tradeLinesSchema = z.object({
  items: z.array(tradeLineSchema).max(100),
});
export type TradeLinesInput = z.infer<typeof tradeLinesSchema>;

export const tradeCardSchema = z.object({
  scryfallId: z.string().uuid(),
  quantity: z.number().int().positive(),
  name: z.string(),
  setCode: z.string(),
  imageUris: cardImageUrisSchema.nullable(),
  /** How many of this printing the giver still has marked for trade. */
  availableQuantity: z.number().int().nonnegative(),
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

/** One printing the other person has marked for trade. */
export const tradeChoiceSchema = z.object({
  scryfallId: z.string().uuid(),
  name: z.string(),
  setCode: z.string(),
  availableQuantity: z.number().int().positive(),
  imageUris: cardImageUrisSchema.nullable(),
});
export type TradeChoice = z.infer<typeof tradeChoiceSchema>;

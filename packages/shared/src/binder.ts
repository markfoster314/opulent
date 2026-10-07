import { z } from 'zod';
import { binderVisibilitySchema, cardConditionSchema, cardFinishSchema } from './enums';
import { cardSchema } from './card';

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
  language: z.string(),
  notes: z.string().nullable(),
  forTrade: z.boolean(),
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
  language: z.string().min(2).max(5).default('en'),
  notes: z.string().max(280).optional(),
  forTrade: z.boolean().default(true),
});
export type AddBinderItemInput = z.infer<typeof addBinderItemSchema>;

export const updateBinderItemSchema = addBinderItemSchema.partial().omit({ scryfallId: true });
export type UpdateBinderItemInput = z.infer<typeof updateBinderItemSchema>;

/**
 * One row of the headline feature: a card the viewer wants that the binder
 * owner is holding for trade.
 */
export const tradeMatchSchema = z.object({
  oracleId: z.string().uuid(),
  cardName: z.string(),
  wantQuantity: z.number().int().positive(),
  wantPriority: z.number().int(),
  availableQuantity: z.number().int().positive(),
  printings: z.array(binderItemSchema),
});
export type TradeMatch = z.infer<typeof tradeMatchSchema>;

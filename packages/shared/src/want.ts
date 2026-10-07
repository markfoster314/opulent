import { z } from 'zod';
import { wantPrioritySchema } from './enums';

export const wantItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  oracleId: z.string().uuid(),
  cardName: z.string().optional(),
  quantity: z.number().int().positive(),
  priority: wantPrioritySchema,
  notes: z.string().nullable(),
});
export type WantItem = z.infer<typeof wantItemSchema>;

export const addWantItemSchema = z.object({
  oracleId: z.string().uuid(),
  quantity: z.number().int().positive().max(999).default(1),
  priority: wantPrioritySchema.default(2),
  notes: z.string().max(280).optional(),
});
export type AddWantItemInput = z.infer<typeof addWantItemSchema>;

export const updateWantItemSchema = addWantItemSchema.partial().omit({ oracleId: true });
export type UpdateWantItemInput = z.infer<typeof updateWantItemSchema>;

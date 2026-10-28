import { z } from 'zod';
import { printingIdSchema } from './card';
import { cardConditionSchema, cardFinishSchema, cardLanguageSchema } from './enums';

/** Longest CSV the import route accepts, about 10,000 ManaBox rows. */
export const IMPORT_MAX_CHARS = 2_000_000;

/** The screen previews with `dryRun`, then sends the same body again with it off. */
export const collectionImportSchema = z.object({
  csv: z.string().min(1).max(IMPORT_MAX_CHARS),
  dryRun: z.boolean().default(true),
  forTradeDefault: z.boolean().default(false),
  groupIds: z.array(z.string().uuid()).max(50).optional(),
});
export type CollectionImportInput = z.infer<typeof collectionImportSchema>;

export const importRowStatusSchema = z.enum(['matched', 'unmatched', 'skipped']);
export type ImportRowStatus = z.infer<typeof importRowStatusSchema>;

/** Only the first rows ride back in the preview. */
export const importRowSchema = z.object({
  line: z.number().int().positive(),
  status: importRowStatusSchema,
  name: z.string(),
  setCode: z.string(),
  collectorNumber: z.string().nullable(),
  quantity: z.number().int(),
  condition: cardConditionSchema,
  finish: cardFinishSchema,
  language: cardLanguageSchema,
  forTrade: z.boolean(),
  scryfallId: printingIdSchema.nullable(),
  reason: z.string().nullable(),
});
export type ImportRow = z.infer<typeof importRowSchema>;

export const collectionImportResultSchema = z.object({
  dryRun: z.boolean(),
  format: z.enum(['manabox', 'moxfield', 'plain']),
  total: z.number().int().nonnegative(),
  matched: z.number().int().nonnegative(),
  unmatched: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  added: z.number().int().nonnegative(),
  rows: z.array(importRowSchema),
});
export type CollectionImportResult = z.infer<typeof collectionImportResultSchema>;

/** Header order for the plain export format. */
export const PLAIN_CSV_COLUMNS = [
  'name',
  'set',
  'number',
  'quantity',
  'condition',
  'finish',
  'language',
  'for trade',
] as const;

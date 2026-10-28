import { z } from 'zod';
import { printingIdSchema } from './card';
import {
  cardConditionSchema,
  cardFinishSchema,
  cardLanguageSchema,
  wantPrioritySchema,
} from './enums';
import { IMPORT_MAX_CHARS, importRowStatusSchema } from './import';

export const wantsImportSchema = z.object({
  csv: z.string().min(1).max(IMPORT_MAX_CHARS),
  dryRun: z.boolean().default(true),
  listId: z.string().uuid().optional(),
});
export type WantsImportInput = z.infer<typeof wantsImportSchema>;

export const wantImportRowSchema = z.object({
  line: z.number().int().positive(),
  status: importRowStatusSchema,
  name: z.string(),
  setCode: z.string(),
  finish: cardFinishSchema.nullable(),
  language: cardLanguageSchema.nullable(),
  condition: cardConditionSchema.nullable(),
  quantity: z.number().int().nonnegative(),
  priority: wantPrioritySchema,
  notes: z.string().nullable(),
  lists: z.array(z.string()),
  oracleId: printingIdSchema.nullable(),
  reason: z.string().nullable(),
});
export type WantImportRow = z.infer<typeof wantImportRowSchema>;

export const wantsImportResultSchema = z.object({
  dryRun: z.boolean(),
  total: z.number().int().nonnegative(),
  matched: z.number().int().nonnegative(),
  unmatched: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  added: z.number().int().nonnegative(),
  listsCreated: z.array(z.string()),
  rows: z.array(wantImportRowSchema),
});
export type WantsImportResult = z.infer<typeof wantsImportResultSchema>;

/** Header order for our own export, which this importer reads back. */
export const WANT_CSV_COLUMNS = [
  'name',
  'set',
  'finish',
  'language',
  'condition',
  'quantity',
  'priority',
  'notes',
  'lists',
  'oracle_id',
] as const;

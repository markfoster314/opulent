import { z } from 'zod';
import { printingIdSchema } from './card';
import { cardConditionSchema, cardFinishSchema, cardLanguageSchema } from './enums';

/** Longest CSV the import route accepts. About 10,000 ManaBox rows. */
export const IMPORT_MAX_CHARS = 2_000_000;

/**
 * A CSV import. The file is sent as text, since every export tool writes one.
 *
 * `dryRun` matches rows and reports, but writes nothing. The import screen
 * shows that preview first, then sends the same body again with `dryRun` off.
 */
export const collectionImportSchema = z.object({
  csv: z.string().min(1).max(IMPORT_MAX_CHARS),
  dryRun: z.boolean().default(true),
  /** Used when a row has no For trade column. */
  forTradeDefault: z.boolean().default(false),
});
export type CollectionImportInput = z.infer<typeof collectionImportSchema>;

export const importRowStatusSchema = z.enum(['matched', 'unmatched', 'skipped']);
export type ImportRowStatus = z.infer<typeof importRowStatusSchema>;

/** One CSV line after matching. Only the first rows ride back in the preview. */
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
  /** The matched printing, when there is one. */
  scryfallId: printingIdSchema.nullable(),
  /** Why a row did not match or was skipped, in plain words. */
  reason: z.string().nullable(),
});
export type ImportRow = z.infer<typeof importRowSchema>;

export const collectionImportResultSchema = z.object({
  dryRun: z.boolean(),
  /** Which column layout was recognised. */
  format: z.enum(['manabox', 'moxfield', 'plain']),
  total: z.number().int().nonnegative(),
  matched: z.number().int().nonnegative(),
  unmatched: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  /** Copies written. Zero on a dry run. */
  added: z.number().int().nonnegative(),
  /** The first rows, matched and not, so the screen can show what will happen. */
  rows: z.array(importRowSchema),
});
export type CollectionImportResult = z.infer<typeof collectionImportResultSchema>;

/** Column headers of the plain export format, in order. */
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

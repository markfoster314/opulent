import { z } from 'zod';
import { slugSchema } from './binder';
import { cardImageUrisSchema } from './card';
import {
  binderVisibilitySchema,
  cardConditionLabels,
  cardConditionSchema,
  cardFinishLabels,
  cardFinishSchema,
  cardLanguageLabels,
  cardLanguageSchema,
  wantPrioritySchema,
} from './enums';

const setCodeSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]{1,10}$/, 'Use a set code such as mh2.');

const languageList = z.array(cardLanguageSchema).max(20);
const finishList = z.array(cardFinishSchema).max(5);
const conditionList = z.array(cardConditionSchema).max(5);
const setList = z.array(setCodeSchema).max(80);

export const wantScopeSchema = z.object({
  wantedLanguages: languageList.default([]),
  unwantedLanguages: languageList.default([]),
  wantedFinishes: finishList.default([]),
  unwantedFinishes: finishList.default([]),
  wantedConditions: conditionList.default([]),
  unwantedConditions: conditionList.default([]),
  wantedSets: setList.default([]),
  unwantedSets: setList.default([]),
});

/** A choice cannot sit on both the keep side and the skip side. */
export function wantScopeError(scope: {
  wantedLanguages: readonly string[];
  unwantedLanguages: readonly string[];
  wantedFinishes: readonly string[];
  unwantedFinishes: readonly string[];
  wantedConditions: readonly string[];
  unwantedConditions: readonly string[];
  wantedSets: readonly string[];
  unwantedSets: readonly string[];
}): string | null {
  const overlap = (wanted: readonly string[], unwanted: readonly string[]) =>
    wanted.some((value) => unwanted.includes(value));
  if (overlap(scope.wantedLanguages, scope.unwantedLanguages)) {
    return 'A language cannot be both wanted and skipped.';
  }
  if (overlap(scope.wantedFinishes, scope.unwantedFinishes)) {
    return 'A finish cannot be both wanted and skipped.';
  }
  if (overlap(scope.wantedConditions, scope.unwantedConditions)) {
    return 'A condition cannot be both wanted and skipped.';
  }
  if (overlap(scope.wantedSets, scope.unwantedSets)) {
    return 'A set cannot be both wanted and skipped.';
  }
  return null;
}

function refineWantScope(
  value: {
    wantedLanguages?: string[];
    unwantedLanguages?: string[];
    wantedFinishes?: string[];
    unwantedFinishes?: string[];
    wantedConditions?: string[];
    unwantedConditions?: string[];
    wantedSets?: string[];
    unwantedSets?: string[];
  },
  ctx: z.RefinementCtx,
) {
  const message = wantScopeError({
    wantedLanguages: value.wantedLanguages ?? [],
    unwantedLanguages: value.unwantedLanguages ?? [],
    wantedFinishes: value.wantedFinishes ?? [],
    unwantedFinishes: value.unwantedFinishes ?? [],
    wantedConditions: value.wantedConditions ?? [],
    unwantedConditions: value.unwantedConditions ?? [],
    wantedSets: value.wantedSets ?? [],
    unwantedSets: value.unwantedSets ?? [],
  });
  if (!message) return;
  ctx.addIssue({ code: z.ZodIssueCode.custom, message });
}

export const wantListSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  slug: slugSchema,
  name: z.string(),
  description: z.string().nullable(),
  visibility: binderVisibilitySchema,
  itemCount: z.number().int().nonnegative().optional(),
  /** Present only when the caller owns the list. Strangers never receive it. */
  shareToken: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type WantList = z.infer<typeof wantListSchema>;

export const createWantListSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: slugSchema.optional(),
  description: z.string().max(500).optional(),
  visibility: binderVisibilitySchema.default('private'),
});
export type CreateWantListInput = z.infer<typeof createWantListSchema>;

export const updateWantListSchema = createWantListSchema.partial();
export type UpdateWantListInput = z.infer<typeof updateWantListSchema>;

export const wantItemSchema = wantScopeSchema.extend({
  id: z.string().uuid(),
  wantListId: z.string().uuid(),
  userId: z.string().uuid(),
  oracleId: z.string().uuid(),
  cardName: z.string().optional(),
  quantity: z.number().int().positive(),
  priority: wantPrioritySchema,
  notes: z.string().nullable(),
  /** A scan to show on the list. The oldest printing of this card that has a picture. */
  imageUris: cardImageUrisSchema.nullable().optional(),
});
export type WantItem = z.infer<typeof wantItemSchema>;

export const addWantItemSchema = wantScopeSchema
  .extend({
    oracleId: z.string().uuid(),
    quantity: z.number().int().positive().max(999).default(1),
    priority: wantPrioritySchema.default(2),
    notes: z.string().max(280).optional(),
  })
  .superRefine(refineWantScope);
export type AddWantItemInput = z.infer<typeof addWantItemSchema>;

export const updateWantItemSchema = wantScopeSchema
  .partial()
  .extend({
    quantity: z.number().int().positive().max(999).optional(),
    priority: wantPrioritySchema.optional(),
    notes: z.string().max(280).nullable().optional(),
  })
  .superRefine(refineWantScope);
export type UpdateWantItemInput = z.infer<typeof updateWantItemSchema>;

function named(codes: readonly string[], labels: Record<string, string>): string[] {
  return codes.map((code) => labels[code] ?? code.toUpperCase());
}

/** One line under a want: "Any printing", or the choices that narrow it. */
export function describeWantScope(item: {
  wantedLanguages: readonly string[];
  unwantedLanguages: readonly string[];
  wantedFinishes: readonly string[];
  unwantedFinishes: readonly string[];
  wantedConditions: readonly string[];
  unwantedConditions: readonly string[];
  wantedSets: readonly string[];
  unwantedSets: readonly string[];
}): string {
  const wanted = [
    ...named(item.wantedLanguages, cardLanguageLabels),
    ...named(item.wantedFinishes, cardFinishLabels),
    ...named(item.wantedConditions, cardConditionLabels),
    ...item.wantedSets.map((code) => code.toUpperCase()),
  ];
  const skipped = [
    ...named(item.unwantedLanguages, cardLanguageLabels),
    ...named(item.unwantedFinishes, cardFinishLabels),
    ...named(item.unwantedConditions, cardConditionLabels),
    ...item.unwantedSets.map((code) => code.toUpperCase()),
  ];
  if (wanted.length === 0 && skipped.length === 0) return 'Any printing';
  const keep = wanted.length > 0 ? wanted.join(', ') : '';
  const drop = skipped.length > 0 ? `Not ${skipped.join(', ')}` : '';
  return [keep, drop].filter((part) => part !== '').join('. ');
}

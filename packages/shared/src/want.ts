import { z } from 'zod';
import { slugSchema } from './binder';
import { cardImageUrisSchema, cardSetSchema } from './card';
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
  wantedFinishes: finishList.default([]),
  wantedConditions: conditionList.default([]),
  wantedSets: setList.default([]),
});

export type WantScope = z.infer<typeof wantScopeSchema>;

/** Same filters, always in the same order, so one card can have several distinct wants. */
export function wantScopeKey(scope: {
  wantedLanguages: readonly string[];
  wantedFinishes: readonly string[];
  wantedConditions: readonly string[];
  wantedSets: readonly string[];
}): string {
  const list = (values: readonly string[], upper = false) =>
    [...new Set(values.map((value) => value.trim()))]
      .map((value) => (upper ? value.toUpperCase() : value.toLowerCase()))
      .sort()
      .join(',');
  return [
    `lang:${list(scope.wantedLanguages)}`,
    `finish:${list(scope.wantedFinishes)}`,
    `cond:${list(scope.wantedConditions, true)}`,
    `set:${list(scope.wantedSets)}`,
  ].join('|');
}

export const wantListSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  slug: slugSchema,
  name: z.string(),
  description: z.string().nullable(),
  visibility: binderVisibilitySchema,
  itemCount: z.number().int().nonnegative().optional(),
  /** Only the owner receives it; strangers never do. */
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

export const wantListRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
});
export type WantListRef = z.infer<typeof wantListRefSchema>;

export const wantItemSchema = wantScopeSchema.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  oracleId: z.string().uuid(),
  cardName: z.string().optional(),
  quantity: z.number().int().positive(),
  priority: wantPrioritySchema,
  notes: z.string().nullable(),
  /** Picture from the oldest printing of this card that has one. */
  imageUris: cardImageUrisSchema.nullable().optional(),
  /** Lists that contain this want; empty means only All wants. */
  lists: z.array(wantListRefSchema),
});
export type WantItem = z.infer<typeof wantItemSchema>;

export const addWantItemSchema = wantScopeSchema.extend({
  oracleId: z.string().uuid(),
  quantity: z.number().int().positive().max(999).default(1),
  priority: wantPrioritySchema.default(2),
  notes: z.string().max(280).optional(),
  listIds: z.array(z.string().uuid()).max(50).default([]),
});
export type AddWantItemInput = z.infer<typeof addWantItemSchema>;

export const updateWantItemSchema = wantScopeSchema.partial().extend({
  quantity: z.number().int().positive().max(999).optional(),
  priority: wantPrioritySchema.optional(),
  notes: z.string().max(280).nullable().optional(),
  listIds: z.array(z.string().uuid()).max(50).optional(),
});
export type UpdateWantItemInput = z.infer<typeof updateWantItemSchema>;

function uniqueSorted<T extends string>(values: T[]): T[] {
  return [...new Set(values)].sort();
}

const genericLanguageList = z.array(cardLanguageSchema).max(20).transform(uniqueSorted);
const genericFinishList = z.array(cardFinishSchema).max(5).transform(uniqueSorted);
const genericConditionList = z.array(cardConditionSchema).max(5).transform(uniqueSorted);
const genericSetList = z.array(setCodeSchema).max(40).transform(uniqueSorted);

export const genericWantSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  languages: z.array(cardLanguageSchema),
  finishes: z.array(cardFinishSchema),
  conditions: z.array(cardConditionSchema),
  sets: z.array(cardSetSchema),
  signed: z.boolean(),
  altered: z.boolean(),
  misprint: z.boolean(),
  miscut: z.boolean(),
  artistProof: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type GenericWant = z.infer<typeof genericWantSchema>;

export const createGenericWantSchema = z
  .object({
    languages: genericLanguageList.default([]),
    finishes: genericFinishList.default([]),
    conditions: genericConditionList.default([]),
    sets: genericSetList.default([]),
    signed: z.boolean().default(false),
    altered: z.boolean().default(false),
    misprint: z.boolean().default(false),
    miscut: z.boolean().default(false),
    artistProof: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    const hasChoice =
      value.languages.length > 0 ||
      value.finishes.length > 0 ||
      value.conditions.length > 0 ||
      value.sets.length > 0 ||
      value.signed ||
      value.altered ||
      value.misprint ||
      value.miscut ||
      value.artistProof;
    if (!hasChoice) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Pick at least one choice.' });
    }
  });
export type CreateGenericWantInput = z.infer<typeof createGenericWantSchema>;

/** Same choices in a fixed order, so a repeated mix can be refused. */
export function genericWantMatchKey(input: CreateGenericWantInput): string {
  const list = (name: string, values: readonly string[]) => `${name}:${values.join(',')}`;
  return [
    list('lang', input.languages),
    list('finish', input.finishes),
    list('cond', input.conditions),
    list('set', input.sets),
    `signed:${input.signed ? 1 : 0}`,
    `altered:${input.altered ? 1 : 0}`,
    `misprint:${input.misprint ? 1 : 0}`,
    `miscut:${input.miscut ? 1 : 0}`,
    `proof:${input.artistProof ? 1 : 0}`,
  ].join('|');
}

export function describeGenericWant(item: {
  languages: readonly string[];
  finishes: readonly string[];
  conditions: readonly string[];
  sets: readonly { setCode: string; setName: string | null }[];
  signed: boolean;
  altered: boolean;
  misprint: boolean;
  miscut: boolean;
  artistProof: boolean;
}): string {
  const parts = [
    ...named(item.languages, cardLanguageLabels),
    ...named(item.finishes, cardFinishLabels),
    ...named(item.conditions, cardConditionLabels),
    ...item.sets.map((set) =>
      set.setName ? `${set.setName} (${set.setCode.toUpperCase()})` : set.setCode.toUpperCase(),
    ),
  ];
  if (item.signed) parts.push('Signed');
  if (item.altered) parts.push('Altered');
  if (item.misprint) parts.push('Misprint');
  if (item.miscut) parts.push('Miscut');
  if (item.artistProof) parts.push('Artist proof');
  return parts.join(', ');
}

function named(codes: readonly string[], labels: Record<string, string>): string[] {
  return codes.map((code) => labels[code] ?? code.toUpperCase());
}

export function describeWantScope(item: {
  wantedLanguages: readonly string[];
  wantedFinishes: readonly string[];
  wantedConditions: readonly string[];
  wantedSets: readonly string[];
}): string {
  const wanted = [
    ...named(item.wantedLanguages, cardLanguageLabels),
    ...named(item.wantedFinishes, cardFinishLabels),
    ...named(item.wantedConditions, cardConditionLabels),
    ...item.wantedSets.map((code) => code.toUpperCase()),
  ];
  return wanted.length === 0 ? 'Any version' : wanted.join(', ');
}

export const genericMatchCardSchema = z.object({
  name: z.string(),
  setCode: z.string(),
  imageUris: cardImageUrisSchema.nullable(),
  finish: cardFinishSchema,
  condition: cardConditionSchema,
  language: cardLanguageSchema,
  quantity: z.number().int().nonnegative(),
});
export type GenericMatchCard = z.infer<typeof genericMatchCardSchema>;

export const genericMatchOwnerSchema = z.object({
  username: z.string(),
  city: z.string().nullable(),
  distanceMeters: z.number().nullable(),
  matchCount: z.number().int().nonnegative(),
  cards: z.array(genericMatchCardSchema),
});
export type GenericMatchOwner = z.infer<typeof genericMatchOwnerSchema>;

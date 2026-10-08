import { z } from 'zod';

/** How a physical card is printed. Mirrors Scryfall's `finishes` array. */
export const cardFinishSchema = z.enum(['nonfoil', 'foil', 'etched']);
export type CardFinish = z.infer<typeof cardFinishSchema>;

/** Printed language. The codes match the ones Scryfall stores on a card. */
export const cardLanguageSchema = z.enum([
  'en',
  'es',
  'fr',
  'de',
  'it',
  'pt',
  'ja',
  'ko',
  'ru',
  'zhs',
  'zht',
  'he',
  'la',
  'grc',
  'ar',
  'sa',
  'ph',
]);
export type CardLanguage = z.infer<typeof cardLanguageSchema>;

/** A known language code, or English when the printing uses one we do not list. */
export function cardLanguageOrEnglish(lang: string): CardLanguage {
  const parsed = cardLanguageSchema.safeParse(lang);
  return parsed.success ? parsed.data : 'en';
}

/**
 * Grading shorthand used by every major Magic marketplace:
 * NM near mint, LP lightly played, MP moderately played, HP heavily played, DMG damaged.
 */
export const cardConditionSchema = z.enum(['NM', 'LP', 'MP', 'HP', 'DMG']);
export type CardCondition = z.infer<typeof cardConditionSchema>;

/**
 * private   only the owner can open it
 * unlisted  anyone holding the share token can open it, but it is never listed publicly
 * public    listed on the owner's profile and indexable
 */
export const binderVisibilitySchema = z.enum(['private', 'unlisted', 'public']);
export type BinderVisibility = z.infer<typeof binderVisibilitySchema>;

/** 1 is the most wanted. Used to sort match results. */
export const wantPrioritySchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type WantPriority = z.infer<typeof wantPrioritySchema>;

export const tradeStatusSchema = z.enum([
  'draft',
  'proposed',
  'countered',
  'accepted',
  'declined',
  'cancelled',
  'completed',
]);
export type TradeStatus = z.infer<typeof tradeStatusSchema>;

export const tradeSideSchema = z.enum(['offered', 'requested']);
export type TradeSide = z.infer<typeof tradeSideSchema>;

/**
 * Display text for the enums above.
 *
 * These live beside the schemas rather than in the web app so that the eventual
 * mobile app cannot drift from the website on what "LP" means.
 */
export const cardConditionLabels: Record<CardCondition, string> = {
  NM: 'Near mint',
  LP: 'Lightly played',
  MP: 'Moderately played',
  HP: 'Heavily played',
  DMG: 'Damaged',
};

/**
 * Usual share of the market price left after wear.
 *
 * Near mint stays at the full market price, so it has no entry here.
 * Light play is about 10% off, moderate 20% off, heavy 30% off, damaged 50% off.
 */
export const conditionMarketPercent: Partial<Record<CardCondition, number>> = {
  LP: 90,
  MP: 80,
  HP: 70,
  DMG: 50,
};

export const cardFinishLabels: Record<CardFinish, string> = {
  nonfoil: 'Non-foil',
  foil: 'Foil',
  etched: 'Etched foil',
};

export const cardLanguageLabels: Record<CardLanguage, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ja: 'Japanese',
  ko: 'Korean',
  ru: 'Russian',
  zhs: 'Simplified Chinese',
  zht: 'Traditional Chinese',
  he: 'Hebrew',
  la: 'Latin',
  grc: 'Ancient Greek',
  ar: 'Arabic',
  sa: 'Sanskrit',
  ph: 'Phyrexian',
};

export const binderVisibilityLabels: Record<BinderVisibility, string> = {
  private: 'Private',
  unlisted: 'Unlisted',
  public: 'Public',
};

export const binderVisibilityDescriptions: Record<BinderVisibility, string> = {
  private: 'Only you can open it.',
  unlisted: 'Anyone with the share link can open it. It is never listed publicly.',
  public: 'Listed on your profile and open to anyone.',
};

export const wantPriorityLabels: Record<WantPriority, string> = {
  1: 'High',
  2: 'Medium',
  3: 'Low',
};

import { z } from 'zod';

/** Card catalog; a later game gets its own value and sync job, and every list query narrows on it. */
export const CARD_GAME = 'mtg';

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

/** Falls back to English for a code we do not list. */
export function cardLanguageOrEnglish(lang: string): CardLanguage {
  const parsed = cardLanguageSchema.safeParse(lang);
  return parsed.success ? parsed.data : 'en';
}

/** Grading shorthand used by every major Magic marketplace: NM, LP, MP, HP, DMG. */
export const cardConditionSchema = z.enum(['NM', 'LP', 'MP', 'HP', 'DMG']);
export type CardCondition = z.infer<typeof cardConditionSchema>;

/** Private: owner only; unlisted: reachable only by share token, never listed; public: listed and indexable. */
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

/** Display text lives beside the schemas, not in the web app, so a mobile app cannot drift on what "LP" means. */
export const cardConditionLabels: Record<CardCondition, string> = {
  NM: 'Near mint',
  LP: 'Lightly played',
  MP: 'Moderately played',
  HP: 'Heavily played',
  DMG: 'Damaged',
};

/** Usual share of market price left after wear; near mint has no entry because it keeps the full price. */
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

export const profileVisibilitySchema = z.enum(['private', 'public']);
export type ProfileVisibility = z.infer<typeof profileVisibilitySchema>;

export const profileVisibilityLabels: Record<ProfileVisibility, string> = {
  private: 'Private',
  public: 'Public',
};

export const profileVisibilityDescriptions: Record<ProfileVisibility, string> = {
  private: 'Only you can open this page.',
  public: 'Anyone can open this page and see your trade binder and want lists.',
};

export const wantPriorityLabels: Record<WantPriority, string> = {
  1: 'High',
  2: 'Medium',
  3: 'Low',
};

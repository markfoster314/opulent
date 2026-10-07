import { pgEnum } from 'drizzle-orm/pg-core';

export const cardFinish = pgEnum('card_finish', ['nonfoil', 'foil', 'etched']);

export const cardCondition = pgEnum('card_condition', ['NM', 'LP', 'MP', 'HP', 'DMG']);

export const binderVisibility = pgEnum('binder_visibility', ['private', 'unlisted', 'public']);

export const tradeStatus = pgEnum('trade_status', [
  'draft',
  'proposed',
  'countered',
  'accepted',
  'declined',
  'cancelled',
  'completed',
]);

export const tradeSide = pgEnum('trade_side', ['offered', 'requested']);

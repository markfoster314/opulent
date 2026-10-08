import { pgEnum } from 'drizzle-orm/pg-core';

export const cardFinish = pgEnum('card_finish', ['nonfoil', 'foil', 'etched']);

export const cardCondition = pgEnum('card_condition', ['NM', 'LP', 'MP', 'HP', 'DMG']);

/** How the owner priced one stack: full market, a percent of it, or their own amount. */
export const itemPriceKind = pgEnum('item_price_kind', ['market', 'percent', 'custom']);

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

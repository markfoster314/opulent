import { relations } from 'drizzle-orm';
import { binderItems, binders } from './binders';
import { cards } from './cards';
import { places } from './places';
import { tradeItems, trades } from './trades';
import { users } from './users';
import { wantItems } from './wants';

export const placesRelations = relations(places, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  place: one(places, { fields: [users.placeId], references: [places.geonameId] }),
  binders: many(binders),
  wantItems: many(wantItems),
}));

export const bindersRelations = relations(binders, ({ one, many }) => ({
  owner: one(users, { fields: [binders.userId], references: [users.id] }),
  items: many(binderItems),
}));

export const binderItemsRelations = relations(binderItems, ({ one }) => ({
  binder: one(binders, { fields: [binderItems.binderId], references: [binders.id] }),
  card: one(cards, { fields: [binderItems.scryfallId], references: [cards.scryfallId] }),
}));

export const wantItemsRelations = relations(wantItems, ({ one }) => ({
  user: one(users, { fields: [wantItems.userId], references: [users.id] }),
}));

export const tradesRelations = relations(trades, ({ one, many }) => ({
  proposer: one(users, { fields: [trades.proposerId], references: [users.id] }),
  receiver: one(users, { fields: [trades.receiverId], references: [users.id] }),
  items: many(tradeItems),
}));

export const tradeItemsRelations = relations(tradeItems, ({ one }) => ({
  trade: one(trades, { fields: [tradeItems.tradeId], references: [trades.id] }),
  card: one(cards, { fields: [tradeItems.scryfallId], references: [cards.scryfallId] }),
}));

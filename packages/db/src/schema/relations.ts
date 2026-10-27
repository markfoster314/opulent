import { relations } from 'drizzle-orm';
import { cards } from './cards';
import { cardGroups, collectionItems, groupMemberships } from './collection';
import { places } from './places';
import { tradeItems, trades } from './trades';
import { friendships, users } from './users';
import { genericWants, wantItems, wantLists } from './wants';

export const placesRelations = relations(places, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  place: one(places, { fields: [users.placeId], references: [places.geonameId] }),
  collectionItems: many(collectionItems),
  cardGroups: many(cardGroups),
  wantItems: many(wantItems),
  wantLists: many(wantLists),
  genericWants: many(genericWants),
  friendships: many(friendships, { relationName: 'friendshipOwner' }),
}));

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  user: one(users, {
    fields: [friendships.userId],
    references: [users.id],
    relationName: 'friendshipOwner',
  }),
  friend: one(users, {
    fields: [friendships.friendId],
    references: [users.id],
    relationName: 'friendshipFriend',
  }),
}));

export const cardGroupsRelations = relations(cardGroups, ({ one, many }) => ({
  owner: one(users, { fields: [cardGroups.userId], references: [users.id] }),
  memberships: many(groupMemberships),
}));

export const collectionItemsRelations = relations(collectionItems, ({ one, many }) => ({
  owner: one(users, { fields: [collectionItems.userId], references: [users.id] }),
  card: one(cards, { fields: [collectionItems.scryfallId], references: [cards.scryfallId] }),
  memberships: many(groupMemberships),
}));

export const groupMembershipsRelations = relations(groupMemberships, ({ one }) => ({
  item: one(collectionItems, {
    fields: [groupMemberships.itemId],
    references: [collectionItems.id],
  }),
  group: one(cardGroups, {
    fields: [groupMemberships.groupId],
    references: [cardGroups.id],
  }),
}));

export const wantListsRelations = relations(wantLists, ({ one, many }) => ({
  owner: one(users, { fields: [wantLists.userId], references: [users.id] }),
  items: many(wantItems),
}));

export const genericWantsRelations = relations(genericWants, ({ one }) => ({
  user: one(users, { fields: [genericWants.userId], references: [users.id] }),
}));

export const wantItemsRelations = relations(wantItems, ({ one }) => ({
  user: one(users, { fields: [wantItems.userId], references: [users.id] }),
  list: one(wantLists, { fields: [wantItems.wantListId], references: [wantLists.id] }),
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

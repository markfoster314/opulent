import type {
  Card,
  CardGroup,
  CollectionHighlight,
  CollectionItem,
  CollectionSummary,
  MatchOwner,
  Me,
  Profile,
  TradeBinder,
  TradeDetail,
  TradeSummary,
  WantItem,
  WantList,
} from '@opulent/shared';

const userId = '11111111-1111-4111-8111-111111111111';
const groupId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';
const scryfallId = '44444444-4444-4444-8444-444444444444';
const oracleId = '55555555-5555-4555-8555-555555555555';
const scryfallIdTwo = '66666666-6666-4666-8666-666666666666';
const oracleIdTwo = '77777777-7777-4777-8777-777777777777';
const wantListId = '88888888-8888-4888-8888-888888888888';
const wantItemId = '99999999-9999-4999-8999-999999999999';
const tradeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const now = '2026-10-28T12:00:00.000Z';

export const mockMe = {
  id: userId,
  username: 'mock_user',
  avatarUrl: null,
  createdAt: now,
  auth0Sub: 'mock|user',
  email: 'mock@example.com',
  city: { geonameId: 5128581, label: 'New York' },
  onboarded: true,
  profileVisibility: 'public',
  bio: 'Mock binder for UI work.',
  tradeBinderVisibility: 'public',
  tradeBinderShareToken: 'mock-share',
} satisfies Me;

const solitude = {
  scryfallId,
  oracleId,
  name: 'Solitude',
  setCode: 'mh2',
  setName: 'Modern Horizons 2',
  collectorNumber: '32',
  rarity: 'mythic',
  lang: 'en',
  layout: 'normal',
  typeLine: 'Creature — Elemental',
  manaCost: '{3}{W}{W}',
  finishes: ['nonfoil', 'foil'],
  imageUris: null,
  prices: { usd: '24.00', usd_foil: '28.00' },
  scryfallUri: null,
  releasedAt: '2021-06-18',
} satisfies Card;

const force = {
  ...solitude,
  scryfallId: scryfallIdTwo,
  oracleId: oracleIdTwo,
  name: 'Force of Negation',
  collectorNumber: '52',
  typeLine: 'Instant',
  manaCost: '{1}{U}{U}',
  prices: { usd: '42.00', usd_foil: '48.00' },
} satisfies Card;

export const mockCards = [solitude, force];

export const mockGroup = {
  id: groupId,
  userId,
  name: 'Trade pile',
  description: null,
  itemCount: 1,
  value: '24.00',
  createdAt: now,
  updatedAt: now,
} satisfies CardGroup;

export const mockCollectionItem = {
  id: itemId,
  scryfallId,
  quantity: 1,
  finish: 'nonfoil',
  condition: 'NM',
  language: 'en',
  notes: null,
  photoUrl: null,
  forTrade: true,
  signed: false,
  altered: false,
  misprint: false,
  miscut: false,
  artistProof: false,
  price: { kind: 'market' },
  groups: [{ id: groupId, name: 'Trade pile' }],
  card: solitude,
  availableFinishes: ['nonfoil', 'foil'],
} satisfies CollectionItem;

export const mockHighlight = {
  id: itemId,
  name: 'Solitude',
  setCode: 'mh2',
  finish: 'nonfoil',
  quantity: 1,
  forTrade: true,
  signed: false,
  altered: false,
  misprint: false,
  miscut: false,
  artistProof: false,
  imageUrl: null,
  price: '24.00',
  change: '1.00',
  changePercent: '4.3',
} satisfies CollectionHighlight;

export const mockSummary = {
  cardCount: 1,
  forTradeCount: 1,
  marketValue: '24.00',
  forTradeValue: '24.00',
  onTheTable: 0,
} satisfies CollectionSummary;

export const mockWantList = {
  id: wantListId,
  userId,
  slug: 'modern',
  name: 'Modern',
  description: null,
  visibility: 'public',
  itemCount: 1,
  shareToken: 'mock-wants',
  createdAt: now,
  updatedAt: now,
} satisfies WantList;

export const mockWantItem = {
  id: wantItemId,
  userId,
  oracleId: oracleIdTwo,
  cardName: 'Force of Negation',
  quantity: 1,
  priority: 1,
  notes: null,
  imageUris: null,
  lists: [{ id: wantListId, name: 'Modern', slug: 'modern' }],
  wantedLanguages: [],
  wantedFinishes: [],
  wantedConditions: [],
  wantedSets: [],
} satisfies WantItem;

export const mockMatch = {
  username: 'friend_one',
  city: 'Boston',
  distanceMeters: 300_000,
  matchCount: 1,
  cardNames: ['Solitude'],
} satisfies MatchOwner;

export const mockTrade = {
  id: tradeId,
  status: 'proposed',
  partnerUsername: 'friend_one',
  yourTurn: true,
  youFinalized: false,
  theyFinalized: false,
  youReceiveCount: 1,
  youGiveCount: 1,
  updatedAt: now,
} satisfies TradeSummary;

export const mockTradeDetail = {
  ...mockTrade,
  youReceive: [
    {
      scryfallId: scryfallIdTwo,
      quantity: 1,
      name: 'Force of Negation',
      setCode: 'mh2',
      imageUris: null,
      availableQuantity: 1,
      marketPrice: '42.00',
    },
  ],
  youGive: [
    {
      scryfallId,
      quantity: 1,
      name: 'Solitude',
      setCode: 'mh2',
      imageUris: null,
      availableQuantity: 1,
      marketPrice: '24.00',
    },
  ],
} satisfies TradeDetail;

export const mockProfile = {
  username: 'friend_one',
  avatarUrl: null,
  bio: null,
  city: { geonameId: 4930956, label: 'Boston' },
  visibility: 'public',
  isOwner: false,
  isFollowing: true,
  followerCount: 2,
  followingCount: 1,
  tradeBinderCount: 1,
  wantMatchCount: 1,
  wantLists: [{ slug: 'modern', name: 'Modern', description: null, matchCount: 1 }],
} satisfies Profile;

export const mockTradeBinder = {
  username: 'friend_one',
  visibility: 'public',
  cardCount: 1,
  shareToken: 'mock-binder',
} satisfies TradeBinder;

export const emptySummary = {
  cardCount: 0,
  forTradeCount: 0,
  marketValue: '0.00',
  forTradeValue: '0.00',
  onTheTable: 0,
} satisfies CollectionSummary;

export const mockNewUser = {
  ...mockMe,
  username: 'new_tutor',
  onboarded: false,
  city: null,
  bio: null,
} satisfies Me;

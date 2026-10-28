import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { WelcomePage } from '@/features/auth';
import { CollectionCardsPage, CollectionPage, ImportPage } from '@/features/collection';
import { GroupPage } from '@/features/groups';
import { HomePage } from '@/features/home';
import { MatchesPage } from '@/features/matches';
import { FollowersPage, FollowingPage, ProfilePage, TradeBinderPage } from '@/features/profile';
import { PastTradesPage, TradePage, TradesPage } from '@/features/trades';
import {
  MineAllWantsPage,
  PublicAllWantsPage,
  SharedWantListPage,
  WantListPage,
  WantsImportPage,
  WantsPage,
} from '@/features/wants';
import { AppLayout } from '@/layout/AppLayout';
import { NotFoundPage } from '@/layout/NotFoundPage';

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        {/* One-time username picker. AppLayout sends new accounts here. */}
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/collection" element={<CollectionPage />} />
        <Route path="/collection/cards" element={<CollectionCardsPage />} />
        <Route path="/collection/import" element={<ImportPage />} />
        {/* Groups are private, so there is one route and no share link. */}
        <Route path="/groups/:groupId" element={<GroupPage />} />
        {/* Old binder URLs still land somewhere useful. */}
        <Route path="/binders" element={<Navigate to="/collection" replace />} />
        <Route path="/binders/all" element={<Navigate to="/collection" replace />} />
        <Route path="/matches" element={<MatchesPage />} />
        <Route path="/wants" element={<WantsPage />} />
        <Route path="/wants/all" element={<MineAllWantsPage />} />
        <Route path="/wants/import" element={<WantsImportPage />} />
        <Route path="/wants/:listId" element={<WantListPage />} />
        <Route path="/trades" element={<TradesPage />} />
        <Route path="/trades/past" element={<PastTradesPage />} />
        <Route path="/trades/:tradeId" element={<TradePage />} />
        {/* Public share URLs for the trade binder and want lists. */}
        <Route path="/u/:handle/followers" element={<FollowersPage />} />
        <Route path="/u/:handle/following" element={<FollowingPage />} />
        <Route path="/u/:handle/wants/all" element={<PublicAllWantsPage />} />
        <Route path="/u/:handle/wants/:slug" element={<SharedWantListPage />} />
        <Route path="/u/:handle/trade-binder" element={<TradeBinderPage />} />
        <Route path="/u/:handle/all" element={<ToTradeBinder />} />
        <Route path="/u/:handle" element={<ProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

function ToTradeBinder() {
  const { handle } = useParams<{ handle: string }>();
  return <Navigate to={`/u/${handle}/trade-binder`} replace />;
}

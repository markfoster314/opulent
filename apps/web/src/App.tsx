import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { CollectionCardsPage } from './pages/CollectionCardsPage';
import { CollectionPage } from './pages/CollectionPage';
import { MineAllWantsPage, PublicAllWantsPage } from './pages/CollectedWantsPage';
import { FollowersPage, FollowingPage } from './pages/FollowersPage';
import { GroupPage } from './pages/GroupPage';
import { HomePage } from './pages/HomePage';
import { ImportPage } from './pages/ImportPage';
import { MatchesPage } from './pages/MatchesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';
import { SharedWantListPage } from './pages/SharedWantListPage';
import { TradeBinderPage } from './pages/TradeBinderPage';
import { TradePage } from './pages/TradePage';
import { PastTradesPage, TradesPage } from './pages/TradesPage';
import { WantListPage } from './pages/WantListPage';
import { WantsPage } from './pages/WantsPage';
import { WelcomePage } from './pages/WelcomePage';

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

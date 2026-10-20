import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { BinderDetailPage } from './pages/BinderDetailPage';
import { BindersPage } from './pages/BindersPage';
import { MineAllBinderPage, PublicAllBinderPage } from './pages/CollectedBinderPage';
import { MineAllWantsPage, PublicAllWantsPage } from './pages/CollectedWantsPage';
import { FollowersPage, FollowingPage } from './pages/FollowersPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProfilePage } from './pages/ProfilePage';
import { SharedBinderPage } from './pages/SharedBinderPage';
import { SharedWantListPage } from './pages/SharedWantListPage';
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
        <Route path="/binders" element={<BindersPage />} />
        <Route path="/binders/all" element={<MineAllBinderPage />} />
        <Route path="/binders/:binderId" element={<BinderDetailPage />} />
        <Route path="/wants" element={<WantsPage />} />
        <Route path="/wants/all" element={<MineAllWantsPage />} />
        <Route path="/wants/:listId" element={<WantListPage />} />
        <Route path="/trades" element={<TradesPage />} />
        <Route path="/trades/past" element={<PastTradesPage />} />
        <Route path="/trades/:tradeId" element={<TradePage />} />
        {/* Public share URL. Matches the API's /binders/by/:handle/:slug route. */}
        <Route path="/u/:handle/followers" element={<FollowersPage />} />
        <Route path="/u/:handle/following" element={<FollowingPage />} />
        <Route path="/u/:handle/wants/all" element={<PublicAllWantsPage />} />
        <Route path="/u/:handle/wants/:slug" element={<SharedWantListPage />} />
        <Route path="/u/:handle/all" element={<PublicAllBinderPage />} />
        <Route path="/u/:handle/:slug" element={<SharedBinderPage />} />
        <Route path="/u/:handle" element={<ProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

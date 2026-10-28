import { useAuth0 } from '@auth0/auth0-react';
import { Alert, CircularProgress, Stack } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { flattenPages } from '@/api/flattenPages';
import { CollectionCardsBrowser } from './CollectionCardsBrowser';
import { CollectionHeader } from './CollectionHeader';
import { applyCollectionCardsIntent, readCollectionCardsIntent } from './collectionCardsIntent';
import { useCollectionCardsByValue, useCollectionSummary } from './queries';
import { emptyBinderSearch, type BinderSearch } from '@/shared/binder/binderSearch';
import { useGroups } from '@/shared/cards/queries';

/** Unpriced cards sort last; one-shot navigation intent seeds state once and is cleared from history. */
export function CollectionCardsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const location = useLocation();
  const navigate = useNavigate();

  const [intent] = useState(() => readCollectionCardsIntent(location.state));
  const [search, setSearch] = useState<BinderSearch>(() =>
    applyCollectionCardsIntent(emptyBinderSearch, intent),
  );

  const summary = useCollectionSummary(isAuthenticated);
  const cards = useCollectionCardsByValue(isAuthenticated, search);
  const groups = useGroups(isAuthenticated);
  const items = flattenPages(cards.data?.pages);

  useEffect(() => {
    if (location.state) void navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  const scrolledTo = useRef<string | null>(null);
  useEffect(() => {
    if (!intent.cardId || scrolledTo.current === intent.cardId) return;
    const node = document.getElementById(`collection-card-${intent.cardId}`);
    if (!node) return;
    scrolledTo.current = intent.cardId;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [intent.cardId, items.length]);

  if (authLoading) return <CircularProgress />;
  if (!isAuthenticated) return <Alert severity="info">Sign in to see your cards.</Alert>;

  return (
    <Stack spacing={4}>
      <CollectionHeader
        title="Collection Cards"
        totals={summary.data}
        summaryError={summary.error}
      />
      <CollectionCardsBrowser
        items={items}
        search={search}
        onSearchChange={setSearch}
        groups={groups.data?.items.map((group) => ({ id: group.id, name: group.name }))}
        loading={cards.isLoading}
        error={cards.error?.message}
        isSuccess={cards.isSuccess}
        hasNextPage={cards.hasNextPage}
        isFetchingNextPage={cards.isFetchingNextPage}
        onLoadMore={() => void cards.fetchNextPage()}
        emptyCopy="No cards yet. Add one from your collection."
        emptyFilteredCopy="No cards match these filters."
        initialOpenIds={intent.cardId ? new Set([intent.cardId]) : undefined}
      />
    </Stack>
  );
}

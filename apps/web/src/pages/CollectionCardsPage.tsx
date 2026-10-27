import { useAuth0 } from '@auth0/auth0-react';
import { Alert, Box, Button, CircularProgress, Stack } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  flattenPages,
  useCollectionCardsByValue,
  useCollectionSummary,
  useGroups,
  useSetTradeFlag,
} from '../api/queries';
import { binderSearchIsActive, emptyBinderSearch, type BinderSearch } from '../binderSearch';
import { applyCollectionCardsIntent, readCollectionCardsIntent } from '../collectionCardsIntent';
import { BinderSearchFields } from '../components/BinderSearchFields';
import { CollectionCardDetail } from '../components/CollectionCardDetail';
import { CollectionCardTable } from '../components/CollectionCardTable';
import { CollectionHeader } from '../components/CollectionHeader';

/**
 * Every card in the collection, filtered and ranked.
 *
 * Cards with no known price sit at the bottom with a dash, so the page really
 * does list every card. A navigation may carry a one-shot intent: which row to
 * open, and how to sort and format the change column. It seeds local state once
 * and is then cleared from history, so a refresh or Back starts clean.
 */
export function CollectionCardsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const location = useLocation();
  const navigate = useNavigate();

  const [intent] = useState(() => readCollectionCardsIntent(location.state));
  const [search, setSearch] = useState<BinderSearch>(() =>
    applyCollectionCardsIntent(emptyBinderSearch, intent),
  );
  /** Rows open on this visit. Several can be open at once. */
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(intent.cardId ? [intent.cardId] : []),
  );

  const summary = useCollectionSummary(isAuthenticated);
  const cards = useCollectionCardsByValue(isAuthenticated, search);
  const groups = useGroups(isAuthenticated);
  const setTrade = useSetTradeFlag();

  const items = flattenPages(cards.data?.pages);

  // Consume the intent: a refresh or Back must not apply it again.
  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  // Bring the linked card into view once its row exists. One move per card, so
  // later "Load more" batches cannot pull the page back.
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

  function toggleRow(itemId: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  return (
    <Stack spacing={4}>
      <CollectionHeader
        title="Collection Cards"
        totals={summary.data}
        summaryError={summary.error}
      />

      <Stack spacing={2}>
        <BinderSearchFields
          value={search}
          onChange={setSearch}
          canUseWantList={false}
          showChangeWindow
          groups={groups.data?.items.map((group) => ({ id: group.id, name: group.name }))}
        />

        {cards.isLoading && <CircularProgress />}
        {cards.error && <Alert severity="error">{cards.error.message}</Alert>}
        {cards.isSuccess && items.length === 0 && (
          <Alert severity="info">
            {binderSearchIsActive(search)
              ? 'No cards match these filters.'
              : 'No cards yet. Add one from your collection.'}
          </Alert>
        )}

        {items.length > 0 && (
          <CollectionCardTable
            items={items}
            expandedIds={openIds}
            onRowClick={(item) => toggleRow(item.id)}
            sort={search.sort}
            dir={search.dir}
            changeMode={search.changeMode}
            tradeSaving={setTrade.isPending}
            onToggleTrade={(item) => setTrade.mutate({ itemId: item.id, forTrade: !item.forTrade })}
            onSortChange={(sort, dir) => setSearch((current) => ({ ...current, sort, dir }))}
            renderDetail={(item) => (
              <CollectionCardDetail itemId={item.id} defaultRange={search.range} />
            )}
          />
        )}

        {cards.hasNextPage && (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="outlined"
              onClick={() => void cards.fetchNextPage()}
              disabled={cards.isFetchingNextPage}
            >
              {cards.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </Button>
          </Box>
        )}
      </Stack>
    </Stack>
  );
}

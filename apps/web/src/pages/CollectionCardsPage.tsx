import { useAuth0 } from '@auth0/auth0-react';
import { Alert, Box, Button, CircularProgress, Stack } from '@mui/material';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { flattenPages, useCollectionCardsByValue, useCollectionSummary } from '../api/queries';
import { CollectionCardDetail } from '../components/CollectionCardDetail';
import { CollectionCardTable } from '../components/CollectionCardTable';
import { CollectionHeader } from '../components/CollectionHeader';

/**
 * Every card in the collection, ranked by the value of one copy.
 *
 * Cards with no known price sit at the bottom with a dash, so the page really
 * does list every card. The open row lives in the URL, which makes a link from
 * the dashboard land with that card already expanded.
 */
export function CollectionCardsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const summary = useCollectionSummary(isAuthenticated);
  const cards = useCollectionCardsByValue(isAuthenticated);
  const location = useLocation();

  /** Rows open on this visit. Several can be open at once. */
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());

  const items = flattenPages(cards.data?.pages);
  const incomingId = decodeURIComponent(location.hash.replace(/^#/, ''));

  // The dashboard links to one card with a hash. Only that arrival opens a row;
  // every later click stays in local state and never touches the URL.
  useEffect(() => {
    if (!incomingId) return;
    setOpenIds((current) => (current.has(incomingId) ? current : new Set(current).add(incomingId)));
  }, [incomingId]);

  // Bring the linked card into view once its row exists.
  useEffect(() => {
    if (!incomingId || items.length === 0) return;
    const node = document.getElementById(`collection-card-${incomingId}`);
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [incomingId, items.length]);

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

      {cards.isLoading && <CircularProgress />}
      {cards.error && <Alert severity="error">{cards.error.message}</Alert>}
      {cards.isSuccess && items.length === 0 && (
        <Alert severity="info">No cards yet. Add one from your collection.</Alert>
      )}

      {items.length > 0 && (
        <CollectionCardTable
          items={items}
          expandedIds={openIds}
          onRowClick={(item) => toggleRow(item.id)}
          renderDetail={(item) => <CollectionCardDetail itemId={item.id} />}
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
  );
}

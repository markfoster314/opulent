import { useAuth0 } from '@auth0/auth0-react';
import { Alert, Box, Button, CircularProgress, Divider, Stack, Typography } from '@mui/material';
import type { CollectionItem } from '@opulent/shared';
import { useState } from 'react';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import {
  flattenPages,
  useProfile,
  useTradeBinder,
  useTradeBinderItems,
  useTradeBinderMatches,
} from '../api/queries';
import { emptyBinderSearch, binderSearchIsActive, type BinderSearch } from '../binderSearch';
import { BinderCardDialog } from '../components/BinderCardDialog';
import { BinderSearchFields } from '../components/BinderSearchFields';
import { CardGrid } from '../components/CardGrid';
import { collectionTileCaption, collectionTilePrice, CardTile } from '../components/CardTile';
import { TradeMatchesPanel } from '../components/TradeMatchesPanel';

/**
 * Everything one person has marked for trade, in one place.
 *
 * `?want=1` in the URL opens the page with "On my want lists" already checked,
 * which is how the Find trades page hands someone over.
 */
export function TradeBinderPage() {
  const { handle } = useParams<{ handle: string }>();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth0();
  const [selected, setSelected] = useState<CollectionItem | null>(null);
  const [search, setSearch] = useState<BinderSearch>(() => ({
    ...emptyBinderSearch,
    onWantList: searchParams.get('want') === '1',
  }));

  // Unlisted trade binders are reachable only with ?t=<share token>.
  const shareToken = searchParams.get('t') ?? undefined;

  const binderQuery = useTradeBinder(handle, shareToken);
  const profile = useProfile(isAuthenticated ? handle : undefined);
  const ownBinder = profile.data?.isOwner === true;
  const wantListReady = Boolean(isAuthenticated && profile.data && !ownBinder);
  const itemSearch = { ...search, onWantList: wantListReady && search.onWantList };

  const itemsQuery = useTradeBinderItems(
    binderQuery.data ? handle : undefined,
    itemSearch,
    shareToken,
  );
  const matchesQuery = useTradeBinderMatches(
    handle,
    isAuthenticated && profile.isSuccess && !ownBinder,
    shareToken,
  );

  if (binderQuery.isLoading) return <CircularProgress />;
  if (binderQuery.error) return <Alert severity="error">{binderQuery.error.message}</Alert>;

  const matches = matchesQuery.data?.items ?? [];
  const canTrade = Boolean(isAuthenticated && profile.data && !ownBinder && matches.length > 0);
  const canAddCard = Boolean(handle) && (!isAuthenticated || (profile.isSuccess && !ownBinder));
  const count = binderQuery.data?.cardCount ?? 0;

  return (
    <Stack spacing={4}>
      <Stack spacing={1}>
        <Typography variant="h1" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          @{handle}&apos;s trade binder
        </Typography>
        <Typography color="secondary">
          {count} card{count === 1 ? '' : 's'} for trade.{' '}
          <Box component={RouterLink} to={`/u/${handle}`} sx={{ color: 'primary.main' }}>
            Profile
          </Box>
          {ownBinder && (
            <>
              {' · '}
              <Box component={RouterLink} to="/collection" sx={{ color: 'primary.main' }}>
                Edit in my collection
              </Box>
            </>
          )}
        </Typography>
      </Stack>

      {!isAuthenticated && (
        <Alert severity="info">
          Sign in and add cards to your want list to see which of these are matches for you.
        </Alert>
      )}

      {isAuthenticated && matches.length > 0 && handle && (
        <TradeMatchesPanel
          handle={handle}
          matches={matches}
          canTrade={canTrade}
          sourceLabel={`@${handle}`}
        />
      )}

      {isAuthenticated && matchesQuery.isSuccess && matches.length === 0 && (
        <Alert severity="info">No overlap with your want list yet.</Alert>
      )}

      {canAddCard && (
        <Alert severity="info">Click a card to see its details and add it to a trade.</Alert>
      )}

      <Divider />

      <BinderSearchFields value={search} onChange={setSearch} canUseWantList={wantListReady} />

      {itemsQuery.isLoading && <CircularProgress />}
      {itemsQuery.isFetching && !itemsQuery.isFetchingNextPage && itemsQuery.isPlaceholderData && (
        <Typography color="text.secondary">Updating the list.</Typography>
      )}
      {itemsQuery.error && <Alert severity="error">{itemsQuery.error.message}</Alert>}
      {itemsQuery.isSuccess &&
        !itemsQuery.isPlaceholderData &&
        flattenPages(itemsQuery.data?.pages).length === 0 && (
          <Alert severity="info">
            {binderSearchIsActive(itemSearch)
              ? 'No cards match this search.'
              : 'Nothing marked for trade yet.'}
          </Alert>
        )}

      <CardGrid>
        {flattenPages(itemsQuery.data?.pages).map((item) =>
          item.card ? (
            <CardTile
              key={item.id}
              card={item.card}
              quantity={item.quantity}
              price={collectionTilePrice(item)}
              notes={item.notes?.trim() ? item.notes : null}
              signed={item.signed}
              altered={item.altered}
              misprint={item.misprint}
              miscut={item.miscut}
              artistProof={item.artistProof}
              photoUrl={item.photoUrl}
              caption={collectionTileCaption(item)}
              foil={item.finish === 'foil'}
              onClick={canAddCard ? () => setSelected(item) : undefined}
            />
          ) : null,
        )}
      </CardGrid>

      {itemsQuery.hasNextPage && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="outlined"
            onClick={() => void itemsQuery.fetchNextPage()}
            disabled={itemsQuery.isFetchingNextPage}
          >
            {itemsQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </Box>
      )}

      <BinderCardDialog
        key={selected?.id ?? 'closed'}
        item={selected}
        ownerUsername={canAddCard ? handle : undefined}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </Stack>
  );
}

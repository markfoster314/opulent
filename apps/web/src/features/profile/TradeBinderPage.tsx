import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { CollectionItem } from '@opulent/shared';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams, useSearchParams } from 'react-router-dom';
import { useSession } from '@/app/session';
import { flattenPages } from '@/api/flattenPages';
import { useMe } from '@/features/auth/queries';
import {
  useProfile,
  useTradeBinder,
  useTradeBinderItems,
  useTradeBinderMatches,
} from '@/features/profile/queries';
import {
  emptyBinderSearch,
  binderSearchIsActive,
  type BinderSearch,
} from '@/shared/binder/binderSearch';
import { BinderCardDialog } from '@/features/profile/BinderCardDialog';
import { BinderSearchFields } from '@/shared/binder/BinderSearchFields';
import { CardGrid } from '@/shared/cards/CardGrid';
import { collectionTileCaption, collectionTilePrice, CardTile } from '@/shared/cards/CardTile';
import { TradeBinderSettings } from '@/features/profile/TradeBinderSettings';
import { TradeMatchesPanel } from '@/features/matches';
import { palette } from '@/theme';

/** ?want=1 and ?generic=1 open with the matching filter checked. */
export function TradeBinderPage() {
  const { handle } = useParams<{ handle: string }>();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useSession();
  const [selected, setSelected] = useState<CollectionItem | null>(null);
  const [search, setSearch] = useState<BinderSearch>(() => ({
    ...emptyBinderSearch,
    onWantList: searchParams.get('want') === '1',
    onGenericWant: searchParams.get('generic') === '1',
  }));
  const [preview, setPreview] = useState(false);

  // Reset to the owner so a new binder never opens mid-preview.
  useEffect(() => {
    setPreview(false);
  }, [handle]);

  // Unlisted binders are reachable only with the ?t= share token.
  const shareToken = searchParams.get('t') ?? undefined;

  const binderQuery = useTradeBinder(handle, shareToken);
  const profile = useProfile(isAuthenticated ? handle : undefined);
  const me = useMe(isAuthenticated);
  const ownBinder = profile.data?.isOwner === true;
  const viewingAsVisitor = ownBinder && preview;
  const wantListReady = Boolean(isAuthenticated && profile.data && !ownBinder);
  const itemSearch = {
    ...search,
    onWantList: wantListReady && search.onWantList,
    onGenericWant: wantListReady && search.onGenericWant,
  };

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
  const canOpenCard = canAddCard || viewingAsVisitor;
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
          {ownBinder && !viewingAsVisitor && (
            <>
              {' · '}
              <Box component={RouterLink} to="/collection" sx={{ color: 'primary.main' }}>
                Edit in my collection
              </Box>
            </>
          )}
        </Typography>
      </Stack>

      {ownBinder && !viewingAsVisitor && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            Viewing as owner
          </Typography>
          <Button
            size="small"
            variant="outlined"
            startIcon={<VisibilityOutlinedIcon />}
            onClick={() => setPreview(true)}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            View as visitor
          </Button>
        </Stack>
      )}

      {ownBinder && !viewingAsVisitor && me.data && <TradeBinderSettings me={me.data} />}

      {viewingAsVisitor && (
        <Paper
          sx={{
            px: 2,
            py: 1.5,
            borderColor: palette.goldBorder,
            background: palette.goldTint,
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="body2">Previewing as a visitor</Typography>
            <Button
              size="small"
              variant="outlined"
              onClick={() => setPreview(false)}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Exit preview
            </Button>
          </Stack>
        </Paper>
      )}

      {!isAuthenticated && (
        <Alert severity="info">
          Sign in and add wants to see which of these are matches for you.
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
        <Alert severity="info">No overlap with your wants yet.</Alert>
      )}

      {canAddCard && !viewingAsVisitor && (
        <Alert severity="info">Click a card to see its details and add it to a trade.</Alert>
      )}

      <Divider />

      <BinderSearchFields value={search} onChange={setSearch} canUseWantList={wantListReady} />

      {itemsQuery.isLoading && <CircularProgress />}
      {itemsQuery.isFetching && !itemsQuery.isFetchingNextPage && itemsQuery.isPlaceholderData && (
        <Typography
          sx={{
            color: 'text.secondary',
          }}
        >
          Updating the list.
        </Typography>
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
              onClick={canOpenCard ? () => setSelected(item) : undefined}
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
        ownerUsername={canAddCard && !viewingAsVisitor ? handle : undefined}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </Stack>
  );
}

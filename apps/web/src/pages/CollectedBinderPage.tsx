import { useAuth0 } from '@auth0/auth0-react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import type { BinderItem, Page } from '@opulent/shared';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { flattenPages, useAllBinderItems, useProfile, usePublicBinderItems } from '../api/queries';
import { binderSearchIsActive, emptyBinderSearch, type BinderSearch } from '../binderSearch';
import { BinderCardDialog } from '../components/BinderCardDialog';
import { BinderSearchFields } from '../components/BinderSearchFields';
import { CardGrid } from '../components/CardGrid';
import { binderTileCaption, binderTilePrice, CardTile } from '../components/CardTile';

type ItemQuery = UseInfiniteQueryResult<InfiniteData<Page<BinderItem>>, Error>;

export function MineAllBinderPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const items = useAllBinderItems(isAuthenticated);
  if (authLoading) return <CircularProgress />;
  if (!isAuthenticated) return <Alert severity="info">Sign in to see all of your cards.</Alert>;
  return (
    <CollectedBinderView
      title="All cards"
      subtitle="Every card across your binders."
      items={items}
    />
  );
}

export function PublicAllBinderPage() {
  const { handle } = useParams<{ handle: string }>();
  const { isAuthenticated } = useAuth0();
  const profile = useProfile(handle && isAuthenticated ? handle : undefined);
  const wantListReady = Boolean(isAuthenticated && profile.data && !profile.data.isOwner);
  const [search, setSearch] = useState<BinderSearch>(emptyBinderSearch);
  const itemSearch = { ...search, onWantList: wantListReady && search.onWantList };
  const items = usePublicBinderItems(handle, itemSearch);
  return (
    <CollectedBinderView
      title="All public cards"
      subtitle={`Cards @${handle ?? ''} has in public binders.`}
      items={items}
      tradeHandle={handle}
      search={search}
      itemSearch={itemSearch}
      onSearchChange={setSearch}
      canUseWantList={wantListReady}
    />
  );
}

function CollectedBinderView({
  title,
  subtitle,
  items,
  tradeHandle,
  search,
  itemSearch,
  onSearchChange,
  canUseWantList = false,
}: {
  title: string;
  subtitle: string;
  items: ItemQuery;
  tradeHandle?: string | undefined;
  search?: BinderSearch | undefined;
  itemSearch?: BinderSearch | undefined;
  onSearchChange?: ((value: BinderSearch) => void) | undefined;
  canUseWantList?: boolean | undefined;
}) {
  const { isAuthenticated } = useAuth0();
  const profile = useProfile(tradeHandle && isAuthenticated ? tradeHandle : undefined);
  const ownBinder = profile.data?.isOwner === true;
  const canAdd = Boolean(tradeHandle) && (!isAuthenticated || (profile.isSuccess && !ownBinder));
  const [selected, setSelected] = useState<BinderItem | null>(null);

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h1">{title}</Typography>
        <Typography color="text.secondary">{subtitle}</Typography>
      </Stack>
      {search && onSearchChange && (
        <BinderSearchFields
          value={search}
          onChange={onSearchChange}
          canUseWantList={canUseWantList}
        />
      )}
      <Alert severity="info">Click a card to see its details.</Alert>
      {items.isLoading && <CircularProgress />}
      {items.isFetching && !items.isFetchingNextPage && items.isPlaceholderData && (
        <Typography color="text.secondary">Updating the list.</Typography>
      )}
      {items.error && <Alert severity="error">{items.error.message}</Alert>}
      {items.isSuccess &&
        !items.isPlaceholderData &&
        flattenPages(items.data?.pages).length === 0 && (
          <Alert severity="info">
            {itemSearch && binderSearchIsActive(itemSearch)
              ? 'No cards match this search.'
              : 'No cards here yet.'}
          </Alert>
        )}
      <CardGrid>
        {flattenPages(items.data?.pages).map((item) =>
          item.card ? (
            <CardTile
              key={item.id}
              card={item.card}
              quantity={item.quantity}
              price={binderTilePrice(item)}
              notes={item.notes?.trim() ? item.notes : null}
              signed={item.signed}
              altered={item.altered}
              misprint={item.misprint}
              miscut={item.miscut}
              artistProof={item.artistProof}
              photoUrl={item.photoUrl}
              caption={binderTileCaption(item)}
              foil={item.finish === 'foil'}
              onClick={() => setSelected(item)}
            />
          ) : null,
        )}
      </CardGrid>
      {items.hasNextPage && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="outlined"
            onClick={() => void items.fetchNextPage()}
            disabled={items.isFetchingNextPage}
          >
            {items.isFetchingNextPage ? 'Loading' : 'Load more'}
          </Button>
        </Box>
      )}
      <BinderCardDialog
        key={selected?.id ?? 'closed'}
        item={selected}
        ownerUsername={canAdd ? tradeHandle : undefined}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </Stack>
  );
}

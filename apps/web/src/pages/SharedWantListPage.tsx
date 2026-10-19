import { Alert, CircularProgress, Stack, Typography } from '@mui/material';
import { useParams, useSearchParams } from 'react-router-dom';
import { useSharedWantItems, useSharedWantList } from '../api/queries';
import { CardGrid } from '../components/CardGrid';
import { WantItemTile } from '../components/WantItemTile';

export function SharedWantListPage() {
  const { handle, slug } = useParams<{ handle: string; slug: string }>();
  const [searchParams] = useSearchParams();
  const shareToken = searchParams.get('t') ?? undefined;

  const listQuery = useSharedWantList(handle, slug, shareToken);
  const itemsQuery = useSharedWantItems(handle, slug, shareToken);
  const items = itemsQuery.data?.items ?? [];

  if (listQuery.isLoading) return <CircularProgress />;
  if (listQuery.error) return <Alert severity="error">{listQuery.error.message}</Alert>;

  const list = listQuery.data;

  return (
    <Stack spacing={4}>
      <Stack spacing={1}>
        <Typography variant="h1" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          {list?.name}
        </Typography>
        <Typography color="secondary">Shared by @{handle}</Typography>
        {list?.description && <Typography color="text.secondary">{list.description}</Typography>}
        <Typography variant="body2" color="secondary">
          {items.length} card{items.length === 1 ? '' : 's'}
        </Typography>
      </Stack>

      {itemsQuery.isLoading && <CircularProgress />}
      {itemsQuery.error && <Alert severity="error">{itemsQuery.error.message}</Alert>}

      {itemsQuery.isSuccess && items.length === 0 && (
        <Alert severity="info">This list is empty.</Alert>
      )}

      <CardGrid>
        {items.map((want) => (
          <WantItemTile
            key={want.id}
            item={want}
            readOnly
            onUpdate={() => undefined}
            onRemove={() => undefined}
            saving={false}
          />
        ))}
      </CardGrid>
    </Stack>
  );
}

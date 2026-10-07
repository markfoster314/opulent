import { useAuth0 } from '@auth0/auth0-react';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { binderVisibilityLabels } from '@opulent/shared';
import { useCallback, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import {
  flattenPages,
  useAddBinderItem,
  useBinder,
  useBinderItems,
  useMe,
  useRemoveBinderItem,
  useUpdateBinderItem,
} from '../api/queries';
import { BinderSettingsDialog } from '../components/BinderSettingsDialog';
import { BinderItemTile } from '../components/BinderItemTile';
import { CardGrid } from '../components/CardGrid';
import { CardSearchField } from '../components/CardSearchField';

export function BinderDetailPage() {
  const { binderId } = useParams<{ binderId: string }>();
  const { isAuthenticated } = useAuth0();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const me = useMe(isAuthenticated);
  const binderQuery = useBinder(binderId);
  const itemsQuery = useBinderItems(binderId);

  const addItem = useAddBinderItem(binderId ?? '');
  const updateItem = useUpdateBinderItem(binderId ?? '');
  const removeItem = useRemoveBinderItem(binderId ?? '');

  // Stable identities keep the quantity stepper's debounce timer from resetting
  // on every parent re-render.
  const handleUpdate = useCallback(
    (itemId: string, input: Parameters<typeof updateItem.mutate>[0]['input']) =>
      updateItem.mutate({ itemId, input }),
    [updateItem],
  );
  const handleRemove = useCallback((itemId: string) => removeItem.mutate(itemId), [removeItem]);

  if (!isAuthenticated) return <Alert severity="info">Sign in to edit this binder.</Alert>;
  if (binderQuery.isLoading) return <CircularProgress />;
  if (binderQuery.error) return <Alert severity="error">{binderQuery.error.message}</Alert>;

  const binder = binderQuery.data;
  if (!binder) return <Alert severity="error">Binder not found.</Alert>;

  const items = flattenPages(itemsQuery.data?.pages);
  const totalCards = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Stack spacing={4}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ sm: 'flex-start' }}
      >
        <Stack spacing={1}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="h1">{binder.name}</Typography>
            <Chip
              label={binderVisibilityLabels[binder.visibility]}
              size="small"
              variant="outlined"
              color={binder.visibility === 'private' ? 'default' : 'primary'}
            />
          </Stack>

          {binder.description && (
            <Typography color="text.secondary">{binder.description}</Typography>
          )}

          <Typography variant="body2" color="text.secondary">
            {totalCards} card{totalCards === 1 ? '' : 's'} across {items.length} stack
            {items.length === 1 ? '' : 's'}
            {itemsQuery.hasNextPage ? ' so far' : ''}
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1}>
          {binder.visibility !== 'private' && me.data && (
            <Button
              component={RouterLink}
              to={`/u/${me.data.handle}/${binder.slug}`}
              variant="outlined"
            >
              View as visitor
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<SettingsOutlinedIcon />}
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h3" sx={{ mb: 2 }}>
          Add a card
        </Typography>
        <CardSearchField
          onSelect={(card) =>
            addItem.mutate({
              scryfallId: card.scryfallId,
              quantity: 1,
              finish: 'nonfoil',
              condition: 'NM',
              language: 'en',
              forTrade: true,
            })
          }
          disabled={addItem.isPending}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Adding a card you already have raises its count instead of making a second entry.
        </Typography>
        {addItem.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {addItem.error.message}
          </Alert>
        )}
      </Paper>

      {itemsQuery.isLoading && <CircularProgress />}
      {itemsQuery.error && <Alert severity="error">{itemsQuery.error.message}</Alert>}

      {itemsQuery.isSuccess && items.length === 0 && (
        <Alert severity="info">This binder is empty. Add a card above.</Alert>
      )}

      <CardGrid>
        {items.map((item) => (
          <BinderItemTile
            key={item.id}
            item={item}
            onUpdate={handleUpdate}
            onRemove={handleRemove}
            saving={updateItem.isPending || removeItem.isPending}
            error={updateItem.error?.message ?? removeItem.error?.message}
          />
        ))}
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

      <BinderSettingsDialog
        binder={binder}
        handle={me.data?.handle}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </Stack>
  );
}

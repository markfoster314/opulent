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
import type { Card } from '@opulent/shared';
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
import { AddCardPanel } from '../components/AddCardPanel';
import { BinderSettingsDialog } from '../components/BinderSettingsDialog';
import { BinderItemTile } from '../components/BinderItemTile';
import { CardGrid } from '../components/CardGrid';
import { CardSearchField } from '../components/CardSearchField';

export function BinderDetailPage() {
  const { binderId } = useParams<{ binderId: string }>();
  const { isAuthenticated } = useAuth0();
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** The card chosen from search, waiting on printing and condition before it is added. */
  const [draftCard, setDraftCard] = useState<Card | undefined>(undefined);

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
          <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap flexWrap="wrap">
            <Typography variant="h1" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              {binder.name}
            </Typography>
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

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          {binder.visibility !== 'private' && me.data && (
            <Button
              component={RouterLink}
              to={`/u/${me.data.username}/${binder.slug}`}
              variant="outlined"
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              View as visitor
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<SettingsOutlinedIcon />}
            onClick={() => setSettingsOpen(true)}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Settings
          </Button>
        </Stack>
      </Stack>

      <Stack spacing={2}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h3" sx={{ mb: 2 }}>
            Add a card
          </Typography>
          <CardSearchField onSelect={setDraftCard} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Pick a card, then choose its printing and condition before it goes in. Adding a card you
            already have raises its count instead of making a second entry.
          </Typography>
        </Paper>

        {draftCard && (
          <AddCardPanel
            // Remounts on a different card so the previous choices do not carry over.
            key={draftCard.oracleId}
            card={draftCard}
            onAdd={(input) =>
              addItem.mutate(input, {
                // Keep the panel open on failure so the owner's choices survive.
                onSuccess: () => setDraftCard(undefined),
              })
            }
            onCancel={() => setDraftCard(undefined)}
            pending={addItem.isPending}
            error={addItem.error?.message}
          />
        )}
      </Stack>

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
        username={me.data?.username}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </Stack>
  );
}

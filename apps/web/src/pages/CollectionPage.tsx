import { useAuth0 } from '@auth0/auth0-react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { Card } from '@opulent/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  flattenPages,
  useAddCollectionItem,
  useCollectionItems,
  useCollectionSummary,
  useCreateGroup,
  useExportCollection,
  useGroups,
  useMe,
  useRemoveCollectionItem,
  useUpdateCollectionItem,
} from '../api/queries';
import { binderSearchIsActive, emptyBinderSearch, type BinderSearch } from '../binderSearch';
import { AddCardPanel } from '../components/AddCardPanel';
import { CollectionItemTile } from '../components/CollectionItemTile';
import { BinderSearchFields } from '../components/BinderSearchFields';
import { CardGrid } from '../components/CardGrid';
import { CardSearchField } from '../components/CardSearchField';
import { PlusMinusButton } from '../components/PlusMinusButton';
import { TradeBinderSettings } from '../components/TradeBinderSettings';
import { takePendingAdd } from '../pendingAdd';
import { clickableSurfaceSx, palette } from '../theme';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Hands the CSV text to the browser as a file download. */
function downloadCsv(csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'opulent-tutor-collection.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Every card the signed-in person owns, in one place.
 *
 * The For trade switch on each tile is what fills their trade binder. Groups
 * are optional labels, and a card can sit in several of them.
 */
export function CollectionPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const me = useMe(isAuthenticated);
  const summary = useCollectionSummary(isAuthenticated);
  const [search, setSearch] = useState<BinderSearch>(emptyBinderSearch);
  const itemsQuery = useCollectionItems(isAuthenticated, search);
  const [draftCard, setDraftCard] = useState<Card | undefined>(undefined);

  const addItem = useAddCollectionItem();
  const updateItem = useUpdateCollectionItem();
  const removeItem = useRemoveCollectionItem();
  const exportCsv = useExportCollection();

  const [addedNotice, setAddedNotice] = useState<string | null>(null);
  const draftTaken = useRef(false);

  /**
   * A visitor who chose a card before signing up gets it added here, once.
   * The draft is taken before the request, so a second mount cannot repeat it.
   */
  useEffect(() => {
    if (!isAuthenticated || draftTaken.current) return;
    draftTaken.current = true;
    const draft = takePendingAdd();
    if (!draft) return;
    addItem.mutate(draft.input, {
      onSuccess: () =>
        setAddedNotice(
          `${draft.cardName} is in your collection.${
            draft.input.forTrade ? ' It is marked for trade.' : ''
          }`,
        ),
    });
  }, [isAuthenticated, addItem]);

  // Stable identities keep the quantity stepper's debounce timer from resetting
  // on every parent re-render.
  const handleUpdate = useCallback(
    (itemId: string, input: Parameters<typeof updateItem.mutate>[0]['input']) =>
      updateItem.mutate({ itemId, input }),
    [updateItem],
  );
  const handleRemove = useCallback((itemId: string) => removeItem.mutate(itemId), [removeItem]);

  if (authLoading) return <CircularProgress />;
  if (!isAuthenticated) return <Alert severity="info">Sign in to see your collection.</Alert>;

  const items = flattenPages(itemsQuery.data?.pages);
  const totals = summary.data;

  return (
    <Stack spacing={4}>
      {addedNotice && (
        <Alert severity="success" onClose={() => setAddedNotice(null)}>
          {addedNotice}
        </Alert>
      )}
      {addItem.error && !draftCard && <Alert severity="error">{addItem.error.message}</Alert>}
      <Stack spacing={1}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          justifyContent="space-between"
          alignItems={{ sm: 'center' }}
        >
          <Typography variant="h1">My collection</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexShrink: 0 }}>
            <Button
              component={RouterLink}
              to="/collection/import"
              variant="outlined"
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Import CSV
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              onClick={() => exportCsv.mutate(undefined, { onSuccess: downloadCsv })}
              disabled={exportCsv.isPending}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              {exportCsv.isPending ? 'Preparing…' : 'Export CSV'}
            </Button>
          </Stack>
        </Stack>
        {exportCsv.error && <Alert severity="error">{exportCsv.error.message}</Alert>}
        {totals && (
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            <Chip label={`${totals.cardCount} card${totals.cardCount === 1 ? '' : 's'}`} />
            <Chip label={`${money.format(Number(totals.marketValue))} market value`} />
            <Chip
              color="primary"
              variant="outlined"
              label={`${totals.forTradeCount} for trade · ${money.format(Number(totals.forTradeValue))}`}
            />
          </Stack>
        )}
        {summary.error && <Alert severity="error">{summary.error.message}</Alert>}
      </Stack>

      {me.data && <TradeBinderSettings me={me.data} forTradeCount={totals?.forTradeCount ?? 0} />}

      <Stack spacing={2}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h3" sx={{ mb: 2 }}>
            Add a card
          </Typography>
          <CardSearchField onSelect={setDraftCard} showSet={false} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Pick a card, choose its set, then fill in the details. Adding a card you already have
            raises its count instead of making a second entry.
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

      <GroupsSection />

      <Divider />

      <Stack spacing={2}>
        <Typography variant="h2">All cards</Typography>
        <BinderSearchFields value={search} onChange={setSearch} canUseWantList={false} />
      </Stack>

      {itemsQuery.isLoading && <CircularProgress />}
      {itemsQuery.isFetching && !itemsQuery.isFetchingNextPage && itemsQuery.isPlaceholderData && (
        <Typography color="text.secondary">Updating the list.</Typography>
      )}
      {itemsQuery.error && <Alert severity="error">{itemsQuery.error.message}</Alert>}
      {itemsQuery.isSuccess && !itemsQuery.isPlaceholderData && items.length === 0 && (
        <Alert severity="info">
          {binderSearchIsActive(search)
            ? 'No cards match this search.'
            : 'Your collection is empty. Add a card above.'}
        </Alert>
      )}

      <CardGrid>
        {items.map((item) => (
          <CollectionItemTile
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
    </Stack>
  );
}

/** Private groups. A card can sit in several of them or in none. */
function GroupsSection() {
  const { data, isLoading, error } = useGroups(true);
  const createGroup = useCreateGroup();
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    createGroup.mutate(
      { name: trimmed },
      {
        onSuccess: () => {
          setName('');
          setCreating(false);
        },
      },
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography variant="h2" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          Groups
        </Typography>
        <PlusMinusButton
          open={creating}
          label={creating ? 'Close new group' : 'New group'}
          onClick={() => setCreating((open) => !open)}
        />
      </Stack>

      <Collapse in={creating} unmountOnExit>
        <Paper sx={{ p: 3 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Group name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleCreate()}
              fullWidth
              placeholder="Modern staples"
            />
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={!name.trim() || createGroup.isPending}
              sx={{ minWidth: 140 }}
            >
              Create
            </Button>
          </Stack>
          {createGroup.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {createGroup.error.message}
            </Alert>
          )}
        </Paper>
      </Collapse>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">{error.message}</Alert>}
      {data && data.items.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          No groups yet. They are optional. Use them to mark a pile, like a deck box or a trade
          stack.
        </Typography>
      )}

      <Box
        sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}
      >
        {data?.items.map((group) => (
          <Paper
            key={group.id}
            component={RouterLink}
            to={`/groups/${group.id}`}
            sx={{
              p: 2.5,
              display: 'block',
              minWidth: 0,
              ...clickableSurfaceSx,
              borderColor: palette.steelBorder,
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              useFlexGap
              flexWrap="wrap"
              spacing={1}
            >
              <Typography variant="h3" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                {group.name}
              </Typography>
              <Chip label={`${group.itemCount ?? 0} cards`} size="small" variant="outlined" />
            </Stack>
            {group.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {group.description}
              </Typography>
            )}
          </Paper>
        ))}
      </Box>
    </Stack>
  );
}

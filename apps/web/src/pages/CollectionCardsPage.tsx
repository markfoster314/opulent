import { useAuth0 } from '@auth0/auth0-react';
import type { CollectionItem } from '@opulent/shared';
import CloseIcon from '@mui/icons-material/Close';
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined';
import ViewModuleOutlinedIcon from '@mui/icons-material/ViewModuleOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  flattenPages,
  useCollectionCardsByValue,
  useCollectionSummary,
  useGroups,
  useRemoveCollectionItem,
  useSetTradeFlag,
  useSplitCollectionItem,
  useUpdateCollectionItem,
} from '../api/queries';
import { binderSearchIsActive, emptyBinderSearch, type BinderSearch } from '../binderSearch';
import { applyCollectionCardsIntent, readCollectionCardsIntent } from '../collectionCardsIntent';
import { BinderSearchFields } from '../components/BinderSearchFields';
import { CollectionBinderView } from '../components/CollectionBinderView';
import { CollectionCardDetail } from '../components/CollectionCardDetail';
import { CollectionItemForm } from '../components/CollectionItemForm';
import { CollectionCardTable } from '../components/CollectionCardTable';
import { CollectionSortSelect } from '../components/CollectionSortSelect';
import { CollectionHeader } from '../components/CollectionHeader';
import { palette } from '../theme';

/** Unpriced cards sort last; one-shot navigation intent seeds state once and is cleared from history. */
export function CollectionCardsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth0();
  const location = useLocation();
  const navigate = useNavigate();

  const [intent] = useState(() => readCollectionCardsIntent(location.state));
  const [search, setSearch] = useState<BinderSearch>(() =>
    applyCollectionCardsIntent(emptyBinderSearch, intent),
  );
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(intent.cardId ? [intent.cardId] : []),
  );
  const [view, setView] = useState<'table' | 'binder'>(() =>
    typeof window !== 'undefined' &&
    window.localStorage.getItem('collection-card-view') === 'binder'
      ? 'binder'
      : 'table',
  );
  const [selectedBinderId, setSelectedBinderId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<CollectionItem | null>(null);
  const [editMode, setEditMode] = useState<'all' | 'one'>('all');
  const [deleteItem, setDeleteItem] = useState<CollectionItem | null>(null);
  const theme = useTheme();
  const fullScreenDialog = useMediaQuery(theme.breakpoints.down('sm'));

  const summary = useCollectionSummary(isAuthenticated);
  const cards = useCollectionCardsByValue(isAuthenticated, search);
  const groups = useGroups(isAuthenticated);
  const setTrade = useSetTradeFlag();
  const updateItem = useUpdateCollectionItem();
  const removeItem = useRemoveCollectionItem();
  const splitItem = useSplitCollectionItem();

  const items = flattenPages(cards.data?.pages);

  useEffect(() => {
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    window.localStorage.setItem('collection-card-view', view);
  }, [view]);

  // Scroll to the linked card once; later "Load more" batches must not pull the page back.
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
          trailing={
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={1}
              sx={{ width: { xs: '100%', md: 'auto' } }}
            >
              <CollectionSortSelect
                sort={search.sort}
                dir={search.dir}
                onChange={(sort, dir) => setSearch((current) => ({ ...current, sort, dir }))}
              />
              <ToggleButtonGroup
                exclusive
                size="small"
                value={view}
                onChange={(_event, next: 'table' | 'binder' | null) => {
                  if (next) setView(next);
                }}
                aria-label="Card view"
                sx={{ width: { xs: '100%', md: 'auto' }, flexShrink: 0 }}
              >
                <ToggleButton value="table" sx={{ flex: { xs: 1, md: 'initial' }, gap: 0.5 }}>
                  <TableRowsOutlinedIcon fontSize="small" />
                  Table
                </ToggleButton>
                <ToggleButton value="binder" sx={{ flex: { xs: 1, md: 'initial' }, gap: 0.5 }}>
                  <ViewModuleOutlinedIcon fontSize="small" />
                  Binder
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          }
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

        {items.length > 0 &&
          (view === 'binder' ? (
            <CollectionBinderView items={items} onSelect={(item) => setSelectedBinderId(item.id)} />
          ) : (
            <CollectionCardTable
              items={items}
              expandedIds={openIds}
              onRowClick={(item) => toggleRow(item.id)}
              sort={search.sort}
              dir={search.dir}
              changeMode={search.changeMode}
              tradeSaving={setTrade.isPending}
              onToggleTrade={(item) =>
                setTrade.mutate({ itemId: item.id, forTrade: !item.forTrade })
              }
              onSortChange={(sort, dir) => setSearch((current) => ({ ...current, sort, dir }))}
              renderDetail={(item) => (
                <CollectionCardDetail
                  itemId={item.id}
                  defaultRange={search.range}
                  onDeleted={() => toggleRow(item.id)}
                />
              )}
            />
          ))}

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

      <Dialog
        open={Boolean(selectedBinderId || editItem || deleteItem)}
        onClose={() => {
          setSelectedBinderId(null);
          setEditItem(null);
          setDeleteItem(null);
        }}
        fullWidth
        maxWidth="md"
        fullScreen={fullScreenDialog}
        scroll="paper"
        slotProps={{ paper: { sx: { borderColor: palette.goldBorder } } }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            pr: 1,
          }}
        >
          {deleteItem ? (
            <Typography variant="h3" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              Delete this stack?
            </Typography>
          ) : editItem ? (
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Typography
                variant="overline"
                sx={{ color: palette.goldLight, letterSpacing: '0.14em', lineHeight: 1.4 }}
              >
                {editMode === 'one' ? 'Edit one copy' : 'Edit card'}
              </Typography>
              <Typography
                variant="h2"
                component="span"
                sx={{ display: 'block', overflowWrap: 'anywhere' }}
              >
                {editItem.card?.name ?? 'Card'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                {[
                  editItem.card?.setName,
                  editItem.card?.setCode?.toUpperCase(),
                  editItem.card?.collectorNumber,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            </Stack>
          ) : (
            <Typography variant="h3" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              {items.find((item) => item.id === selectedBinderId)?.name ?? 'Card details'}
            </Typography>
          )}
          <IconButton
            onClick={() => {
              setSelectedBinderId(null);
              setEditItem(null);
              setDeleteItem(null);
            }}
            aria-label={editItem || deleteItem ? 'Close card editor' : 'Close card details'}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent
          dividers={Boolean(editItem || deleteItem)}
          sx={{ p: editItem || deleteItem ? { xs: 2, sm: 3 } : 0 }}
        >
          {deleteItem ? (
            <Stack spacing={2}>
              <Typography>
                Remove all {deleteItem.quantity} copies of {deleteItem.card?.name ?? 'this card'}?
              </Typography>
              {removeItem.error && <Alert severity="error">{removeItem.error.message}</Alert>}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                <Button
                  onClick={() => setDeleteItem(null)}
                  disabled={removeItem.isPending}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Cancel
                </Button>
                <Button
                  color="error"
                  variant="contained"
                  disabled={removeItem.isPending}
                  onClick={() => {
                    removeItem.mutate(deleteItem.id, {
                      onSuccess: () => {
                        setDeleteItem(null);
                        setEditItem(null);
                        setSelectedBinderId(null);
                      },
                    });
                  }}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  {removeItem.isPending ? 'Deleting…' : 'Delete'}
                </Button>
              </Stack>
            </Stack>
          ) : editItem ? (
            <CollectionItemForm
              item={editItem}
              mode={editMode}
              onClose={() => setEditItem(null)}
              onSave={(input) => {
                const id = editItem.id;
                if (editMode === 'one') {
                  splitItem.mutate({ itemId: id, input }, { onSuccess: () => setEditItem(null) });
                  return;
                }
                updateItem.mutate({ itemId: id, input }, { onSuccess: () => setEditItem(null) });
              }}
              onDelete={() => {
                const id = editItem.id;
                removeItem.mutate(id, {
                  onSuccess: () => {
                    setEditItem(null);
                    setSelectedBinderId(null);
                  },
                });
              }}
              saving={splitItem.isPending || updateItem.isPending || removeItem.isPending}
              error={
                splitItem.error?.message ?? updateItem.error?.message ?? removeItem.error?.message
              }
            />
          ) : selectedBinderId ? (
            <CollectionCardDetail
              itemId={selectedBinderId}
              defaultRange={search.range}
              onEditRequest={(item, mode) => {
                setEditItem(item);
                setEditMode(mode);
              }}
              onDeleteRequest={(item) => setDeleteItem(item)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}

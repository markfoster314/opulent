import { useAuth0 } from '@auth0/auth0-react';
import { useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CloseIcon from '@mui/icons-material/Close';
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined';
import ViewModuleOutlinedIcon from '@mui/icons-material/ViewModuleOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Fade,
  IconButton,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { Card, CollectionItem } from '@opulent/shared';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  flattenPages,
  queryKeys,
  useAddCollectionItem,
  useAddGroupMember,
  useCollectionCardsByValue,
  useDeleteGroup,
  useExportCollection,
  useGroup,
  useRemoveCollectionItem,
  useRemoveGroupMember,
  useSetTradeFlag,
  useSplitCollectionItem,
  useUpdateCollectionItem,
  useUpdateGroup,
} from '../api/queries';
import { binderSearchIsActive, emptyBinderSearch, type BinderSearch } from '../binderSearch';
import { AddCardPanel } from '../components/AddCardPanel';
import { BinderSearchFields } from '../components/BinderSearchFields';
import { CardSearchField } from '../components/CardSearchField';
import { CollectionBinderView } from '../components/CollectionBinderView';
import { CollectionCardDetail } from '../components/CollectionCardDetail';
import { CollectionCardTable } from '../components/CollectionCardTable';
import { CollectionItemForm } from '../components/CollectionItemForm';
import { CollectionSortSelect } from '../components/CollectionSortSelect';
import { palette } from '../theme';

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Removing a card here leaves it in the collection. */
export function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { isAuthenticated } = useAuth0();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState<BinderSearch>(emptyBinderSearch);
  const [view, setView] = useState<'table' | 'binder'>(() =>
    typeof window !== 'undefined' &&
    window.localStorage.getItem('collection-card-view') === 'binder'
      ? 'binder'
      : 'table',
  );
  const [addOpen, setAddOpen] = useState(false);
  const [panelClosing, setPanelClosing] = useState(false);
  const [draftCard, setDraftCard] = useState<Card | undefined>(undefined);
  const [addFocus, setAddFocus] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [selectedBinderId, setSelectedBinderId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<CollectionItem | null>(null);
  const [editMode, setEditMode] = useState<'all' | 'one'>('all');
  const [deleteItem, setDeleteItem] = useState<CollectionItem | null>(null);
  const theme = useTheme();
  const fullScreenDialog = useMediaQuery(theme.breakpoints.down('sm'));

  const groupQuery = useGroup(groupId);
  const cardsQuery = useCollectionCardsByValue(isAuthenticated && Boolean(groupId), {
    ...search,
    groupId: groupId ?? '',
  });
  const addItem = useAddCollectionItem();
  const addMember = useAddGroupMember(groupId ?? '');
  const removeMember = useRemoveGroupMember(groupId ?? '');
  const updateItem = useUpdateCollectionItem();
  const removeItem = useRemoveCollectionItem();
  const splitItem = useSplitCollectionItem();
  const updateGroup = useUpdateGroup(groupId ?? '');
  const deleteGroup = useDeleteGroup();
  const setTrade = useSetTradeFlag();
  const exportCollection = useExportCollection(groupId);

  const group = groupQuery.data;
  const currentGroup = group;
  const items = flattenPages(cardsQuery.data?.pages);

  useEffect(() => {
    if (!group) return;
    setName(group.name);
    setDescription(group.description ?? '');
    // Reset the fields only when the group changes; a refetch must not overwrite edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id]);

  useEffect(() => {
    window.localStorage.setItem('collection-card-view', view);
  }, [view]);

  if (!isAuthenticated) return <Alert severity="info">Sign in to open a group.</Alert>;
  if (groupQuery.isLoading) return <CircularProgress />;
  if (groupQuery.error) return <Alert severity="error">{groupQuery.error.message}</Alert>;
  if (!group) return <Alert severity="error">Group not found.</Alert>;

  function closeAdd() {
    setAddOpen(false);
  }

  function handlePanelClosed() {
    if (!panelClosing) return;
    setDraftCard(undefined);
    setPanelClosing(false);
    setAddFocus((current) => current + 1);
  }

  function startEditing() {
    if (!currentGroup) return;
    setName(currentGroup.name);
    setDescription(currentGroup.description ?? '');
    setEditing(true);
  }

  function cancelEditing() {
    if (!currentGroup) return;
    setName(currentGroup.name);
    setDescription(currentGroup.description ?? '');
    setEditing(false);
  }

  function saveGroup() {
    if (!currentGroup) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    updateGroup.mutate(
      { name: trimmed, description: description.trim() },
      { onSuccess: () => setEditing(false) },
    );
  }

  function toggleRow(itemId: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function refreshAfterMembership() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.collection });
  }

  function removeFromGroup(itemId: string, close = false) {
    removeMember.mutate(itemId, {
      onSuccess: () => {
        if (close) {
          setSelectedBinderId(null);
          setEditItem(null);
        }
        refreshAfterMembership();
      },
    });
  }

  return (
    <Stack spacing={4}>
      <Button
        component={RouterLink}
        to="/collection"
        startIcon={<ArrowBackIcon />}
        sx={{ alignSelf: 'flex-start' }}
      >
        My collection
      </Button>

      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ sm: 'flex-start' }}
        >
          <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
            {editing ? (
              <Stack spacing={1.25}>
                <Stack spacing={0.25}>
                  <Typography variant="overline" color="text.secondary">
                    Group name
                  </Typography>
                  <TextField
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Group name"
                    variant="standard"
                    fullWidth
                    slotProps={{
                      input: {
                        disableUnderline: true,
                        sx: {
                          p: 0,
                          fontSize: { xs: '2rem', sm: '2.75rem' },
                          fontWeight: 700,
                          lineHeight: 1.2,
                        },
                      },
                    }}
                  />
                </Stack>
                <Stack spacing={0.25}>
                  <Typography variant="overline" color="text.secondary">
                    Description
                  </Typography>
                  <TextField
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Description"
                    variant="standard"
                    fullWidth
                    multiline
                    minRows={1}
                    maxRows={6}
                    slotProps={{
                      input: {
                        disableUnderline: true,
                        sx: { p: 0, fontSize: '1rem', lineHeight: 1.5 },
                      },
                    }}
                  />
                </Stack>
              </Stack>
            ) : (
              <Stack spacing={0.75}>
                <Typography variant="h1" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                  {group.name}
                </Typography>
                {group.description && (
                  <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                    {group.description}
                  </Typography>
                )}
              </Stack>
            )}
          </Stack>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            sx={{ flexShrink: 0 }}
          >
            {editing ? (
              <>
                <Button
                  variant="contained"
                  onClick={saveGroup}
                  disabled={!name.trim() || updateGroup.isPending}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Save
                </Button>
                <Button onClick={cancelEditing} sx={{ width: { xs: '100%', sm: 'auto' } }}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outlined"
                  startIcon={<EditOutlinedIcon />}
                  onClick={startEditing}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Edit
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => setConfirmDelete(true)}
                  disabled={deleteGroup.isPending}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Delete group
                </Button>
              </>
            )}
          </Stack>
        </Stack>

        {updateGroup.error && <Alert severity="error">{updateGroup.error.message}</Alert>}
        {deleteGroup.error && <Alert severity="error">{deleteGroup.error.message}</Alert>}
      </Stack>

      <Divider />

      <Stack spacing={2}>
        {/* Shared Stack child keeps spacing stable when the add panel unmounts. */}
        <Box>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h2">Cards</Typography>
              <Chip size="small" label={group.itemCount ?? 0} />
            </Stack>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              justifyContent={{ sm: 'flex-end' }}
            >
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => (addOpen ? closeAdd() : setAddOpen(true))}
                aria-expanded={addOpen}
                aria-controls="add-card-section"
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Add a card
              </Button>
              <Button
                component={RouterLink}
                to={`/collection/import?group=${group.id}`}
                variant="outlined"
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Import CSV
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                onClick={() =>
                  exportCollection.mutate(undefined, {
                    onSuccess: (csv) => downloadCsv(csv, 'opulent-tutor-group.csv'),
                  })
                }
                disabled={exportCollection.isPending}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                {exportCollection.isPending ? 'Preparing…' : 'Export CSV'}
              </Button>
            </Stack>
          </Stack>

          {exportCollection.error && (
            <Alert severity="error">{exportCollection.error.message}</Alert>
          )}

          <Collapse
            in={addOpen}
            unmountOnExit
            onExited={() => {
              setDraftCard(undefined);
              setPanelClosing(false);
            }}
          >
            <Box sx={{ pt: 2 }}>
              <Stack spacing={2} id="add-card-section">
                <Paper sx={{ p: { xs: 2, sm: 3 } }}>
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography
                        variant="overline"
                        sx={{ color: palette.goldLight, letterSpacing: '0.14em' }}
                      >
                        Add a card
                      </Typography>
                      <IconButton size="small" onClick={closeAdd} aria-label="Close add card">
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <CardSearchField
                      onSelect={(card) => {
                        setDraftCard(card);
                        setPanelClosing(false);
                      }}
                      showSet={false}
                      focusSignal={addFocus}
                    />
                  </Stack>
                </Paper>

                {draftCard && (
                  <Collapse
                    in={!panelClosing}
                    timeout={260}
                    unmountOnExit
                    onExited={handlePanelClosed}
                  >
                    <Fade in={!panelClosing} timeout={260}>
                      <Box>
                        <AddCardPanel
                          key={draftCard.oracleId}
                          card={draftCard}
                          defaultGroupId={group.id}
                          onAdd={(input) =>
                            addItem.mutate(input, {
                              onSuccess: (item) =>
                                addMember.mutate(item.id, {
                                  onSuccess: () => {
                                    setPanelClosing(true);
                                    refreshAfterMembership();
                                  },
                                }),
                            })
                          }
                          onCancel={() => setPanelClosing(true)}
                          pending={addItem.isPending || addMember.isPending}
                          error={addItem.error?.message ?? addMember.error?.message}
                        />
                      </Box>
                    </Fade>
                  </Collapse>
                )}
              </Stack>
            </Box>
          </Collapse>
        </Box>

        <BinderSearchFields
          value={search}
          onChange={setSearch}
          canUseWantList={false}
          showChangeWindow
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

        {cardsQuery.isLoading && <CircularProgress />}
        {cardsQuery.error && <Alert severity="error">{cardsQuery.error.message}</Alert>}
        {removeMember.error && <Alert severity="error">{removeMember.error.message}</Alert>}
        {cardsQuery.isSuccess && items.length === 0 && (
          <Alert severity="info">
            {binderSearchIsActive(search)
              ? 'No cards match this search.'
              : 'No cards in this group yet.'}
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
                  onRemoveFromGroup={(detail) => removeFromGroup(detail.id)}
                />
              )}
            />
          ))}

        {cardsQuery.hasNextPage && (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="outlined"
              onClick={() => void cardsQuery.fetchNextPage()}
              disabled={cardsQuery.isFetchingNextPage}
            >
              {cardsQuery.isFetchingNextPage ? 'Loading…' : 'Load more'}
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
            <Typography variant="h3">Delete this stack?</Typography>
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
                  onClick={() =>
                    removeItem.mutate(deleteItem.id, {
                      onSuccess: () => {
                        setDeleteItem(null);
                        setEditItem(null);
                        setSelectedBinderId(null);
                      },
                    })
                  }
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
              onDelete={() =>
                removeItem.mutate(editItem.id, {
                  onSuccess: () => {
                    setEditItem(null);
                    setSelectedBinderId(null);
                  },
                })
              }
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
              onRemoveFromGroup={(detail) => removeFromGroup(detail.id, true)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} fullWidth maxWidth="xs">
        <DialogTitle>Delete group?</DialogTitle>
        <DialogContent>
          <Typography>{group.name} will be deleted. Its cards stay in your collection.</Typography>
          {deleteGroup.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteGroup.error.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDelete(false)} disabled={deleteGroup.isPending}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteGroup.isPending}
            onClick={() => {
              deleteGroup.mutate(group.id, {
                onSuccess: () => {
                  void navigate('/collection');
                },
              });
            }}
          >
            {deleteGroup.isPending ? 'Deleting…' : 'Delete group'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

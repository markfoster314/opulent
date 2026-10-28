import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
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
  Typography,
} from '@mui/material';
import type { Card } from '@opulent/shared';
import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useSession } from '@/app/session';
import { flattenPages } from '@/api/flattenPages';
import { CollectionCardsBrowser } from '@/features/collection';
import {
  useAddCollectionItem,
  useCollectionCardsByValue,
  useExportCollection,
} from '@/features/collection/queries';
import {
  useAddGroupMember,
  useDeleteGroup,
  useGroup,
  useRemoveGroupMember,
  useUpdateGroup,
} from '@/features/groups/queries';
import { emptyBinderSearch, type BinderSearch } from '@/shared/binder/binderSearch';
import { AddCardPanel } from '@/shared/cards/AddCardPanel';
import { CardSearchField } from '@/shared/cards/CardSearchField';
import { GroupHeader } from './GroupHeader';
import { palette } from '@/theme';

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
  const { isAuthenticated } = useSession();
  const navigate = useNavigate();

  const [search, setSearch] = useState<BinderSearch>(emptyBinderSearch);
  const [addOpen, setAddOpen] = useState(false);
  const [panelClosing, setPanelClosing] = useState(false);
  const [draftCard, setDraftCard] = useState<Card | undefined>(undefined);
  const [addFocus, setAddFocus] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const groupQuery = useGroup(isAuthenticated ? groupId : undefined);
  const cardsQuery = useCollectionCardsByValue(isAuthenticated && Boolean(groupId), {
    ...search,
    groupId: groupId ?? '',
  });
  const addItem = useAddCollectionItem();
  const addMember = useAddGroupMember(groupId ?? '');
  const removeMember = useRemoveGroupMember(groupId ?? '');
  const updateGroup = useUpdateGroup(groupId ?? '');
  const deleteGroup = useDeleteGroup();
  const exportCollection = useExportCollection(groupId);

  const group = groupQuery.data;
  const items = flattenPages(cardsQuery.data?.pages);

  useEffect(() => {
    if (!group) return;
    setName(group.name);
    setDescription(group.description ?? '');
    // Reset the fields only when the group changes; a refetch must not overwrite edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id]);

  if (!isAuthenticated) return <Alert severity="info">Sign in to open a group.</Alert>;
  if (groupQuery.isLoading) return <CircularProgress />;
  if (groupQuery.error) return <Alert severity="error">{groupQuery.error.message}</Alert>;
  if (!group) return <Alert severity="error">Group not found.</Alert>;

  const currentGroup = group;

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
    setName(currentGroup.name);
    setDescription(currentGroup.description ?? '');
    setEditing(true);
  }

  function cancelEditing() {
    setName(currentGroup.name);
    setDescription(currentGroup.description ?? '');
    setEditing(false);
  }

  function saveGroup() {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateGroup.mutate(
      { name: trimmed, description: description.trim() },
      { onSuccess: () => setEditing(false) },
    );
  }

  return (
    <Stack spacing={4}>
      <GroupHeader
        group={group}
        editing={editing}
        name={name}
        description={description}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        onStartEdit={startEditing}
        onCancelEdit={cancelEditing}
        onSave={saveGroup}
        onDelete={() => setConfirmDelete(true)}
        saving={updateGroup.isPending}
        deleting={deleteGroup.isPending}
        saveError={updateGroup.error?.message}
        deleteError={deleteGroup.error?.message}
      />

      <Divider />

      <Stack spacing={2}>
        <Box>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{
              justifyContent: 'space-between',
              alignItems: { xs: 'stretch', sm: 'center' },
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: 'center',
              }}
            >
              <Typography variant="h2">Cards</Typography>
              <Chip size="small" label={group.itemCount ?? 0} />
            </Stack>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              useFlexGap
              sx={{
                flexWrap: 'wrap',
                justifyContent: { sm: 'flex-end' },
              }}
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
                    <Stack
                      direction="row"
                      sx={{
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
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
                                  onSuccess: () => setPanelClosing(true),
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

        <CollectionCardsBrowser
          items={items}
          search={search}
          onSearchChange={setSearch}
          loading={cardsQuery.isLoading}
          error={cardsQuery.error?.message}
          extraError={removeMember.error?.message}
          isSuccess={cardsQuery.isSuccess}
          hasNextPage={cardsQuery.hasNextPage}
          isFetchingNextPage={cardsQuery.isFetchingNextPage}
          onLoadMore={() => void cardsQuery.fetchNextPage()}
          emptyCopy="No cards in this group yet."
          emptyFilteredCopy="No cards match this search."
          onRemoveFromGroup={(itemId) => removeMember.mutate(itemId)}
        />
      </Stack>

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

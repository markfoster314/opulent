import { useAuth0 } from '@auth0/auth0-react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { Card } from '@opulent/shared';
import { useCallback, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  flattenPages,
  useAddCollectionItem,
  useAddGroupMember,
  useDeleteGroup,
  useGroup,
  useGroupItems,
  useRemoveGroupMember,
  useUpdateCollectionItem,
  useUpdateGroup,
} from '../api/queries';
import { binderSearchIsActive, emptyBinderSearch, type BinderSearch } from '../binderSearch';
import { AddCardPanel } from '../components/AddCardPanel';
import { BinderSearchFields } from '../components/BinderSearchFields';
import { CardGrid } from '../components/CardGrid';
import { CardSearchField } from '../components/CardSearchField';
import { CollectionItemTile } from '../components/CollectionItemTile';

/**
 * One private group and the cards carrying its label.
 *
 * A group is a label, not a home. Removing a card here takes the label off and
 * leaves the card in the collection.
 */
export function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { isAuthenticated } = useAuth0();
  const navigate = useNavigate();

  const [search, setSearch] = useState<BinderSearch>(emptyBinderSearch);
  const [draftCard, setDraftCard] = useState<Card | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const groupQuery = useGroup(groupId);
  const itemsQuery = useGroupItems(groupId, search);

  const addItem = useAddCollectionItem();
  const addMember = useAddGroupMember(groupId ?? '');
  const removeMember = useRemoveGroupMember(groupId ?? '');
  const updateItem = useUpdateCollectionItem();
  const updateGroup = useUpdateGroup(groupId ?? '');
  const deleteGroup = useDeleteGroup();

  // Stable identities keep the quantity stepper's debounce timer from resetting
  // on every parent re-render.
  const handleUpdate = useCallback(
    (itemId: string, input: Parameters<typeof updateItem.mutate>[0]['input']) =>
      updateItem.mutate({ itemId, input }),
    [updateItem],
  );
  const handleRemove = useCallback((itemId: string) => removeMember.mutate(itemId), [removeMember]);

  if (!isAuthenticated) return <Alert severity="info">Sign in to open a group.</Alert>;
  if (groupQuery.isLoading) return <CircularProgress />;
  if (groupQuery.error) return <Alert severity="error">{groupQuery.error.message}</Alert>;

  const group = groupQuery.data;
  if (!group) return <Alert severity="error">Group not found.</Alert>;

  const items = flattenPages(itemsQuery.data?.pages);
  const totalCards = items.reduce((sum, item) => sum + item.quantity, 0);

  function startEditing() {
    if (!group) return;
    setName(group.name);
    setDescription(group.description ?? '');
    setEditing(true);
  }

  function saveGroup() {
    if (!group) return;
    updateGroup.mutate(
      { name: name.trim(), description: description.trim() },
      { onSuccess: () => setEditing(false) },
    );
  }

  function handleDelete() {
    if (!group) return;
    deleteGroup.mutate(group.id, { onSuccess: () => navigate('/collection') });
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
        <Typography variant="h1" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          {group.name}
        </Typography>
        {group.description && <Typography color="text.secondary">{group.description}</Typography>}
        <Typography variant="body2" color="secondary">
          {totalCards} card{totalCards === 1 ? '' : 's'} in this group
          {itemsQuery.hasNextPage ? ' so far' : ''}
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button
            variant="outlined"
            onClick={startEditing}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Rename
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={handleDelete}
            disabled={deleteGroup.isPending}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Delete group
          </Button>
        </Stack>
        {deleteGroup.error && <Alert severity="error">{deleteGroup.error.message}</Alert>}

        {editing && (
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <TextField
                label="Group name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                fullWidth
              />
              <TextField
                label="Description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button
                  variant="contained"
                  onClick={saveGroup}
                  disabled={!name.trim() || updateGroup.isPending}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Save
                </Button>
                <Button onClick={() => setEditing(false)}>Cancel</Button>
              </Stack>
              {updateGroup.error && <Alert severity="error">{updateGroup.error.message}</Alert>}
            </Stack>
          </Paper>
        )}
      </Stack>

      <Stack spacing={2}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h3" sx={{ mb: 2 }}>
            Add a card
          </Typography>
          <CardSearchField onSelect={setDraftCard} showSet={false} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            The card goes into your collection and into this group. Adding a card you already have
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
                // The card exists first, then the label is attached to it.
                onSuccess: (item) =>
                  addMember.mutate(item.id, { onSuccess: () => setDraftCard(undefined) }),
              })
            }
            onCancel={() => setDraftCard(undefined)}
            pending={addItem.isPending || addMember.isPending}
            error={addItem.error?.message ?? addMember.error?.message}
          />
        )}
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h2">Cards</Typography>
        <BinderSearchFields value={search} onChange={setSearch} canUseWantList={false} />
      </Stack>

      {itemsQuery.isLoading && <CircularProgress />}
      {itemsQuery.error && <Alert severity="error">{itemsQuery.error.message}</Alert>}
      {itemsQuery.isSuccess && !itemsQuery.isPlaceholderData && items.length === 0 && (
        <Alert severity="info">
          {binderSearchIsActive(search)
            ? 'No cards match this search.'
            : 'No cards in this group yet. Add one above.'}
        </Alert>
      )}

      <Typography variant="caption" color="text.secondary">
        Removing a card here only takes it out of this group. The card stays in your collection.
      </Typography>

      <CardGrid>
        {items.map((item) => (
          <CollectionItemTile
            key={item.id}
            item={item}
            onUpdate={handleUpdate}
            onRemove={handleRemove}
            saving={updateItem.isPending || removeMember.isPending}
            error={updateItem.error?.message ?? removeMember.error?.message}
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

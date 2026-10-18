import { useAuth0 } from '@auth0/auth0-react';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import type { Card, UpdateWantItemInput } from '@opulent/shared';
import { binderVisibilityLabels } from '@opulent/shared';
import { useCallback, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  useAddWantItem,
  useDeleteWantList,
  useMe,
  useRemoveWantItem,
  useUpdateWantItem,
  useWantItems,
  useWantList,
} from '../api/queries';
import { CardGrid } from '../components/CardGrid';
import { CardSearchField } from '../components/CardSearchField';
import { WantCardPanel } from '../components/WantCardPanel';
import { WantItemTile } from '../components/WantItemTile';
import { WantListSettingsDialog } from '../components/WantListSettingsDialog';

export function WantListPage() {
  const { listId } = useParams<{ listId: string }>();
  const { isAuthenticated } = useAuth0();
  const navigate = useNavigate();
  const [draftCard, setDraftCard] = useState<Card | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const me = useMe(isAuthenticated);

  const listQuery = useWantList(listId);
  const itemsQuery = useWantItems(listId);
  const addItem = useAddWantItem(listId ?? '');
  const updateItem = useUpdateWantItem(listId ?? '');
  const removeItem = useRemoveWantItem(listId ?? '');
  const deleteList = useDeleteWantList();

  const handleUpdate = useCallback(
    (wantId: string, input: UpdateWantItemInput) => updateItem.mutate({ wantId, input }),
    [updateItem],
  );
  const handleRemove = useCallback((wantId: string) => removeItem.mutate(wantId), [removeItem]);

  if (!isAuthenticated) return <Alert severity="info">Sign in to edit this list.</Alert>;
  if (listQuery.isLoading) return <CircularProgress />;
  if (listQuery.error) return <Alert severity="error">{listQuery.error.message}</Alert>;

  const list = listQuery.data;
  if (!list) return <Alert severity="error">List not found.</Alert>;

  const items = itemsQuery.data?.items ?? [];

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
              {list.name}
            </Typography>
            <Chip
              label={binderVisibilityLabels[list.visibility]}
              size="small"
              variant="outlined"
              color={list.visibility === 'private' ? 'default' : 'primary'}
            />
          </Stack>
          {list.description && (
            <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {list.description}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            {list.itemCount ?? items.length} card{(list.itemCount ?? items.length) === 1 ? '' : 's'}
          </Typography>
        </Stack>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          {list.visibility !== 'private' && me.data && (
            <Button
              component={RouterLink}
              to={
                list.visibility === 'unlisted' && list.shareToken
                  ? `/u/${me.data.username}/wants/${list.slug}?t=${list.shareToken}`
                  : `/u/${me.data.username}/wants/${list.slug}`
              }
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
          <Button
            color="error"
            variant="outlined"
            onClick={() => setConfirmDelete(true)}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Delete list
          </Button>
        </Stack>
      </Stack>

      <Stack spacing={2}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h3" sx={{ mb: 2 }}>
            Add a card
          </Typography>
          <CardSearchField
            label="Find a card you are hunting"
            onSelect={setDraftCard}
            showSet={false}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Check a language, printing, condition, or set. Any stays on until you check a choice.
            Adding a card already on this list raises its count.
          </Typography>
        </Paper>

        {draftCard && (
          <WantCardPanel
            key={draftCard.oracleId}
            card={draftCard}
            onAdd={(input) =>
              addItem.mutate(input, {
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
        <Alert severity="info">This list is empty. Add a card above.</Alert>
      )}

      <CardGrid>
        {items.map((want) => (
          <WantItemTile
            key={want.id}
            item={want}
            onUpdate={handleUpdate}
            onRemove={handleRemove}
            saving={updateItem.isPending || removeItem.isPending}
            error={updateItem.error?.message ?? removeItem.error?.message}
          />
        ))}
      </CardGrid>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} fullWidth>
        <DialogTitle>Delete this list?</DialogTitle>
        <DialogContent>
          <Typography>{list.name} and the cards on it will be removed.</Typography>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteList.isPending}
            onClick={() =>
              deleteList.mutate(list.id, {
                onSuccess: () => navigate('/wants'),
              })
            }
          >
            Delete list
          </Button>
        </DialogActions>
      </Dialog>

      <WantListSettingsDialog
        list={list}
        username={me.data?.username}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </Stack>
  );
}

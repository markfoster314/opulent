import { useAuth0 } from '@auth0/auth0-react';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { binderVisibilityLabels } from '@opulent/shared';
import { useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  useDeleteWantList,
  useExportWants,
  useWantItems,
  useUpdateWantList,
  useWantList,
  useWantLists,
} from '@/features/wants/queries';
import { useMe } from '@/features/auth/queries';
import { WantAddSection } from '@/features/wants/WantAddSection';
import { WantCardsBrowser } from '@/features/wants/WantCardsBrowser';
import { WantListSettingsDialog } from '@/features/wants/WantListSettingsDialog';

export function WantListPage() {
  const { listId } = useParams<{ listId: string }>();
  const { isAuthenticated } = useAuth0();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const me = useMe(isAuthenticated);

  const listQuery = useWantList(isAuthenticated ? listId : undefined);
  const itemsQuery = useWantItems(isAuthenticated ? listId : undefined);
  const listsQuery = useWantLists(isAuthenticated);
  const deleteList = useDeleteWantList();
  const exportWants = useExportWants(listId);
  const updateList = useUpdateWantList(listId ?? '');

  if (!isAuthenticated) return <Alert severity="info">Sign in to edit this list.</Alert>;
  if (listQuery.isLoading) return <CircularProgress />;
  if (listQuery.error) return <Alert severity="error">{listQuery.error.message}</Alert>;

  const list = listQuery.data;
  if (!list) return <Alert severity="error">List not found.</Alert>;
  const currentList = list;

  const items = itemsQuery.data?.items ?? [];
  const lists = listsQuery.data?.items ?? [];

  function startEditing() {
    setName(currentList.name);
    setDescription(currentList.description ?? '');
    setEditing(true);
  }

  function cancelEditing() {
    setName(currentList.name);
    setDescription(currentList.description ?? '');
    setEditing(false);
  }

  function saveList() {
    const trimmed = name.trim();
    if (!trimmed) return;
    updateList.mutate(
      { name: trimmed, description: description.trim() },
      { onSuccess: () => setEditing(false) },
    );
  }

  return (
    <Stack spacing={4}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          justifyContent="space-between"
          alignItems={{ sm: 'flex-start' }}
        >
          <Stack spacing={1} sx={{ minWidth: 0, flex: 1 }}>
            {editing ? (
              <Stack spacing={1.25}>
                <Stack spacing={0.25}>
                  <Typography variant="overline" color="text.secondary">
                    List name
                  </Typography>
                  <TextField
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="List name"
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
              <Stack spacing={1}>
                <Stack direction="row" spacing={1.5} alignItems="center" useFlexGap flexWrap="wrap">
                  <Typography variant="h1" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                    {list.name}
                  </Typography>
                  <Chip
                    label={binderVisibilityLabels[list.visibility]}
                    size="small"
                    variant="outlined"
                    color={list.visibility === 'public' ? 'primary' : 'secondary'}
                  />
                </Stack>
                {list.description && (
                  <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                    {list.description}
                  </Typography>
                )}
                <Typography variant="body2" color="secondary">
                  {list.itemCount ?? items.length} card
                  {(list.itemCount ?? items.length) === 1 ? '' : 's'}
                </Typography>
              </Stack>
            )}
          </Stack>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            justifyContent={{ sm: 'flex-end' }}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            {editing ? (
              <>
                <Button
                  variant="contained"
                  onClick={saveList}
                  disabled={!name.trim() || updateList.isPending}
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
                  startIcon={<SettingsOutlinedIcon />}
                  onClick={() => setSettingsOpen(true)}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Settings
                </Button>
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
                  color="error"
                  variant="outlined"
                  onClick={() => setConfirmDelete(true)}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Delete list
                </Button>
              </>
            )}
          </Stack>
        </Stack>

        {updateList.error && <Alert severity="error">{updateList.error.message}</Alert>}
      </Stack>

      <Divider />

      <Stack spacing={2}>
        <Box>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            justifyContent="space-between"
            alignItems={{ xs: 'stretch', sm: 'center' }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h2">Cards</Typography>
              <Chip size="small" label={list.itemCount ?? items.length} />
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
                onClick={() => setAddOpen((open) => !open)}
                aria-expanded={addOpen}
                aria-controls="add-want-section"
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Add a card
              </Button>
              <Button
                component={RouterLink}
                to={`/wants/import?list=${list.id}`}
                variant="outlined"
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                Import CSV
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                onClick={() =>
                  exportWants.mutate(undefined, {
                    onSuccess: (csv) => {
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = 'opulent-tutor-wants.csv';
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      URL.revokeObjectURL(url);
                    },
                  })
                }
                disabled={exportWants.isPending}
                sx={{ width: { xs: '100%', sm: 'auto' } }}
              >
                {exportWants.isPending ? 'Preparing…' : 'Export CSV'}
              </Button>
            </Stack>
          </Stack>

          {exportWants.error && <Alert severity="error">{exportWants.error.message}</Alert>}

          <WantAddSection
            open={addOpen}
            onClose={() => setAddOpen(false)}
            lists={lists}
            defaultListId={list.id}
          />
        </Box>

        <WantCardsBrowser
          items={items}
          lists={lists}
          mode="list"
          listId={list.id}
          loading={itemsQuery.isLoading}
          error={itemsQuery.error?.message}
        />
      </Stack>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} fullWidth>
        <DialogTitle>Delete this list?</DialogTitle>
        <DialogContent>
          <Typography>{list.name} will be deleted. Its cards stay in All wants.</Typography>
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteList.isPending}
            onClick={() =>
              deleteList.mutate(list.id, {
                onSuccess: () => {
                  void navigate('/wants');
                },
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

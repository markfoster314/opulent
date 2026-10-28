import CloseIcon from '@mui/icons-material/Close';
import TableRowsOutlinedIcon from '@mui/icons-material/TableRowsOutlined';
import ViewModuleOutlinedIcon from '@mui/icons-material/ViewModuleOutlined';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
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
import type { WantItem, WantList } from '@opulent/shared';
import { useEffect, useState } from 'react';
import { useDeleteWantItem, useRemoveWantItem, useUpdateWantItem } from '../api/queries';
import { palette } from '../theme';
import {
  sortWants,
  WANT_PAGE_SIZE,
  WANT_VIEW_KEY,
  type WantSort,
  type WantSortDir,
} from '../wantBrowser';
import { WantBinderView } from './WantBinderView';
import { WantCardDetail } from './WantCardDetail';
import { WantCardTable } from './WantCardTable';
import { WantItemDialog } from './WantItemDialog';
import { WantItemForm } from './WantItemForm';
import { WantSortSelect } from './WantSortSelect';

interface WantCardsBrowserProps {
  items: WantItem[];
  lists: WantList[];
  mode: 'all' | 'list';
  listId?: string;
  loading?: boolean;
  error?: string | undefined;
}

/** List context changes only how removal works. */
export function WantCardsBrowser({
  items,
  lists,
  mode,
  listId,
  loading = false,
  error,
}: WantCardsBrowserProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const updateItem = useUpdateWantItem(listId ?? '');
  const removeFromList = useRemoveWantItem(listId ?? '');
  const deleteWant = useDeleteWantItem();

  const [view, setView] = useState<'table' | 'binder'>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem(WANT_VIEW_KEY) === 'binder'
      ? 'binder'
      : 'table',
  );
  const [sort, setSort] = useState<WantSort>('priority');
  const [dir, setDir] = useState<WantSortDir>('asc');
  const [visible, setVisible] = useState(WANT_PAGE_SIZE);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const selectedItem = selectedId ? items.find((item) => item.id === selectedId) : undefined;
  const editItem = editId ? items.find((item) => item.id === editId) : undefined;
  const deleteItem = deleteId ? items.find((item) => item.id === deleteId) : undefined;
  const removeLabel = mode === 'list' ? 'Remove from list' : 'Delete want';

  useEffect(() => {
    window.localStorage.setItem(WANT_VIEW_KEY, view);
  }, [view]);

  useEffect(() => {
    setVisible(WANT_PAGE_SIZE);
  }, [sort, dir, mode]);

  useEffect(() => {
    if (selectedId && !selectedItem) setSelectedId(null);
  }, [selectedId, selectedItem]);

  useEffect(() => {
    if (editId && !editItem) setEditId(null);
  }, [editId, editItem]);

  useEffect(() => {
    if (deleteId && !deleteItem) setDeleteId(null);
  }, [deleteId, deleteItem]);

  const sorted = sortWants(items, sort, dir);
  const shown = sorted.slice(0, visible);
  const saving = updateItem.isPending || removeFromList.isPending || deleteWant.isPending;
  const mutationError =
    updateItem.error?.message ?? removeFromList.error?.message ?? deleteWant.error?.message;

  function toggleRow(itemId: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function closeHost() {
    setSelectedId(null);
    setEditId(null);
    setDeleteId(null);
  }

  function updateQuantity(item: WantItem, quantity: number) {
    updateItem.mutate({ wantId: item.id, input: { quantity } });
  }

  function requestEdit(item: WantItem) {
    setEditId(item.id);
  }

  function requestDelete(item: WantItem) {
    setDeleteId(item.id);
  }

  function confirmDelete() {
    if (!deleteItem) return;
    const mutation = mode === 'list' ? removeFromList : deleteWant;
    mutation.mutate(deleteItem.id, {
      onSuccess: () => {
        setDeleteId(null);
        setEditId(null);
        setSelectedId(null);
      },
    });
  }

  function saveEditor(input: Parameters<typeof updateItem.mutate>[0]['input']) {
    if (!editItem) return;
    updateItem.mutate(
      { wantId: editItem.id, input },
      {
        onSuccess: () => {
          setEditId(null);
        },
      },
    );
  }

  function deleteFromEditor() {
    if (!editItem) return;
    const id = editItem.id;
    setEditId(null);
    setDeleteId(id);
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={1}
        justifyContent="flex-end"
        sx={{ width: '100%' }}
      >
        <WantSortSelect
          sort={sort}
          dir={dir}
          onChange={(nextSort, nextDir) => {
            setSort(nextSort);
            setDir(nextDir);
          }}
        />
        <ToggleButtonGroup
          exclusive
          size="small"
          value={view}
          onChange={(_event, next: 'table' | 'binder' | null) => {
            if (next) setView(next);
          }}
          aria-label="Want view"
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

      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {mutationError && <Alert severity="error">{mutationError}</Alert>}

      {!loading && !error && items.length === 0 && (
        <Alert severity="info">No wants here yet.</Alert>
      )}

      {items.length > 0 &&
        (view === 'table' ? (
          <WantCardTable
            items={shown}
            expandedIds={openIds}
            onRowClick={(item) => toggleRow(item.id)}
            sort={sort}
            dir={dir}
            onSortChange={(nextSort, nextDir) => {
              setSort(nextSort);
              setDir(nextDir);
            }}
            renderDetail={(item) => (
              <WantCardDetail
                item={item}
                mode={mode}
                onEditRequest={() => requestEdit(item)}
                onDeleteRequest={() => requestDelete(item)}
                onUpdateQuantity={(quantity) => updateQuantity(item, quantity)}
                saving={saving}
                error={updateItem.error?.message}
              />
            )}
          />
        ) : (
          <WantBinderView items={shown} onSelect={(item) => setSelectedId(item.id)} />
        ))}

      {visible < sorted.length && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="outlined"
            onClick={() => setVisible((current) => current + WANT_PAGE_SIZE)}
          >
            Load more
          </Button>
        </Box>
      )}

      {!selectedId && editItem && (
        <WantItemDialog
          item={editItem}
          lists={lists}
          open
          onClose={() => setEditId(null)}
          onSave={saveEditor}
          onDelete={deleteFromEditor}
          saving={saving}
          error={
            updateItem.error?.message ?? removeFromList.error?.message ?? deleteWant.error?.message
          }
          removeLabel={removeLabel}
        />
      )}

      {!selectedId && deleteItem && (
        <Dialog
          open
          onClose={() => setDeleteId(null)}
          fullWidth
          maxWidth="xs"
          fullScreen={fullScreen}
        >
          <DialogTitle>{mode === 'list' ? 'Remove from list?' : 'Delete this want?'}</DialogTitle>
          <DialogContent>
            <Typography>
              {mode === 'list'
                ? `${deleteItem.cardName ?? 'This card'} will leave this list. It stays in All wants.`
                : `${deleteItem.cardName ?? 'This card'} will be removed from All wants.`}
            </Typography>
            {mutationError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {mutationError}
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
            <Button onClick={() => setDeleteId(null)} disabled={saving}>
              Cancel
            </Button>
            <Button color="error" variant="contained" onClick={confirmDelete} disabled={saving}>
              {mode === 'list' ? 'Remove' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      <Dialog
        open={Boolean(selectedId)}
        onClose={closeHost}
        fullWidth
        maxWidth="md"
        fullScreen={fullScreen}
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
            <Typography variant="h3">
              {mode === 'list' ? 'Remove from list?' : 'Delete this want?'}
            </Typography>
          ) : editItem ? (
            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
              <Typography
                variant="overline"
                sx={{ color: palette.goldLight, letterSpacing: '0.14em', lineHeight: 1.4 }}
              >
                Edit want
              </Typography>
              <Typography
                variant="h2"
                component="span"
                sx={{ display: 'block', overflowWrap: 'anywhere' }}
              >
                {editItem.cardName ?? 'Card'}
              </Typography>
            </Stack>
          ) : (
            <Typography variant="h3" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              {selectedItem?.cardName ?? 'Want details'}
            </Typography>
          )}
          <IconButton onClick={closeHost} aria-label="Close want details">
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
                {mode === 'list'
                  ? `${deleteItem.cardName ?? 'This card'} will leave this list. It stays in All wants.`
                  : `${deleteItem.cardName ?? 'This card'} will be removed from All wants.`}
              </Typography>
              {mutationError && <Alert severity="error">{mutationError}</Alert>}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                <Button
                  onClick={() => setDeleteId(null)}
                  disabled={saving}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Cancel
                </Button>
                <Button
                  color="error"
                  variant="contained"
                  onClick={confirmDelete}
                  disabled={saving}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  {saving ? 'Working…' : mode === 'list' ? 'Remove' : 'Delete'}
                </Button>
              </Stack>
            </Stack>
          ) : editItem ? (
            <WantItemForm
              item={editItem}
              lists={lists}
              onClose={() => setEditId(null)}
              onSave={saveEditor}
              onDelete={deleteFromEditor}
              saving={saving}
              error={
                updateItem.error?.message ??
                removeFromList.error?.message ??
                deleteWant.error?.message
              }
              removeLabel={removeLabel}
            />
          ) : selectedItem ? (
            <WantCardDetail
              item={selectedItem}
              mode={mode}
              onEditRequest={() => requestEdit(selectedItem)}
              onDeleteRequest={() => requestDelete(selectedItem)}
              onUpdateQuantity={(quantity) => updateQuantity(selectedItem, quantity)}
              saving={saving}
              error={updateItem.error?.message}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}

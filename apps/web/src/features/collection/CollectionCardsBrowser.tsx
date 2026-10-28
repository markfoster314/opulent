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
import type { CollectionHighlight, CollectionItem } from '@opulent/shared';
import { type Dispatch, type SetStateAction, useEffect, useState } from 'react';
import {
  useRemoveCollectionItem,
  useSetTradeFlag,
  useSplitCollectionItem,
  useUpdateCollectionItem,
} from '@/features/collection/queries';
import { binderSearchIsActive, type BinderSearch } from '@/shared/binder/binderSearch';
import { BinderSearchFields } from '@/shared/binder/BinderSearchFields';
import { CollectionBinderView } from './CollectionBinderView';
import { CollectionCardDetail } from './CollectionCardDetail';
import { CollectionCardTable } from './CollectionCardTable';
import { CollectionItemForm } from './CollectionItemForm';
import { CollectionSortSelect } from './CollectionSortSelect';
import { palette } from '@/theme';

const VIEW_KEY = 'collection-card-view';

export interface CollectionCardsBrowserProps {
  items: CollectionHighlight[];
  search: BinderSearch;
  onSearchChange: Dispatch<SetStateAction<BinderSearch>>;
  groups?: { id: string; name: string }[];
  loading?: boolean;
  error?: string;
  extraError?: string;
  isSuccess?: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  emptyCopy: string;
  emptyFilteredCopy: string;
  initialOpenIds?: ReadonlySet<string>;
  onRemoveFromGroup?: (itemId: string, close?: boolean) => void;
}

export function CollectionCardsBrowser({
  items,
  search,
  onSearchChange,
  groups,
  loading = false,
  error,
  extraError,
  isSuccess = false,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  emptyCopy,
  emptyFilteredCopy,
  initialOpenIds,
  onRemoveFromGroup,
}: CollectionCardsBrowserProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set(initialOpenIds));
  const [view, setView] = useState<'table' | 'binder'>(() =>
    typeof window !== 'undefined' && window.localStorage.getItem(VIEW_KEY) === 'binder'
      ? 'binder'
      : 'table',
  );
  const [selectedBinderId, setSelectedBinderId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<CollectionItem | null>(null);
  const [editMode, setEditMode] = useState<'all' | 'one'>('all');
  const [deleteItem, setDeleteItem] = useState<CollectionItem | null>(null);
  const theme = useTheme();
  const fullScreenDialog = useMediaQuery(theme.breakpoints.down('sm'));

  const setTrade = useSetTradeFlag();
  const updateItem = useUpdateCollectionItem();
  const removeItem = useRemoveCollectionItem();
  const splitItem = useSplitCollectionItem();

  useEffect(() => {
    window.localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  function toggleRow(itemId: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function closeDialog() {
    setSelectedBinderId(null);
    setEditItem(null);
    setDeleteItem(null);
  }

  return (
    <Stack spacing={2}>
      <BinderSearchFields
        value={search}
        onChange={(value) => onSearchChange(value)}
        canUseWantList={false}
        showChangeWindow
        groups={groups}
        trailing={
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1}
            sx={{ width: { xs: '100%', md: 'auto' } }}
          >
            <CollectionSortSelect
              sort={search.sort}
              dir={search.dir}
              onChange={(sort, dir) => onSearchChange((current) => ({ ...current, sort, dir }))}
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

      {loading && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}
      {extraError && <Alert severity="error">{extraError}</Alert>}
      {isSuccess && items.length === 0 && (
        <Alert severity="info">
          {binderSearchIsActive(search) ? emptyFilteredCopy : emptyCopy}
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
            onToggleTrade={(item) => setTrade.mutate({ itemId: item.id, forTrade: !item.forTrade })}
            onSortChange={(sort, dir) => onSearchChange((current) => ({ ...current, sort, dir }))}
            renderDetail={(item) => (
              <CollectionCardDetail
                itemId={item.id}
                defaultRange={search.range}
                onDeleted={() => toggleRow(item.id)}
                onRemoveFromGroup={
                  onRemoveFromGroup ? (detail) => onRemoveFromGroup(detail.id) : undefined
                }
              />
            )}
          />
        ))}

      {hasNextPage && onLoadMore && (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button variant="outlined" onClick={onLoadMore} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </Box>
      )}

      <Dialog
        open={Boolean(selectedBinderId || editItem || deleteItem)}
        onClose={closeDialog}
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
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  overflowWrap: 'anywhere',
                }}
              >
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
            onClick={closeDialog}
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
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{
                  justifyContent: 'flex-end',
                }}
              >
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
                      onSuccess: closeDialog,
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
                removeItem.mutate(editItem.id, {
                  onSuccess: closeDialog,
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
              onRemoveFromGroup={
                onRemoveFromGroup
                  ? (detail) => {
                      onRemoveFromGroup(detail.id, true);
                      closeDialog();
                    }
                  : undefined
              }
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}

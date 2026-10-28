import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RemoveIcon from '@mui/icons-material/Remove';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { askingPriceForFinish, formatUsd, priceForFinish } from '@opulent/shared';
import type { CollectionItem, PriceRange } from '@opulent/shared';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  useCollectionItem,
  useRemoveCollectionItem,
  useSplitCollectionItem,
  useUpdateCollectionItem,
} from '../api/queries';
import { palette } from '../theme';
import { CollectionItemDialog } from './CollectionItemDialog';
import { FoilSheen } from './FoilSheen';
import { PriceHistoryChart } from './PriceHistoryChart';

const priceKindLabels = {
  market: 'market',
  percent: '% of market',
  custom: 'custom',
} as const;

export function CollectionCardDetail({
  itemId,
  defaultRange,
  onEditRequest,
  onDeleteRequest,
  onDeleted,
  onRemoveFromGroup,
}: {
  itemId: string;
  defaultRange?: PriceRange;
  onEditRequest?: (item: CollectionItem, mode: 'all' | 'one') => void;
  onDeleteRequest?: (item: CollectionItem) => void;
  onDeleted?: () => void;
  /** Removing from a group leaves the card in the collection. */
  onRemoveFromGroup?: (item: CollectionItem) => void;
}) {
  const query = useCollectionItem(itemId);
  const updateItem = useUpdateCollectionItem();
  const removeItem = useRemoveCollectionItem();
  const splitItem = useSplitCollectionItem();
  const [editMode, setEditMode] = useState<'all' | 'one' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draftQuantity, setDraftQuantity] = useState<number | null>(null);
  const dirtyQuantity = useRef(false);
  const requestedQuantity = useRef<number | null>(null);
  const item = query.data;

  useEffect(() => {
    if (!item) return;
    if (dirtyQuantity.current) {
      if (requestedQuantity.current === null || item.quantity !== requestedQuantity.current) {
        return;
      }
      dirtyQuantity.current = false;
      requestedQuantity.current = null;
    }
    setDraftQuantity(item.quantity);
    // Reset only when the saved quantity changes; other refetches must not overwrite the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.quantity]);

  useEffect(() => {
    if (!item) return;
    setDraftQuantity(item.quantity);
    dirtyQuantity.current = false;
    requestedQuantity.current = null;
    // Reset only on identity changes; a quantity refetch must not reset the draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  useEffect(() => {
    if (!item || draftQuantity === null || draftQuantity === item.quantity) return;
    const timer = window.setTimeout(() => {
      dirtyQuantity.current = true;
      requestedQuantity.current = draftQuantity;
      updateItem.mutate(
        { itemId: item.id, input: { quantity: draftQuantity } },
        {
          onError: () => {
            dirtyQuantity.current = false;
            requestedQuantity.current = null;
            setDraftQuantity(item.quantity);
          },
        },
      );
    }, 450);
    return () => window.clearTimeout(timer);
    // The timer intentionally keys on the draft and saved values, not the whole item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftQuantity, item?.id, item?.quantity]);

  if (query.isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }
  if (query.error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{query.error.message}</Alert>
      </Box>
    );
  }

  if (!item) return null;

  const detail = item;
  const card = item.card;
  const asking = askingPriceForFinish(card?.prices, item.finish, item.price);
  const marks = [
    item.signed ? 'signed' : '',
    item.altered ? 'altered' : '',
    item.misprint ? 'misprint' : '',
    item.miscut ? 'miscut' : '',
    item.artistProof ? 'artist proof' : '',
  ].filter(Boolean);
  const image = card?.imageUris?.normal ?? card?.imageUris?.large ?? card?.imageUris?.small;
  const pending = updateItem.isPending || removeItem.isPending || splitItem.isPending;
  const shownQuantity = draftQuantity ?? item.quantity;
  const quantityDirty = draftQuantity !== null && draftQuantity !== item.quantity;
  const editLocked = quantityDirty || pending;

  function beginEdit(mode: 'all' | 'one') {
    if (editLocked) return;
    if (onEditRequest) onEditRequest(detail, mode);
    else setEditMode(mode);
  }

  function adjustQuantity(delta: number) {
    if (pending) return;
    setDraftQuantity((current) => Math.min(999, Math.max(1, (current ?? detail.quantity) + delta)));
  }

  function requestDelete() {
    if (pending) return;
    if (onDeleteRequest) onDeleteRequest(detail);
    else setConfirmDelete(true);
  }

  function deleteStack() {
    removeItem.mutate(detail.id, {
      onSuccess: () => {
        setConfirmDelete(false);
        onDeleted?.();
      },
    });
  }

  return (
    <Box sx={{ backgroundColor: palette.surfaceRaised, borderTop: `1px solid ${palette.divider}` }}>
      <Stack spacing={2.5} sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5}>
          {image && (
            <Box
              sx={{
                position: 'relative',
                width: { xs: 150, md: 200 },
                alignSelf: { xs: 'center', md: 'flex-start' },
                flexShrink: 0,
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              <Box
                component="img"
                src={image}
                alt={card?.name ?? ''}
                sx={{ width: '100%', display: 'block' }}
              />
              {item.finish === 'foil' && <FoilSheen />}
            </Box>
          )}

          <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={1}
              justifyContent="space-between"
              alignItems="flex-start"
              useFlexGap
              flexWrap="wrap"
            >
              <Typography variant="h3" sx={{ overflowWrap: 'anywhere', flex: 1, minWidth: 150 }}>
                {card?.name ?? 'Card'}
              </Typography>
              <Stack direction="row" spacing={0.25} alignItems="center" sx={{ flexShrink: 0 }}>
                <Tooltip title="Remove one copy">
                  <span>
                    <IconButton
                      size="small"
                      aria-label="Remove one copy"
                      disabled={item.quantity <= 1}
                      aria-disabled={pending || undefined}
                      tabIndex={pending ? -1 : undefined}
                      onClick={() => adjustQuantity(-1)}
                      sx={pending ? { pointerEvents: 'none' } : undefined}
                    >
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Typography
                  variant="body2"
                  sx={{ minWidth: 28, textAlign: 'center', fontWeight: 700 }}
                  aria-label={`${shownQuantity} copies`}
                >
                  ×{shownQuantity}
                </Typography>
                <Tooltip title="Add one copy">
                  <span>
                    <IconButton
                      size="small"
                      aria-label="Add one copy"
                      disabled={shownQuantity >= 999}
                      aria-disabled={pending || undefined}
                      tabIndex={pending ? -1 : undefined}
                      onClick={() => adjustQuantity(1)}
                      sx={pending ? { pointerEvents: 'none' } : undefined}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Delete this stack">
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      aria-label="Delete this stack"
                      aria-disabled={pending || undefined}
                      tabIndex={pending ? -1 : undefined}
                      onClick={requestDelete}
                      sx={pending ? { pointerEvents: 'none' } : undefined}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {[
                card?.setName,
                card?.setCode.toUpperCase(),
                card?.collectorNumber ? `#${card.collectorNumber}` : '',
                card?.rarity,
                card?.lang.toUpperCase(),
              ]
                .filter(Boolean)
                .join(' · ')}
            </Typography>
            {card?.typeLine && <Typography variant="body2">{card.typeLine}</Typography>}
            {card?.manaCost && (
              <Typography variant="body2" color="text.secondary">
                Mana cost: {card.manaCost}
              </Typography>
            )}
            {card?.oracleText && (
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line', maxWidth: '70ch' }}>
                {card.oracleText}
              </Typography>
            )}
            <Stack direction="row" spacing={2} useFlexGap flexWrap="wrap">
              {card?.artist && (
                <Typography variant="caption" color="text.secondary">
                  Art by {card.artist}
                </Typography>
              )}
              {card?.releasedAt && (
                <Typography variant="caption" color="text.secondary">
                  Released {card.releasedAt}
                </Typography>
              )}
              {card?.scryfallUri && (
                <Link href={card.scryfallUri} target="_blank" rel="noreferrer" variant="caption">
                  Scryfall page
                </Link>
              )}
            </Stack>
          </Stack>
        </Stack>

        <Divider />

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
            >
              <Typography variant="h4">
                {item.quantity > 1 ? 'Your copies' : 'Your copy'}
              </Typography>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {item.quantity > 1 ? (
                  <>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<EditOutlinedIcon />}
                      onClick={() => beginEdit('one')}
                      aria-disabled={editLocked || undefined}
                      tabIndex={editLocked ? -1 : undefined}
                      sx={editLocked ? { pointerEvents: 'none' } : undefined}
                    >
                      Edit one
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => beginEdit('all')}
                      aria-disabled={editLocked || undefined}
                      tabIndex={editLocked ? -1 : undefined}
                      sx={editLocked ? { pointerEvents: 'none' } : undefined}
                    >
                      Edit all
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<EditOutlinedIcon />}
                    onClick={() => beginEdit('all')}
                    aria-disabled={editLocked || undefined}
                    tabIndex={editLocked ? -1 : undefined}
                    sx={editLocked ? { pointerEvents: 'none' } : undefined}
                  >
                    Edit
                  </Button>
                )}
                {onRemoveFromGroup && (
                  <Button
                    color="error"
                    variant="outlined"
                    size="small"
                    onClick={() => onRemoveFromGroup(detail)}
                  >
                    Remove from group
                  </Button>
                )}
              </Stack>
            </Stack>
            <DetailRow label="Finish" value={item.finish} />
            <DetailRow label="Condition" value={item.condition} />
            <DetailRow label="Language" value={item.language} />
            <DetailRow label="For trade" value={item.forTrade ? 'Yes' : 'No'} />
            <DetailRow label="Marks" value={marks.length > 0 ? marks.join(', ') : 'None'} />
            <DetailRow
              label="Market price"
              value={formatUsd(priceForFinish(card?.prices, item.finish)) ?? '—'}
            />
            <DetailRow
              label="Price"
              value={`${asking === null ? '—' : (formatUsd(asking) ?? '—')} (${priceKindLabels[item.price.kind]})`}
            />
            <DetailRow
              label="Groups"
              value={
                item.groups.length > 0 ? item.groups.map((group) => group.name).join(', ') : 'None'
              }
            />
            {item.notes && <DetailRow label="Notes" value={item.notes} />}
            {item.photoUrl && (
              <DetailRow
                label="Photos"
                value={
                  <Link href={item.photoUrl} target="_blank" rel="noreferrer">
                    Open photos
                  </Link>
                }
              />
            )}
          </Stack>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <PriceHistoryChart
              scryfallId={item.scryfallId}
              finish={item.finish}
              defaultRange={defaultRange}
            />
          </Box>
        </Stack>
      </Stack>

      {!onEditRequest && editMode && (
        <CollectionItemDialog
          item={item}
          open
          mode={editMode}
          onClose={() => setEditMode(null)}
          onSave={(input) => {
            if (editMode === 'one') {
              splitItem.mutate({ itemId: item.id, input }, { onSuccess: () => setEditMode(null) });
              return;
            }
            updateItem.mutate({ itemId: item.id, input }, { onSuccess: () => setEditMode(null) });
          }}
          onDelete={() =>
            removeItem.mutate(item.id, {
              onSuccess: () => {
                setEditMode(null);
                onDeleted?.();
              },
            })
          }
          saving={splitItem.isPending || updateItem.isPending || removeItem.isPending}
          error={splitItem.error?.message ?? updateItem.error?.message ?? removeItem.error?.message}
        />
      )}

      {!onDeleteRequest && (
        <Dialog
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Delete this stack?</DialogTitle>
          <DialogContent>
            <Typography>
              Remove all {item.quantity} copies of {card?.name ?? 'this card'}?
            </Typography>
            {removeItem.error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {removeItem.error.message}
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
            <Button onClick={() => setConfirmDelete(false)} disabled={removeItem.isPending}>
              Cancel
            </Button>
            <Button
              color="error"
              variant="contained"
              onClick={deleteStack}
              disabled={removeItem.isPending}
            >
              {removeItem.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Stack direction="row" spacing={1.5} justifyContent="space-between" sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ textAlign: 'right', minWidth: 0, overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RemoveIcon from '@mui/icons-material/Remove';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import { Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import type { CollectionItem, UpdateCollectionItemInput } from '@opulent/shared';
import { useEffect, useRef, useState } from 'react';
import { CollectionItemDialog } from './CollectionItemDialog';
import { collectionTileCaption, collectionTilePrice, CardTile } from './CardTile';

interface CollectionItemTileProps {
  item: CollectionItem;
  onUpdate: (itemId: string, input: UpdateCollectionItemInput) => void;
  onRemove: (itemId: string) => void;
  saving: boolean;
  error?: string | undefined;
}

const QUANTITY_DEBOUNCE_MS = 500;

export function CollectionItemTile({
  item,
  onUpdate,
  onRemove,
  saving,
  error,
}: CollectionItemTileProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draftQuantity, setDraftQuantity] = useState(item.quantity);

  // A ref keeps the callback out of the debounce deps, so a re-render cannot restart the timer.
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    setDraftQuantity(item.quantity);
  }, [item.quantity]);

  /** Rapid clicks collapse into one request; the quantity is absolute, so the last write wins. */
  useEffect(() => {
    if (draftQuantity === item.quantity) return;
    const timer = setTimeout(
      () => onUpdateRef.current(item.id, { quantity: draftQuantity }),
      QUANTITY_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [draftQuantity, item.quantity, item.id]);

  if (!item.card) return null;

  const caption = collectionTileCaption(item);

  return (
    <Stack spacing={0.5} sx={{ height: '100%' }}>
      <CardTile
        card={item.card}
        quantity={draftQuantity}
        price={collectionTilePrice(item)}
        notes={item.notes?.trim() ? item.notes : null}
        signed={item.signed}
        altered={item.altered}
        misprint={item.misprint}
        miscut={item.miscut}
        artistProof={item.artistProof}
        photoUrl={item.photoUrl}
        caption={caption}
        foil={item.finish === 'foil'}
        onClick={() => setDialogOpen(true)}
      />

      {item.groups.length > 0 && (
        <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" justifyContent="center">
          {item.groups.map((group) => (
            <Chip key={group.id} label={group.name} size="small" variant="outlined" />
          ))}
        </Stack>
      )}

      <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.25}>
        <IconButton
          size="small"
          aria-label={`One fewer ${item.card.name}`}
          disabled={draftQuantity <= 1}
          onClick={() => setDraftQuantity((current) => Math.max(1, current - 1))}
        >
          <RemoveIcon fontSize="small" />
        </IconButton>

        <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center' }}>
          {draftQuantity}
        </Typography>

        <IconButton
          size="small"
          aria-label={`One more ${item.card.name}`}
          disabled={draftQuantity >= 999}
          onClick={() => setDraftQuantity((current) => Math.min(999, current + 1))}
        >
          <AddIcon fontSize="small" />
        </IconButton>

        <Tooltip
          title={item.forTrade ? 'For trade. Click to keep it.' : 'Kept. Click to offer it.'}
        >
          <IconButton
            size="small"
            aria-label={
              item.forTrade
                ? `Stop offering ${item.card.name}`
                : `Offer ${item.card.name} for trade`
            }
            aria-pressed={item.forTrade}
            onClick={() => onUpdate(item.id, { forTrade: !item.forTrade })}
            disabled={saving}
          >
            {item.forTrade ? (
              <SwapHorizIcon fontSize="small" color="primary" />
            ) : (
              <VisibilityOffOutlinedIcon fontSize="small" color="disabled" />
            )}
          </IconButton>
        </Tooltip>

        <Tooltip title="Edit this card">
          <IconButton
            size="small"
            aria-label={`Edit ${item.card.name}`}
            onClick={() => setDialogOpen(true)}
          >
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <CollectionItemDialog
        item={item}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={(input) => {
          onUpdate(item.id, input);
          setDialogOpen(false);
        }}
        onDelete={() => {
          onRemove(item.id);
          setDialogOpen(false);
        }}
        saving={saving}
        error={error}
      />
    </Stack>
  );
}

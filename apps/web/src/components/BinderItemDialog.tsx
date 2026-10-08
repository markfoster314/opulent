import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
} from '@mui/material';
import type { BinderItem, UpdateBinderItemInput } from '@opulent/shared';
import { useEffect, useState } from 'react';
import type { CardDetails } from './CardDetailsFields';
import { CardDetailsFields, isQuantityInvalid } from './CardDetailsFields';

interface BinderItemDialogProps {
  item: BinderItem;
  open: boolean;
  onClose: () => void;
  onSave: (input: UpdateBinderItemInput) => void;
  onDelete: () => void;
  saving: boolean;
  error?: string | undefined;
}

function detailsFromItem(item: BinderItem): CardDetails {
  return {
    quantity: String(item.quantity),
    finish: item.finish,
    condition: item.condition,
    notes: item.notes ?? '',
    forTrade: item.forTrade,
  };
}

export function BinderItemDialog({
  item,
  open,
  onClose,
  onSave,
  onDelete,
  saving,
  error,
}: BinderItemDialogProps) {
  const [details, setDetails] = useState<CardDetails>(() => detailsFromItem(item));

  // Re-seed on open so a cancelled edit does not linger into the next one.
  useEffect(() => {
    if (open) setDetails(detailsFromItem(item));
  }, [open, item]);

  const quantityError = isQuantityInvalid(details.quantity);

  function handleSave() {
    if (quantityError) return;
    onSave({
      quantity: Number(details.quantity),
      finish: details.finish,
      condition: details.condition,
      notes: details.notes,
      forTrade: details.forTrade,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{item.card?.name ?? 'Edit card'}</DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <CardDetailsFields
            value={details}
            onChange={(patch) => setDetails((current) => ({ ...current, ...patch }))}
            finishOptions={item.availableFinishes ?? []}
            prices={item.card?.prices}
            stackNote="Changing finish or condition moves these copies into their own stack."
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button color="error" onClick={onDelete} disabled={saving}>
          Remove
        </Button>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={quantityError || saving}>
            Save
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

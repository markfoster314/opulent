import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import type { BinderItem, CardCondition, CardFinish, UpdateBinderItemInput } from '@opulent/shared';
import {
  cardConditionLabels,
  cardConditionSchema,
  cardFinishLabels,
  cardFinishSchema,
} from '@opulent/shared';
import { useEffect, useState } from 'react';

interface BinderItemDialogProps {
  item: BinderItem;
  open: boolean;
  onClose: () => void;
  onSave: (input: UpdateBinderItemInput) => void;
  onDelete: () => void;
  saving: boolean;
  error?: string | undefined;
}

const allConditions = cardConditionSchema.options;

export function BinderItemDialog({
  item,
  open,
  onClose,
  onSave,
  onDelete,
  saving,
  error,
}: BinderItemDialogProps) {
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [finish, setFinish] = useState<CardFinish>(item.finish);
  const [condition, setCondition] = useState<CardCondition>(item.condition);
  const [notes, setNotes] = useState(item.notes ?? '');
  const [forTrade, setForTrade] = useState(item.forTrade);

  useEffect(() => {
    if (open) {
      setQuantity(String(item.quantity));
      setFinish(item.finish);
      setCondition(item.condition);
      setNotes(item.notes ?? '');
      setForTrade(item.forTrade);
    }
  }, [open, item]);

  /**
   * Only offer finishes this printing was actually produced in. Falling back to
   * every finish keeps the form usable if the mirrored card data is missing the
   * field for some reason.
   */
  const finishOptions =
    item.availableFinishes && item.availableFinishes.length > 0
      ? item.availableFinishes
      : cardFinishSchema.options;

  const parsedQuantity = Number(quantity);
  const quantityError =
    !Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 999;

  function handleSave() {
    if (quantityError) return;
    onSave({
      quantity: parsedQuantity,
      finish,
      condition,
      notes,
      forTrade,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{item.card?.name ?? 'Edit card'}</DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ pt: 1 }}>
          <TextField
            label="How many"
            type="number"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            error={quantityError}
            helperText={quantityError ? 'Pick a whole number from 1 to 999' : ' '}
            slotProps={{ htmlInput: { min: 1, max: 999 } }}
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel id="finish-label">Finish</InputLabel>
            <Select
              labelId="finish-label"
              label="Finish"
              value={finish}
              onChange={(event) => setFinish(event.target.value as CardFinish)}
            >
              {finishOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {cardFinishLabels[option]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel id="condition-label">Condition</InputLabel>
            <Select
              labelId="condition-label"
              label="Condition"
              value={condition}
              onChange={(event) => setCondition(event.target.value as CardCondition)}
            >
              {allConditions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option} — {cardConditionLabels[option]}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              Changing finish or condition moves these copies into their own stack.
            </FormHelperText>
          </FormControl>

          <TextField
            label="Notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            multiline
            minRows={2}
            fullWidth
            placeholder="Small crease on the back, otherwise clean."
          />

          <FormControlLabel
            control={
              <Switch checked={forTrade} onChange={(event) => setForTrade(event.target.checked)} />
            }
            label="Available for trade"
          />
          <FormHelperText sx={{ mt: -2 }}>
            Turn this off to keep a card in the binder without offering it. It stops showing up in
            other people&apos;s matches.
          </FormHelperText>

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

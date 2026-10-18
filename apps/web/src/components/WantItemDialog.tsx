import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material';
import type {
  CardCondition,
  CardFinish,
  CardLanguage,
  UpdateWantItemInput,
  WantItem,
} from '@opulent/shared';
import { useEffect, useState } from 'react';
import { palette } from '../theme';
import { WantScopeFields, type WantScopeValue } from './WantScopeFields';

interface WantItemDialogProps {
  item: WantItem;
  open: boolean;
  onClose: () => void;
  onSave: (input: UpdateWantItemInput) => void;
  onDelete: () => void;
  saving: boolean;
  error?: string | undefined;
}

function scopeFromItem(item: WantItem): WantScopeValue {
  return {
    languages: [...item.wantedLanguages],
    finishes: [...item.wantedFinishes],
    conditions: [...item.wantedConditions],
    sets: [...item.wantedSets],
  };
}

function quantityIsInvalid(quantity: string): boolean {
  const parsed = Number(quantity);
  return quantity.trim() === '' || !Number.isInteger(parsed) || parsed < 1 || parsed > 999;
}

/** The same boxes used to add a want, opened from a card already on the list. */
export function WantItemDialog({
  item,
  open,
  onClose,
  onSave,
  onDelete,
  saving,
  error,
}: WantItemDialogProps) {
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [scope, setScope] = useState<WantScopeValue>(() => scopeFromItem(item));

  // Re-seed on open so a cancelled edit does not linger into the next one.
  useEffect(() => {
    if (!open) return;
    setQuantity(String(item.quantity));
    setScope(scopeFromItem(item));
  }, [open, item]);

  const quantityError = quantityIsInvalid(quantity);

  function handleSave() {
    if (quantityError) return;
    onSave({
      quantity: Number(quantity),
      wantedLanguages: scope.languages as CardLanguage[],
      wantedFinishes: scope.finishes as CardFinish[],
      wantedConditions: scope.conditions as CardCondition[],
      wantedSets: scope.sets,
    });
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ overflowWrap: 'anywhere' }}>{item.cardName ?? 'Edit want'}</DialogTitle>

      <DialogContent
        sx={{
          colorScheme: 'dark',
          scrollbarColor: `${palette.goldDark} ${palette.surface}`,
          '&::-webkit-scrollbar': { width: 10 },
          '&::-webkit-scrollbar-track': { backgroundColor: palette.surface },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: palette.surfaceRaised,
            border: `2px solid ${palette.surface}`,
            borderRadius: 8,
          },
          '&::-webkit-scrollbar-thumb:hover': { backgroundColor: palette.goldDark },
        }}
      >
        <Stack spacing={2} sx={{ pt: 1 }}>
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

          <WantScopeFields
            oracleId={open ? item.oracleId : undefined}
            idPrefix={`edit-want-${item.id}`}
            value={scope}
            onChange={(patch) => setScope((current) => ({ ...current, ...patch }))}
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{ flexWrap: 'wrap', gap: 1, justifyContent: 'space-between', px: 3, pb: 2 }}
      >
        <Button
          color="error"
          onClick={onDelete}
          disabled={saving}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          Remove
        </Button>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          <Button onClick={onClose} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={quantityError || saving}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Save
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}

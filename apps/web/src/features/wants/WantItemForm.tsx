import {
  Alert,
  Autocomplete,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import type {
  CardCondition,
  CardFinish,
  CardLanguage,
  UpdateWantItemInput,
  WantItem,
  WantList,
} from '@opulent/shared';
import { useEffect, useState } from 'react';
import { WantScopeFields, type WantScopeValue } from './WantScopeFields';

export interface WantItemFormProps {
  item: WantItem;
  lists?: WantList[];
  onClose: () => void;
  onSave: (input: UpdateWantItemInput) => void;
  onDelete: () => void;
  saving: boolean;
  error?: string | undefined;
  removeLabel?: string;
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

export function WantItemForm({
  item,
  lists = [],
  onClose,
  onSave,
  onDelete,
  saving,
  error,
  removeLabel = 'Remove',
}: WantItemFormProps) {
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [priority, setPriority] = useState<'1' | '2' | '3'>(
    String(item.priority) as '1' | '2' | '3',
  );
  const [notes, setNotes] = useState(item.notes ?? '');
  const [listIds, setListIds] = useState<string[]>(item.lists.map((list) => list.id));
  const [scope, setScope] = useState<WantScopeValue>(() => scopeFromItem(item));

  useEffect(() => {
    setQuantity(String(item.quantity));
    setPriority(String(item.priority) as '1' | '2' | '3');
    setNotes(item.notes ?? '');
    setListIds(item.lists.map((list) => list.id));
    setScope(scopeFromItem(item));
    // Reset the form only when the edited want changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const quantityError = quantityIsInvalid(quantity);
  const selectedLists = lists.filter((list) => listIds.includes(list.id));

  function handleSave() {
    if (quantityError) return;
    onSave({
      quantity: Number(quantity),
      priority: Number(priority) as 1 | 2 | 3,
      notes: notes.trim() || null,
      listIds,
      wantedLanguages: scope.languages as CardLanguage[],
      wantedFinishes: scope.finishes as CardFinish[],
      wantedConditions: scope.conditions as CardCondition[],
      wantedSets: scope.sets,
    });
  }

  return (
    <Stack spacing={2} sx={{ pt: 1 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="How many"
          type="number"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          error={quantityError}
          helperText={quantityError ? 'Pick a whole number from 1 to 999' : undefined}
          slotProps={{ htmlInput: { min: 1, max: 999 } }}
          fullWidth
        />
        <FormControl fullWidth>
          <InputLabel id={`edit-want-priority-${item.id}`}>Priority</InputLabel>
          <Select
            labelId={`edit-want-priority-${item.id}`}
            label="Priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value as '1' | '2' | '3')}
          >
            <MenuItem value="1">High</MenuItem>
            <MenuItem value="2">Medium</MenuItem>
            <MenuItem value="3">Low</MenuItem>
          </Select>
        </FormControl>
      </Stack>

      <WantScopeFields
        oracleId={item.oracleId}
        idPrefix={`edit-want-${item.id}`}
        value={scope}
        onChange={(patch) => setScope((current) => ({ ...current, ...patch }))}
      />

      {lists.length > 0 && (
        <Autocomplete
          multiple
          options={lists}
          value={selectedLists}
          getOptionLabel={(list) => list.name}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          onChange={(_event, next) => setListIds(next.map((list) => list.id))}
          renderInput={(params) => <TextField {...params} label="Lists" />}
        />
      )}

      <TextField
        label="Notes"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        multiline
        minRows={2}
        fullWidth
        slotProps={{ htmlInput: { maxLength: 280 } }}
      />

      {error && <Alert severity="error">{error}</Alert>}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{
          justifyContent: 'space-between',
          pt: 1,
        }}
      >
        <Button
          color="error"
          onClick={onDelete}
          disabled={saving}
          sx={{ width: { xs: '100%', sm: 'auto' } }}
        >
          {removeLabel}
        </Button>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button onClick={onClose} disabled={saving} sx={{ width: { xs: '100%', sm: 'auto' } }}>
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
      </Stack>
    </Stack>
  );
}

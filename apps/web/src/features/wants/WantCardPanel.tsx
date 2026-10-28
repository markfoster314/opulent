import CloseIcon from '@mui/icons-material/Close';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type {
  AddWantItemInput,
  Card,
  CardCondition,
  CardFinish,
  CardLanguage,
  WantList,
} from '@opulent/shared';
import { useEffect, useState } from 'react';
import { useOracleChoices } from '@/shared/cards/queries';
import { WantScopeFields, type WantScopeValue } from './WantScopeFields';

interface WantCardPanelProps {
  card: Card;
  lists?: WantList[];
  defaultListId?: string | undefined;
  onAdd: (input: AddWantItemInput) => void;
  onCancel: () => void;
  pending: boolean;
  error?: string | undefined;
}

const emptyScope: WantScopeValue = {
  languages: [],
  finishes: [],
  conditions: [],
  sets: [],
};

function hasScope(scope: WantScopeValue): boolean {
  return (
    scope.languages.length > 0 ||
    scope.finishes.length > 0 ||
    scope.conditions.length > 0 ||
    scope.sets.length > 0
  );
}

export function WantCardPanel({
  card,
  lists = [],
  defaultListId,
  onAdd,
  onCancel,
  pending,
  error,
}: WantCardPanelProps) {
  const [quantity, setQuantity] = useState('1');
  const [priority, setPriority] = useState<'1' | '2' | '3'>('2');
  const [narrow, setNarrow] = useState(false);
  const [scope, setScope] = useState<WantScopeValue>(emptyScope);
  const [listIds, setListIds] = useState<string[]>(defaultListId ? [defaultListId] : []);
  const [notes, setNotes] = useState('');
  const choicesQuery = useOracleChoices(card.oracleId);

  useEffect(() => {
    const choices = choicesQuery.data;
    if (!choices) return;
    const singleLanguage = choices.languages.length === 1;
    const singleFinish = choices.finishes.length === 1;
    const singleSet = choices.sets.length === 1;
    if (!singleLanguage && !singleFinish && !singleSet) return;
    setNarrow(true);
    setScope((current) => ({
      languages: singleLanguage ? [...choices.languages] : current.languages,
      finishes: singleFinish ? [...choices.finishes] : current.finishes,
      conditions: current.conditions,
      sets: singleSet ? [choices.sets[0]!.setCode] : current.sets,
    }));
  }, [choicesQuery.data]);

  const parsedQuantity = Number(quantity);
  const quantityError =
    quantity.trim() === '' ||
    !Number.isInteger(parsedQuantity) ||
    parsedQuantity < 1 ||
    parsedQuantity > 999;
  const emptyNarrow = narrow && !hasScope(scope);
  const selectedLists = lists.filter((list) => listIds.includes(list.id));

  function handleAdd() {
    if (quantityError || emptyNarrow) return;
    onAdd({
      oracleId: card.oracleId,
      quantity: parsedQuantity,
      priority: Number(priority) as 1 | 2 | 3,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      listIds,
      wantedLanguages: narrow ? (scope.languages as CardLanguage[]) : [],
      wantedFinishes: narrow ? (scope.finishes as CardFinish[]) : [],
      wantedConditions: narrow ? (scope.conditions as CardCondition[]) : [],
      wantedSets: narrow ? scope.sets : [],
    });
  }

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
        <Typography variant="h3" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          {card.name}
        </Typography>
        <IconButton onClick={onCancel} aria-label="Cancel adding this want" size="small">
          <CloseIcon />
        </IconButton>
      </Stack>

      <Box
        sx={{
          mt: 2,
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          alignItems: 'start',
        }}
      >
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
          <InputLabel id="want-priority-label">Priority</InputLabel>
          <Select
            labelId="want-priority-label"
            label="Priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value as '1' | '2' | '3')}
          >
            <MenuItem value="1">High</MenuItem>
            <MenuItem value="2">Medium</MenuItem>
            <MenuItem value="3">Low</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ gridColumn: { xs: 'auto', sm: '1 / -1' } }}>
          <ToggleButtonGroup
            exclusive
            fullWidth
            size="small"
            value={narrow ? 'specific' : 'any'}
            onChange={(_event, value: 'any' | 'specific' | null) => {
              if (!value) return;
              setNarrow(value === 'specific');
              if (value === 'any') setScope(emptyScope);
            }}
            aria-label="Want version"
          >
            <ToggleButton value="any">Any version</ToggleButton>
            <ToggleButton value="specific">Specific version</ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {narrow && (
          <Box sx={{ gridColumn: { xs: 'auto', sm: '1 / -1' } }}>
            <WantScopeFields
              oracleId={card.oracleId}
              idPrefix="add-want"
              value={scope}
              onChange={(patch) => setScope((current) => ({ ...current, ...patch }))}
            />
            {emptyNarrow && (
              <FormHelperText error sx={{ mt: 1 }}>
                Pick at least one filter, or choose Any version.
              </FormHelperText>
            )}
          </Box>
        )}

        {lists.length > 0 && (
          <Autocomplete
            multiple
            fullWidth
            options={lists}
            value={selectedLists}
            getOptionLabel={(list) => list.name}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            onChange={(_event, next) => setListIds(next.map((list) => list.id))}
            renderInput={(params) => (
              <TextField {...params} label="Lists" placeholder="Add to lists" />
            )}
            sx={{ gridColumn: { xs: 'auto', sm: '1 / -1' } }}
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
          sx={{ gridColumn: { xs: 'auto', sm: '1 / -1' } }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ mt: 3 }}>
        <Button
          variant="contained"
          onClick={handleAdd}
          disabled={quantityError || emptyNarrow || pending}
          sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: 160 }}
        >
          {pending ? 'Adding…' : 'Add want'}
        </Button>
      </Box>
    </Paper>
  );
}

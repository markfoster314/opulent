import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Collapse,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  cardConditionLabels,
  cardConditionSchema,
  cardFinishLabels,
  cardFinishSchema,
  cardLanguageLabels,
  cardLanguageSchema,
  describeGenericWant,
} from '@opulent/shared';
import type { CardCondition, CardFinish, CardLanguage, CardSet } from '@opulent/shared';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  useCreateGenericWant,
  useDeleteGenericWant,
  useGenericWants,
  useSetSearch,
} from '../api/queries';
import { useDebounced } from '../hooks/useDebounced';
import { PlusMinusButton } from './PlusMinusButton';

const ANY = '__any__';

interface Choice {
  value: string;
  label: string;
}

interface Draft {
  languages: CardLanguage[];
  finishes: CardFinish[];
  conditions: CardCondition[];
  sets: CardSet[];
  signed: boolean;
  altered: boolean;
  misprint: boolean;
  miscut: boolean;
  artistProof: boolean;
}

const emptyDraft = (): Draft => ({
  languages: [],
  finishes: [],
  conditions: [],
  sets: [],
  signed: false,
  altered: false,
  misprint: false,
  miscut: false,
  artistProof: false,
});

const languageChoices: Choice[] = cardLanguageSchema.options.map((code) => ({
  value: code,
  label: cardLanguageLabels[code],
}));

const finishChoices: Choice[] = cardFinishSchema.options.map((code) => ({
  value: code,
  label: cardFinishLabels[code],
}));

const conditionChoices: Choice[] = cardConditionSchema.options.map((code) => ({
  value: code,
  label: `${code} — ${cardConditionLabels[code]}`,
}));

function hasChoice(draft: Draft): boolean {
  return (
    draft.languages.length > 0 ||
    draft.finishes.length > 0 ||
    draft.conditions.length > 0 ||
    draft.sets.length > 0 ||
    draft.signed ||
    draft.altered ||
    draft.misprint ||
    draft.miscut ||
    draft.artistProof
  );
}

function setLabel(set: CardSet): string {
  return set.setName ? `${set.setName} (${set.setCode.toUpperCase()})` : set.setCode.toUpperCase();
}

/** Broad interests that name no single card. */
export function GenericWantsSection() {
  const { data, isLoading, error } = useGenericWants(true);
  const createWant = useCreateGenericWant();
  const deleteWant = useDeleteGenericWant();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [setInput, setSetInput] = useState('');
  const setTerm = useDebounced(setInput.trim());
  const setQuery = useSetSearch(setTerm);

  const matches = setQuery.data?.items ?? [];
  const setOptions = [
    ...draft.sets.filter((set) => !matches.some((row) => row.setCode === set.setCode)),
    ...matches,
  ];

  function patch(next: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function handleAdd() {
    if (!hasChoice(draft)) return;
    createWant.mutate(
      {
        languages: draft.languages,
        finishes: draft.finishes,
        conditions: draft.conditions,
        sets: draft.sets.map((set) => set.setCode),
        signed: draft.signed,
        altered: draft.altered,
        misprint: draft.misprint,
        miscut: draft.miscut,
        artistProof: draft.artistProof,
      },
      {
        onSuccess: () => {
          setDraft(emptyDraft());
          setSetInput('');
        },
      },
    );
  }

  return (
    <Stack spacing={2}>
      <Box>
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
          <Typography variant="h2" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            Generic wants
          </Typography>
          <PlusMinusButton
            open={creating}
            label={creating ? 'Close new generic want' : 'New generic want'}
            onClick={() => setCreating((open) => !open)}
          />
          <Button
            component={RouterLink}
            to="/matches#generic-matches"
            variant="outlined"
            size="small"
          >
            Find matches
          </Button>
        </Stack>

        <Collapse in={creating} unmountOnExit>
          <Stack spacing={2} sx={{ pt: 2 }}>
            <Paper sx={{ p: 3 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                  gap: 2,
                }}
              >
                <ChoiceMenu
                  id="generic-language"
                  label="Language"
                  choices={languageChoices}
                  selected={draft.languages}
                  onChange={(languages) => patch({ languages: languages as CardLanguage[] })}
                />
                <ChoiceMenu
                  id="generic-finish"
                  label="Finish"
                  choices={finishChoices}
                  selected={draft.finishes}
                  onChange={(finishes) => patch({ finishes: finishes as CardFinish[] })}
                />
                <ChoiceMenu
                  id="generic-condition"
                  label="Condition"
                  choices={conditionChoices}
                  selected={draft.conditions}
                  onChange={(conditions) => patch({ conditions: conditions as CardCondition[] })}
                />
                <Autocomplete
                  fullWidth
                  multiple
                  options={setOptions}
                  value={draft.sets}
                  inputValue={setInput}
                  getOptionLabel={setLabel}
                  isOptionEqualToValue={(a, b) => a.setCode === b.setCode}
                  filterOptions={(items) => items}
                  loading={setQuery.isFetching}
                  noOptionsText={setTerm.length < 2 ? 'Type at least two letters' : 'No sets found'}
                  onChange={(_, sets) => {
                    patch({ sets });
                    setSetInput('');
                  }}
                  onInputChange={(_, value, reason) => {
                    if (reason === 'input') {
                      setSetInput(value);
                      return;
                    }
                    if (reason === 'clear' || reason === 'selectOption' || reason === 'reset') {
                      setSetInput('');
                    }
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Set" placeholder="Modern Horizons 2" />
                  )}
                  sx={{ gridColumn: { xs: 'auto', sm: '1 / -1' } }}
                />
              </Box>

              <FormGroup
                sx={{ mt: 2, flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap' }}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={draft.artistProof}
                      onChange={(event) => patch({ artistProof: event.target.checked })}
                    />
                  }
                  label="Artist proof"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={draft.signed}
                      onChange={(event) => patch({ signed: event.target.checked })}
                    />
                  }
                  label="Signed"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={draft.misprint}
                      onChange={(event) => patch({ misprint: event.target.checked })}
                    />
                  }
                  label="Misprint"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={draft.altered}
                      onChange={(event) => patch({ altered: event.target.checked })}
                    />
                  }
                  label="Altered"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={draft.miscut}
                      onChange={(event) => patch({ miscut: event.target.checked })}
                    />
                  }
                  label="Miscut"
                />
              </FormGroup>

              <Button
                variant="contained"
                onClick={handleAdd}
                disabled={!hasChoice(draft) || createWant.isPending}
                sx={{ mt: 2, width: { xs: '100%', sm: 'auto' }, minWidth: 140 }}
              >
                Add interest
              </Button>

              {createWant.error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {createWant.error.message}
                </Alert>
              )}
            </Paper>
          </Stack>
        </Collapse>
      </Box>

      {isLoading && <CircularProgress />}
      {error && <Alert severity="error">{error.message}</Alert>}
      {data && data.items.length === 0 && <Alert severity="info">No generic wants yet.</Alert>}

      <Stack spacing={2}>
        {data?.items.map((item) => (
          <Paper key={item.id} sx={{ p: 2 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.5}
              justifyContent="space-between"
              alignItems={{ xs: 'stretch', sm: 'center' }}
            >
              <Typography sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                {describeGenericWant(item)}
              </Typography>
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => deleteWant.mutate(item.id)}
                disabled={deleteWant.isPending}
                sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, flexShrink: 0 }}
              >
                Remove
              </Button>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}

function nextSelection(current: string[], raw: unknown): string[] {
  const next = (Array.isArray(raw) ? raw : [raw]).filter(
    (value): value is string => typeof value === 'string',
  );
  const choices = next.filter((value) => value !== ANY);
  if (next.includes(ANY) && current.length > 0) return [];
  return choices;
}

function ChoiceMenu({
  id,
  label,
  choices,
  selected,
  onChange,
}: {
  id: string;
  label: string;
  choices: Choice[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const labels = new Map(choices.map((choice) => [choice.value, choice.label]));

  function handleChange(event: SelectChangeEvent<string[]>) {
    onChange(nextSelection(selected, event.target.value));
  }

  return (
    <FormControl fullWidth>
      <InputLabel id={`${id}-label`}>{label}</InputLabel>
      <Select
        labelId={`${id}-label`}
        label={label}
        multiple
        value={selected.length === 0 ? [ANY] : selected}
        onChange={handleChange}
        renderValue={() => {
          if (selected.length === 0) return 'Any';
          return selected.map((item) => labels.get(item) ?? item.toUpperCase()).join(', ');
        }}
        MenuProps={{
          slotProps: { paper: { sx: { maxHeight: 360, maxWidth: '100%' } } },
        }}
        sx={{ '& .MuiSelect-select': { whiteSpace: 'normal', overflowWrap: 'anywhere' } }}
      >
        <MenuItem value={ANY}>
          <Checkbox checked={selected.length === 0} tabIndex={-1} disableRipple />
          <ListItemText primary="Any" />
        </MenuItem>
        {choices.map((choice) => (
          <MenuItem key={choice.value} value={choice.value}>
            <Checkbox checked={selected.includes(choice.value)} tabIndex={-1} disableRipple />
            <ListItemText
              primary={choice.label}
              slotProps={{ primary: { sx: { whiteSpace: 'normal', overflowWrap: 'anywhere' } } }}
            />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

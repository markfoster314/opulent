import {
  Alert,
  Box,
  Checkbox,
  CircularProgress,
  FormControl,
  InputLabel,
  ListItemText,
  ListSubheader,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import {
  cardConditionLabels,
  cardConditionSchema,
  cardFinishLabels,
  cardLanguageLabels,
} from '@opulent/shared';
import { useEffect, useMemo, useState } from 'react';
import { useOracleChoices } from '@/shared/cards/queries';

const ANY = '__any__';

interface Choice {
  value: string;
  label: string;
}

/** The four scope lists; empty means any. */
export interface WantScopeValue {
  languages: string[];
  finishes: string[];
  conditions: string[];
  sets: string[];
}

interface WantScopeFieldsProps {
  oracleId: string | undefined;
  idPrefix: string;
  value: WantScopeValue;
  onChange: (patch: Partial<WantScopeValue>) => void;
}

export function WantScopeFields({ oracleId, idPrefix, value, onChange }: WantScopeFieldsProps) {
  const choicesQuery = useOracleChoices(oracleId);
  const [setQuery, setSetQuery] = useState('');
  const choices = choicesQuery.data;

  const languageChoices = useMemo<Choice[]>(
    () =>
      (choices?.languages ?? []).map((code) => ({
        value: code,
        label: cardLanguageLabels[code],
      })),
    [choices?.languages],
  );
  const finishChoices = useMemo<Choice[]>(
    () =>
      (choices?.finishes ?? []).map((code) => ({
        value: code,
        label: cardFinishLabels[code],
      })),
    [choices?.finishes],
  );
  const conditionChoices = useMemo<Choice[]>(
    () =>
      cardConditionSchema.options.map((code) => ({
        value: code,
        label: `${code} — ${cardConditionLabels[code]}`,
      })),
    [],
  );
  const setChoices = useMemo<Choice[]>(
    () =>
      (choices?.sets ?? []).map((set) => ({
        value: set.setCode,
        label: set.setName
          ? `${set.setName} (${set.setCode.toUpperCase()})`
          : set.setCode.toUpperCase(),
      })),
    [choices?.sets],
  );

  const menusDisabled = choicesQuery.isLoading || !choices;

  // A sole option is forced, so "Any" is not a real choice.
  useEffect(() => {
    if (!choices) return;
    const patch: Partial<WantScopeValue> = {};
    if (value.languages.length === 0 && languageChoices.length === 1) {
      patch.languages = [languageChoices[0]!.value];
    }
    if (value.finishes.length === 0 && finishChoices.length === 1) {
      patch.finishes = [finishChoices[0]!.value];
    }
    if (value.sets.length === 0 && setChoices.length === 1) {
      patch.sets = [setChoices[0]!.value];
    }
    if (Object.keys(patch).length > 0) onChange(patch);
  }, [choices, languageChoices, finishChoices, setChoices, value, onChange]);

  return (
    <>
      {choicesQuery.isLoading && <CircularProgress size={24} />}
      {choicesQuery.error && <Alert severity="error">{choicesQuery.error.message}</Alert>}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2,
        }}
      >
        <CheckMenu
          id={`${idPrefix}-language`}
          label="Language"
          choices={languageChoices}
          selected={value.languages}
          onChange={(languages) => onChange({ languages })}
          disabled={menusDisabled}
        />
        <CheckMenu
          id={`${idPrefix}-printing`}
          label="Printing"
          choices={finishChoices}
          selected={value.finishes}
          onChange={(finishes) => onChange({ finishes })}
          disabled={menusDisabled}
        />
        <CheckMenu
          id={`${idPrefix}-condition`}
          label="Condition"
          choices={conditionChoices}
          selected={value.conditions}
          onChange={(conditions) => onChange({ conditions })}
        />
        <CheckMenu
          id={`${idPrefix}-set`}
          label="Set"
          choices={setChoices}
          selected={value.sets}
          onChange={(sets) => onChange({ sets })}
          disabled={menusDisabled}
          search={setQuery}
          onSearch={setSetQuery}
          searchPlaceholder="Search by set name"
        />
      </Box>
    </>
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

function CheckMenu({
  id,
  label,
  choices,
  selected,
  onChange,
  disabled,
  search,
  onSearch,
  searchPlaceholder,
}: {
  id: string;
  label: string;
  choices: Choice[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  search?: string;
  onSearch?: (value: string) => void;
  searchPlaceholder?: string;
}) {
  const labels = new Map(choices.map((choice) => [choice.value, choice.label]));
  const term = (search ?? '').trim().toLowerCase();
  const visible = choices.filter((choice) => {
    if (!term) return true;
    return choice.label.toLowerCase().includes(term);
  });
  const hiddenSelected = choices.filter(
    (choice) =>
      selected.includes(choice.value) && !visible.some((row) => row.value === choice.value),
  );
  const pendingSelected = selected.filter(
    (value) => !choices.some((choice) => choice.value === value),
  );

  function handleChange(event: SelectChangeEvent<string[]>) {
    onChange(nextSelection(selected, event.target.value));
  }

  return (
    <FormControl fullWidth disabled={disabled}>
      <InputLabel id={`${id}-label`}>{label}</InputLabel>
      <Select
        labelId={`${id}-label`}
        label={label}
        multiple
        value={selected.length === 0 ? [ANY] : selected}
        onChange={handleChange}
        onClose={() => onSearch?.('')}
        renderValue={() => {
          if (selected.length === 0) return 'Any';
          return selected.map((item) => labels.get(item) ?? item.toUpperCase()).join(', ');
        }}
        MenuProps={{
          autoFocus: false,
          slotProps: {
            paper: { sx: { maxHeight: 360, maxWidth: '100%' } },
          },
        }}
        sx={{
          '& .MuiSelect-select': {
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
          },
        }}
      >
        {onSearch && (
          <ListSubheader
            sx={{ bgcolor: 'background.paper', lineHeight: 'normal', py: 1 }}
            onMouseDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <TextField
              size="small"
              placeholder={searchPlaceholder ?? 'Search'}
              value={search ?? ''}
              onChange={(event) => onSearch(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              fullWidth
            />
          </ListSubheader>
        )}
        <MenuItem value={ANY}>
          <Checkbox checked={selected.length === 0} tabIndex={-1} disableRipple />
          <ListItemText primary="Any" />
        </MenuItem>
        {visible.map((choice) => (
          <MenuItem key={choice.value} value={choice.value}>
            <Checkbox checked={selected.includes(choice.value)} tabIndex={-1} disableRipple />
            <ListItemText
              primary={choice.label}
              slotProps={{
                primary: { sx: { whiteSpace: 'normal', overflowWrap: 'anywhere' } },
              }}
            />
          </MenuItem>
        ))}
        {hiddenSelected.map((choice) => (
          <MenuItem key={choice.value} value={choice.value} sx={{ display: 'none' }}>
            {choice.label}
          </MenuItem>
        ))}
        {pendingSelected.map((value) => (
          <MenuItem key={value} value={value} sx={{ display: 'none' }}>
            {labels.get(value) ?? value.toUpperCase()}
          </MenuItem>
        ))}
        {term && visible.length === 0 && <MenuItem disabled>No matches</MenuItem>}
      </Select>
    </FormControl>
  );
}

import SearchIcon from '@mui/icons-material/Search';
import TuneIcon from '@mui/icons-material/Tune';
import {
  Box,
  Button,
  Checkbox,
  Collapse,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { CardCondition, CardFinish, CardLanguage, CardRarity } from '@opulent/shared';
import {
  cardConditionLabels,
  cardConditionSchema,
  cardFinishLabels,
  cardFinishSchema,
  cardLanguageLabels,
  cardLanguageSchema,
  cardRarityLabels,
  cardRaritySchema,
} from '@opulent/shared';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { binderSearchIsActive, clearBinderFilters, type BinderSearch } from '../binderSearch';
import { palette } from '../theme';
import { ChangeControls } from './ChangeControls';

interface BinderSearchFieldsProps {
  value: BinderSearch;
  onChange: (value: BinderSearch) => void;
  /** Signed-out visitors see this filter but cannot enable it. */
  canUseWantList: boolean;
  showChangeWindow?: boolean;
  groups?: { id: string; name: string }[];
  /** Sits beside the change-window control on desktop. */
  trailing?: ReactNode;
}

/** Count only folded-away filters; the name, ordering, and range are not filters. */
function countFilters(search: BinderSearch): number {
  let count = 0;
  if (search.set.trim()) count += 1;
  if (search.type.trim()) count += 1;
  if (search.artist.trim()) count += 1;
  if (search.groupId) count += 1;
  if (search.finish) count += 1;
  if (search.condition) count += 1;
  if (search.language) count += 1;
  if (search.rarity) count += 1;
  if (search.forTrade) count += 1;
  if (search.signed) count += 1;
  if (search.altered) count += 1;
  if (search.misprint) count += 1;
  if (search.miscut) count += 1;
  if (search.artistProof) count += 1;
  if (search.onWantList) count += 1;
  if (search.onGenericWant) count += 1;
  return count;
}

/** Name stays visible; other filters fold away so the common case stays one line. */
export function BinderSearchFields({
  value,
  onChange,
  canUseWantList,
  showChangeWindow = false,
  groups,
  trailing,
}: BinderSearchFieldsProps) {
  const [open, setOpen] = useState(false);
  const activeCount = countFilters(value);

  function patch(next: Partial<BinderSearch>) {
    onChange({ ...value, ...next });
  }

  return (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
        <TextField
          value={value.q}
          onChange={(event) => patch({ q: event.target.value })}
          placeholder="Search card name"
          aria-label="Search card name"
          size="small"
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <SearchIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
              ),
            },
          }}
        />
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          <Button
            variant={activeCount > 0 ? 'contained' : 'outlined'}
            color={activeCount > 0 ? 'primary' : 'secondary'}
            onClick={() => setOpen((current) => !current)}
            startIcon={<TuneIcon />}
            aria-expanded={open}
            sx={{ width: { xs: '100%', sm: 'auto' } }}
          >
            Filters{activeCount > 0 ? ` (${activeCount})` : ''}
          </Button>
          {activeCount > 0 && (
            <Button
              onClick={() => onChange(clearBinderFilters(value))}
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Clear
            </Button>
          )}
        </Stack>
      </Stack>

      {showChangeWindow ? (
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={1.5}
          alignItems={{ md: 'center' }}
          justifyContent={{ md: 'space-between' }}
          useFlexGap
          flexWrap="wrap"
        >
          <ChangeControls
            range={value.range}
            changeMode={value.changeMode}
            onRange={(range) => patch({ range })}
            onMode={(changeMode) => patch({ changeMode })}
          />
          {trailing}
        </Stack>
      ) : (
        trailing
      )}

      {/* Inline margin stops Stack spacing reappearing at unmount. */}
      <Collapse in={open} unmountOnExit style={{ marginTop: 0 }}>
        <Box sx={{ pt: 1.5 }}>
          <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
            <Stack spacing={2.5}>
              <FieldGroup label="Card">
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1.5,
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, 1fr)',
                      md: 'repeat(4, 1fr)',
                    },
                  }}
                >
                  <TextField
                    label="Set"
                    size="small"
                    value={value.set}
                    onChange={(event) => patch({ set: event.target.value })}
                    placeholder="Modern Horizons 2"
                  />
                  <Choice
                    id="filter-rarity"
                    label="Rarity"
                    value={value.rarity}
                    options={cardRaritySchema.options.map((option) => ({
                      value: option,
                      label: cardRarityLabels[option],
                    }))}
                    onChange={(rarity) => patch({ rarity: rarity as CardRarity | '' })}
                  />
                  <TextField
                    label="Type"
                    size="small"
                    value={value.type}
                    onChange={(event) => patch({ type: event.target.value })}
                    placeholder="Creature"
                  />
                  <TextField
                    label="Artist"
                    size="small"
                    value={value.artist}
                    onChange={(event) => patch({ artist: event.target.value })}
                    placeholder="Rebecca Guay"
                  />
                </Box>
              </FieldGroup>

              <FieldGroup label="Your copy">
                <Box
                  sx={{
                    display: 'grid',
                    gap: 1.5,
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, 1fr)',
                      md: 'repeat(4, 1fr)',
                    },
                  }}
                >
                  <Choice
                    id="filter-finish"
                    label="Finish"
                    value={value.finish}
                    options={cardFinishSchema.options.map((option) => ({
                      value: option,
                      label: cardFinishLabels[option],
                    }))}
                    onChange={(finish) => patch({ finish: finish as CardFinish | '' })}
                  />
                  <Choice
                    id="filter-condition"
                    label="Condition"
                    value={value.condition}
                    options={cardConditionSchema.options.map((option) => ({
                      value: option,
                      label: cardConditionLabels[option],
                    }))}
                    onChange={(condition) => patch({ condition: condition as CardCondition | '' })}
                  />
                  <Choice
                    id="filter-language"
                    label="Language"
                    value={value.language}
                    options={cardLanguageSchema.options.map((option) => ({
                      value: option,
                      label: cardLanguageLabels[option],
                    }))}
                    onChange={(language) => patch({ language: language as CardLanguage | '' })}
                  />
                  {groups && groups.length > 0 && (
                    <Choice
                      id="filter-group"
                      label="Group"
                      value={value.groupId}
                      options={groups.map((group) => ({ value: group.id, label: group.name }))}
                      onChange={(groupId) => patch({ groupId })}
                    />
                  )}
                </Box>
              </FieldGroup>

              <FormGroup sx={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 2 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={value.forTrade}
                      onChange={(event) => patch({ forTrade: event.target.checked })}
                    />
                  }
                  label="For trade"
                />
                <CheckBox
                  label="Signed"
                  checked={value.signed}
                  onChange={(signed) => patch({ signed })}
                />
                <CheckBox
                  label="Altered"
                  checked={value.altered}
                  onChange={(altered) => patch({ altered })}
                />
                <CheckBox
                  label="Misprint"
                  checked={value.misprint}
                  onChange={(misprint) => patch({ misprint })}
                />
                <CheckBox
                  label="Miscut"
                  checked={value.miscut}
                  onChange={(miscut) => patch({ miscut })}
                />
                <CheckBox
                  label="Artist proof"
                  checked={value.artistProof}
                  onChange={(artistProof) => patch({ artistProof })}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={canUseWantList && value.onWantList}
                      disabled={!canUseWantList}
                      onChange={(event) =>
                        patch({
                          onWantList: event.target.checked,
                          onGenericWant: false,
                        })
                      }
                    />
                  }
                  label="On my want list"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={canUseWantList && value.onGenericWant}
                      disabled={!canUseWantList}
                      onChange={(event) =>
                        patch({
                          onGenericWant: event.target.checked,
                          onWantList: false,
                        })
                      }
                    />
                  }
                  label="From generic wants"
                />
              </FormGroup>
            </Stack>
          </Paper>
        </Box>
      </Collapse>
    </Stack>
  );
}

function FieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack spacing={1}>
      <Typography
        variant="overline"
        sx={{ color: palette.goldLight, letterSpacing: '0.14em', lineHeight: 1.4 }}
      >
        {label}
      </Typography>
      {children}
    </Stack>
  );
}

function CheckBox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <FormControlLabel
      control={<Checkbox checked={checked} onChange={(event) => onChange(event.target.checked)} />}
      label={label}
    />
  );
}

function Choice({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <FormControl size="small" sx={{ minWidth: 0 }}>
      <InputLabel id={`${id}-label`}>{label}</InputLabel>
      <Select
        labelId={`${id}-label`}
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <MenuItem value="">Any</MenuItem>
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

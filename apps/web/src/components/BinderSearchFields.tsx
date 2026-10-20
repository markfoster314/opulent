import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { BinderRarity, CardCondition, CardFinish, CardLanguage } from '@opulent/shared';
import {
  binderRarityLabels,
  binderRaritySchema,
  cardConditionLabels,
  cardConditionSchema,
  cardFinishLabels,
  cardFinishSchema,
  cardLanguageLabels,
  cardLanguageSchema,
} from '@opulent/shared';
import { binderSearchIsActive, emptyBinderSearch, type BinderSearch } from '../binderSearch';

interface BinderSearchFieldsProps {
  value: BinderSearch;
  onChange: (value: BinderSearch) => void;
  /** Signed-out visitors can see the want-list box, but it stays off until they sign in. */
  canUseWantList: boolean;
}

export function BinderSearchFields({ value, onChange, canUseWantList }: BinderSearchFieldsProps) {
  function patch(next: Partial<BinderSearch>) {
    onChange({ ...value, ...next });
  }

  return (
    <Stack spacing={2}>
      <TextField
        label="Card name"
        value={value.q}
        onChange={(event) => patch({ q: event.target.value })}
        placeholder="Lightning Bolt"
        fullWidth
      />
      <TextField
        label="Set"
        value={value.set}
        onChange={(event) => patch({ set: event.target.value })}
        placeholder="Modern Horizons 2"
        fullWidth
      />
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Choice
          id="binder-search-finish"
          label="Finish"
          value={value.finish}
          options={cardFinishSchema.options.map((option) => ({
            value: option,
            label: cardFinishLabels[option],
          }))}
          onChange={(finish) => patch({ finish: finish as CardFinish | '' })}
        />
        <Choice
          id="binder-search-condition"
          label="Condition"
          value={value.condition}
          options={cardConditionSchema.options.map((option) => ({
            value: option,
            label: cardConditionLabels[option],
          }))}
          onChange={(condition) => patch({ condition: condition as CardCondition | '' })}
        />
        <Choice
          id="binder-search-language"
          label="Language"
          value={value.language}
          options={cardLanguageSchema.options.map((option) => ({
            value: option,
            label: cardLanguageLabels[option],
          }))}
          onChange={(language) => patch({ language: language as CardLanguage | '' })}
        />
        <Choice
          id="binder-search-rarity"
          label="Rarity"
          value={value.rarity}
          options={binderRaritySchema.options.map((option) => ({
            value: option,
            label: binderRarityLabels[option],
          }))}
          onChange={(rarity) => patch({ rarity: rarity as BinderRarity | '' })}
        />
      </Box>
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
        <MarkBox label="Signed" checked={value.signed} onChange={(signed) => patch({ signed })} />
        <MarkBox
          label="Altered"
          checked={value.altered}
          onChange={(altered) => patch({ altered })}
        />
        <MarkBox
          label="Misprint"
          checked={value.misprint}
          onChange={(misprint) => patch({ misprint })}
        />
        <MarkBox label="Miscut" checked={value.miscut} onChange={(miscut) => patch({ miscut })} />
        <MarkBox
          label="Artist proof"
          checked={value.artistProof}
          onChange={(artistProof) => patch({ artistProof })}
        />
      </FormGroup>
      <Typography variant="body2" color="text.secondary">
        A checked mark keeps only copies that have it.
      </Typography>
      <FormControlLabel
        control={
          <Checkbox
            checked={canUseWantList && value.onWantList}
            disabled={!canUseWantList}
            onChange={(event) => patch({ onWantList: event.target.checked })}
          />
        }
        label="On my want lists"
        sx={{ alignItems: 'flex-start', mr: 0 }}
      />
      <Typography variant="body2" color="text.secondary">
        {canUseWantList
          ? 'Show only cards that are on one of your want lists.'
          : 'Sign in to show only cards that are on your want lists.'}
      </Typography>
      {binderSearchIsActive(value) && (
        <Button
          variant="outlined"
          onClick={() => onChange(emptyBinderSearch)}
          sx={{ width: { xs: '100%', sm: 'auto' }, alignSelf: { sm: 'flex-start' } }}
        >
          Clear search
        </Button>
      )}
    </Stack>
  );
}

function MarkBox({
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
    <FormControl sx={{ flex: '1 1 10rem', minWidth: 0 }}>
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

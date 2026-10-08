import {
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
import type { CardCondition, CardFinish, CardPrices } from '@opulent/shared';
import {
  cardConditionLabels,
  cardConditionSchema,
  cardFinishLabels,
  cardFinishSchema,
  formatUsd,
  priceForFinish,
} from '@opulent/shared';

/**
 * Everything the owner can decide about a stack of cards.
 *
 * Quantity is a string rather than a number so the text field can hold a
 * half-typed or empty value without snapping back to 1 as the user types.
 */
export interface CardDetails {
  quantity: string;
  finish: CardFinish;
  condition: CardCondition;
  notes: string;
  forTrade: boolean;
}

interface CardDetailsFieldsProps {
  value: CardDetails;
  onChange: (patch: Partial<CardDetails>) => void;
  /**
   * Finishes this printing was actually produced in. Passing an empty list falls
   * back to every finish, which keeps the form usable if the mirrored card data
   * is missing the field.
   */
  finishOptions: CardFinish[];
  /** Used to price each finish in its dropdown entry. */
  prices?: CardPrices | null;
  /** Shown under the condition field. Editing and adding need different warnings. */
  stackNote?: string;
}

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 999;

/** True when the typed quantity is not a whole number in range. */
export function isQuantityInvalid(quantity: string): boolean {
  const parsed = Number(quantity);
  return (
    quantity.trim() === '' ||
    !Number.isInteger(parsed) ||
    parsed < MIN_QUANTITY ||
    parsed > MAX_QUANTITY
  );
}

/** The finish to start on: plain if the printing has one, otherwise whatever it does have. */
export function defaultFinish(finishes: CardFinish[]): CardFinish {
  if (finishes.includes('nonfoil')) return 'nonfoil';
  return finishes[0] ?? 'nonfoil';
}

export function CardDetailsFields({
  value,
  onChange,
  finishOptions,
  prices,
  stackNote,
}: CardDetailsFieldsProps) {
  const finishes = finishOptions.length > 0 ? finishOptions : cardFinishSchema.options;
  const quantityError = isQuantityInvalid(value.quantity);

  return (
    <Stack spacing={3}>
      <TextField
        label="How many"
        type="number"
        value={value.quantity}
        onChange={(event) => onChange({ quantity: event.target.value })}
        error={quantityError}
        helperText={quantityError ? `Pick a whole number from 1 to ${MAX_QUANTITY}` : ' '}
        slotProps={{ htmlInput: { min: MIN_QUANTITY, max: MAX_QUANTITY } }}
        fullWidth
      />

      <FormControl fullWidth>
        <InputLabel id="finish-label">Finish</InputLabel>
        <Select
          labelId="finish-label"
          label="Finish"
          value={value.finish}
          onChange={(event) => onChange({ finish: event.target.value as CardFinish })}
        >
          {finishes.map((option) => {
            const price = formatUsd(priceForFinish(prices, option));
            return (
              <MenuItem key={option} value={option}>
                {cardFinishLabels[option]}
                {price ? ` — ${price}` : ''}
              </MenuItem>
            );
          })}
        </Select>
        {finishOptions.length === 1 && (
          <FormHelperText>This printing only came in one finish.</FormHelperText>
        )}
      </FormControl>

      <FormControl fullWidth>
        <InputLabel id="condition-label">Condition</InputLabel>
        <Select
          labelId="condition-label"
          label="Condition"
          value={value.condition}
          onChange={(event) => onChange({ condition: event.target.value as CardCondition })}
        >
          {cardConditionSchema.options.map((option) => (
            <MenuItem key={option} value={option}>
              {option} — {cardConditionLabels[option]}
            </MenuItem>
          ))}
        </Select>
        {stackNote && <FormHelperText>{stackNote}</FormHelperText>}
      </FormControl>

      <TextField
        label="Notes"
        value={value.notes}
        onChange={(event) => onChange({ notes: event.target.value })}
        multiline
        minRows={2}
        fullWidth
        placeholder="Small crease on the back, otherwise clean."
      />

      <Stack>
        <FormControlLabel
          control={
            <Switch
              checked={value.forTrade}
              onChange={(event) => onChange({ forTrade: event.target.checked })}
            />
          }
          label="Available for trade"
        />
        <FormHelperText>
          Turn this off to keep a card in the binder without offering it. It stops showing up in
          other people&apos;s matches.
        </FormHelperText>
      </Stack>
    </Stack>
  );
}

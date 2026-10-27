import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
} from '@mui/material';
import type {
  CardCondition,
  CardFinish,
  CardLanguage,
  CardPrices,
  ItemPrice,
} from '@opulent/shared';
import {
  cardConditionLabels,
  cardConditionSchema,
  cardFinishLabels,
  cardFinishSchema,
  cardLanguageLabels,
  conditionMarketPercent,
  formatUsd,
  parseCustomAmount,
  parsePhotoLink,
  priceForFinish,
} from '@opulent/shared';
import { useState } from 'react';

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
  language: CardLanguage;
  signed: boolean;
  altered: boolean;
  misprint: boolean;
  miscut: boolean;
  artistProof: boolean;
  notes: string;
  photoUrl: string;
  forTrade: boolean;
  priceKind: ItemPrice['kind'];
  pricePercent: string;
  priceAmount: string;
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
  /**
   * Languages this printing was produced in. While that list is still loading,
   * pass the language already chosen so the field stays valid.
   */
  languageOptions: CardLanguage[];
  /** False until the printed-language list has arrived, so a one-item placeholder is not locked. */
  languagesReady: boolean;
  /** Used to price each finish in its dropdown entry. */
  prices?: CardPrices | null;
  /** Shown under the condition field. Editing and adding need different warnings. */
  stackNote?: string;
  /**
   * Price, photo link, and notes fold behind one quiet button. Used on the
   * landing page, where the form stands between a card and a sign-up.
   */
  foldAdvanced?: boolean;
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

/** A whole number from 0 to 100, or null when the field is not one. */
export function parsePercentField(value: string): number | null {
  if (!/^(?:0|[1-9]\d?|100)$/.test(value.trim())) return null;
  return Number(value.trim());
}

/** The price object to save, or null while the percent or dollar field is unfinished. */
export function priceFromDetails(details: CardDetails): ItemPrice | null {
  if (details.priceKind === 'market') return { kind: 'market' };
  if (details.priceKind === 'percent') {
    const percent = parsePercentField(details.pricePercent);
    return percent === null ? null : { kind: 'percent', percent };
  }
  const amount = parseCustomAmount(details.priceAmount);
  return amount === null ? null : { kind: 'custom', amount };
}

export function isPriceInvalid(details: CardDetails): boolean {
  return priceFromDetails(details) === null;
}

/** True when the photo field has text that is not an http or https link. */
export function isPhotoLinkInvalid(photoUrl: string): boolean {
  return photoUrl.trim() !== '' && parsePhotoLink(photoUrl) === null;
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
  languageOptions,
  languagesReady,
  prices,
  stackNote,
  foldAdvanced = false,
}: CardDetailsFieldsProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const finishes = finishOptions.length > 0 ? finishOptions : cardFinishSchema.options;
  const onlyFinish = finishOptions.length === 1;
  const languages = languageOptions.length > 0 ? languageOptions : [value.language];
  const onlyLanguage = languagesReady && languages.length === 1;
  const quantityError = isQuantityInvalid(value.quantity);
  const marketLabel = formatUsd(priceForFinish(prices, value.finish));

  /**
   * Closing the fold with an unfinished price or photo link would disable Add
   * for a reason nobody can see, so those fall back before they are hidden.
   */
  function toggleAdvanced() {
    if (!advancedOpen) {
      setAdvancedOpen(true);
      return;
    }
    const patch: Partial<CardDetails> = {};
    if (isPriceInvalid(value)) patch.priceKind = 'market';
    if (isPhotoLinkInvalid(value.photoUrl)) patch.photoUrl = '';
    if (Object.keys(patch).length > 0) onChange(patch);
    setAdvancedOpen(false);
  }

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
          disabled={onlyFinish}
          onChange={(event) => onChange({ finish: event.target.value as CardFinish })}
        >
          {finishes.map((option) => (
            <MenuItem key={option} value={option}>
              {cardFinishLabels[option]}
            </MenuItem>
          ))}
        </Select>
        {onlyFinish && <FormHelperText>This printing only came in one finish.</FormHelperText>}
      </FormControl>

      <FormControl fullWidth>
        <InputLabel id="condition-label">Condition</InputLabel>
        <Select
          labelId="condition-label"
          label="Condition"
          value={value.condition}
          onChange={(event) => {
            const condition = event.target.value as CardCondition;
            const patch: Partial<CardDetails> = { condition };
            if (value.priceKind === 'percent') {
              const previous = conditionMarketPercent[value.condition];
              const next = conditionMarketPercent[condition];
              const current = value.pricePercent.trim();
              if (current === '') {
                patch.pricePercent = '100';
              } else if (next && previous !== undefined && current === String(previous)) {
                patch.pricePercent = String(next);
              }
            }
            onChange(patch);
          }}
        >
          {cardConditionSchema.options.map((option) => (
            <MenuItem key={option} value={option}>
              {option} — {cardConditionLabels[option]}
            </MenuItem>
          ))}
        </Select>
        {stackNote && <FormHelperText>{stackNote}</FormHelperText>}
      </FormControl>

      <FormControl fullWidth>
        <InputLabel id="language-label">Language</InputLabel>
        <Select
          labelId="language-label"
          label="Language"
          value={languages.includes(value.language) ? value.language : languages[0]}
          disabled={onlyLanguage}
          onChange={(event) => onChange({ language: event.target.value as CardLanguage })}
        >
          {languages.map((option) => (
            <MenuItem key={option} value={option}>
              {cardLanguageLabels[option]}
            </MenuItem>
          ))}
        </Select>
        {onlyLanguage && <FormHelperText>This printing only came in one language.</FormHelperText>}
      </FormControl>

      <FormGroup sx={{ flexDirection: { sm: 'row' }, columnGap: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={value.signed}
              onChange={(event) => onChange({ signed: event.target.checked })}
            />
          }
          label="Signed"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.altered}
              onChange={(event) => onChange({ altered: event.target.checked })}
            />
          }
          label="Altered"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.misprint}
              onChange={(event) => onChange({ misprint: event.target.checked })}
            />
          }
          label="Misprint"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.miscut}
              onChange={(event) => onChange({ miscut: event.target.checked })}
            />
          }
          label="Miscut"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.artistProof}
              onChange={(event) => {
                const artistProof = event.target.checked;
                const patch: Partial<CardDetails> = { artistProof };
                if (artistProof && value.priceKind === 'market') {
                  patch.priceKind = 'custom';
                  if (value.priceAmount.trim() === '') {
                    const market = priceForFinish(prices, value.finish);
                    const amount = market ? parseCustomAmount(market) : null;
                    if (amount) patch.priceAmount = amount;
                  }
                }
                onChange(patch);
              }}
            />
          }
          label="Artist proof"
        />
      </FormGroup>

      {foldAdvanced && (
        <Button
          variant="text"
          color="secondary"
          size="small"
          onClick={toggleAdvanced}
          startIcon={advancedOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          aria-expanded={advancedOpen}
          aria-controls="card-advanced-fields"
          sx={{
            alignSelf: 'flex-start',
            width: { xs: '100%', sm: 'auto' },
            justifyContent: 'flex-start',
          }}
        >
          {advancedOpen ? 'Fewer options' : 'More options'}
        </Button>
      )}

      {(!foldAdvanced || advancedOpen) && (
        <Stack spacing={3} id="card-advanced-fields">
          <FormControl fullWidth>
            <InputLabel id="price-kind-label">Price</InputLabel>
            <Select
              labelId="price-kind-label"
              label="Price"
              value={value.priceKind}
              onChange={(event) => {
                const priceKind = event.target.value as ItemPrice['kind'];
                const patch: Partial<CardDetails> = { priceKind };
                if (priceKind === 'percent' && value.pricePercent.trim() === '') {
                  patch.pricePercent = '100';
                }
                onChange(patch);
              }}
            >
              <MenuItem value="market">
                {marketLabel ? `Market price - (${marketLabel})` : 'Market price'}
              </MenuItem>
              <MenuItem value="percent">Percent of market</MenuItem>
              <MenuItem value="custom">Custom amount</MenuItem>
            </Select>
            {value.artistProof && value.priceKind === 'custom' && (
              <FormHelperText>Set your own amount for this artist proof.</FormHelperText>
            )}
            {value.priceKind === 'market' && (
              <FormHelperText>
                {marketLabel
                  ? 'Uses the market price stored for this finish.'
                  : 'No market price is stored for this finish.'}
              </FormHelperText>
            )}
          </FormControl>

          {value.priceKind === 'percent' && (
            <TextField
              label="Percent of market"
              type="number"
              value={value.pricePercent}
              onChange={(event) => onChange({ pricePercent: event.target.value })}
              error={
                value.pricePercent.trim() !== '' && parsePercentField(value.pricePercent) === null
              }
              helperText="A whole number from 0 to 100. Light play is often 90 (10% off), moderate play 80 (20% off), heavy play 70 (30% off), and damaged 50 (50% off)."
              slotProps={{ htmlInput: { min: 0, max: 100, step: 1 } }}
              fullWidth
            />
          )}

          {value.priceKind === 'custom' && (
            <TextField
              label="Your price"
              value={value.priceAmount}
              onChange={(event) => onChange({ priceAmount: event.target.value })}
              error={
                value.priceAmount.trim() !== '' && parseCustomAmount(value.priceAmount) === null
              }
              placeholder="4.50"
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
              fullWidth
            />
          )}

          <TextField
            label="Photo link"
            value={value.photoUrl}
            onChange={(event) => onChange({ photoUrl: event.target.value })}
            error={isPhotoLinkInvalid(value.photoUrl)}
            helperText={
              isPhotoLinkInvalid(value.photoUrl)
                ? 'Paste a link that starts with http:// or https://.'
                : 'A link to photos of this card on an image hosting site like imgur.'
            }
            placeholder="https://"
            fullWidth
          />

          <TextField
            label="Notes"
            value={value.notes}
            onChange={(event) => onChange({ notes: event.target.value })}
            multiline
            minRows={2}
            fullWidth
            placeholder="Small crease on the back, otherwise clean."
          />
        </Stack>
      )}

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

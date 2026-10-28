import { Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import type { PriceRange } from '@opulent/shared';

const RANGES: { value: PriceRange; label: string }[] = [
  { value: '1w', label: '1W' },
  { value: '1m', label: '1M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
];

/** The window and dollar/percent choice, shared by the card list and movers. */
export function ChangeControls({
  range,
  changeMode,
  onRange,
  onMode,
  showMode = true,
  rangeLabel = 'Change over',
}: {
  range: PriceRange;
  changeMode: 'amount' | 'percent';
  onRange: (range: PriceRange) => void;
  onMode: (mode: 'amount' | 'percent') => void;
  /** Hidden on the value chart, where only the window matters. */
  showMode?: boolean;
  rangeLabel?: string;
}) {
  return (
    <Stack
      direction={{ xs: 'column', md: 'row' }}
      spacing={1.5}
      alignItems={{ md: 'center' }}
      useFlexGap
      flexWrap="wrap"
    >
      <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
        <Typography variant="caption" color="text.secondary">
          {rangeLabel}
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={range}
          onChange={(_event, next: PriceRange | null) => next && onRange(next)}
          aria-label="Price change window"
        >
          {RANGES.map((option) => (
            <ToggleButton key={option.value} value={option.value} sx={{ minWidth: 44 }}>
              {option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {showMode && (
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
          <Typography variant="caption" color="text.secondary">
            Show as
          </Typography>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={changeMode}
            onChange={(_event, next: 'amount' | 'percent' | null) => next && onMode(next)}
            aria-label="Change format"
          >
            <ToggleButton value="amount" aria-label="Dollar change" sx={{ minWidth: 44 }}>
              $
            </ToggleButton>
            <ToggleButton value="percent" aria-label="Percent change" sx={{ minWidth: 44 }}>
              %
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      )}
    </Stack>
  );
}

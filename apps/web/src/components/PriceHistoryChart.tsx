import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material';
import type { CardFinish, PriceRange } from '@opulent/shared';
import { priceForFinish } from '@opulent/shared';
import { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useCardPriceSeries } from '../api/queries';
import { palette } from '../theme';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const RANGES: { value: PriceRange; label: string }[] = [
  { value: '1w', label: '1W' },
  { value: '1m', label: '1M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
];

const dayFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

interface ChartPoint {
  date: string;
  value: number;
}

/** Charts the finish the owner holds; the server carries the last price forward, so every day has a value. */
export function PriceHistoryChart({
  scryfallId,
  finish,
  defaultRange = '1w',
}: {
  scryfallId: string;
  finish: CardFinish;
  /** The window chosen for the collection; the chart opens on it and follows changes. */
  defaultRange?: PriceRange;
}) {
  const [range, setRange] = useState<PriceRange>(defaultRange);
  const { data, isLoading, error } = useCardPriceSeries(scryfallId, range);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  useEffect(() => {
    setRange(defaultRange);
  }, [defaultRange, scryfallId]);

  const points: ChartPoint[] = (data?.points ?? [])
    .map((point) => ({
      date: point.recordedOn,
      value: Number(priceForFinish(point.prices, finish) ?? ''),
    }))
    .filter((point) => Number.isFinite(point.value));

  const first = points[0];
  const last = points[points.length - 1];
  const change = first && last ? last.value - first.value : null;
  const percent = change !== null && first && first.value > 0 ? (change / first.value) * 100 : null;
  const rangeLabel = RANGES.find((option) => option.value === range)?.label ?? '';

  return (
    <Stack spacing={1.5} sx={{ minWidth: 0 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
        useFlexGap
        flexWrap="wrap"
      >
        <Typography variant="h4">Price history</Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={range}
          onChange={(_event, next: PriceRange | null) => next && setRange(next)}
          aria-label="Price history range"
        >
          {RANGES.map((option) => (
            <ToggleButton key={option.value} value={option.value} sx={{ minWidth: 48 }}>
              {option.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      {isLoading && <CircularProgress size={24} />}
      {error && <Alert severity="error">{error.message}</Alert>}
      {!isLoading && !error && points.length < 2 && (
        <Typography variant="body2" color="text.secondary">
          Not enough price history for this card yet.
        </Typography>
      )}

      {points.length >= 2 && first && last && change !== null && (
        <>
          <Reading point={last} change={change} percent={percent} windowLabel={rangeLabel} />

          <Box sx={{ height: 200, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke={palette.divider} vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDay}
                  minTickGap={28}
                  tick={{ fontSize: 11, fill: palette.textSecondary }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  width={62}
                  domain={['auto', 'auto']}
                  tickFormatter={axisMoney}
                  tick={{ fontSize: 11, fill: palette.textSecondary }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: palette.surfaceRaised,
                    border: `1px solid ${palette.divider}`,
                    borderRadius: 8,
                  }}
                  labelStyle={{ color: palette.textPrimary }}
                  itemStyle={{ color: palette.textPrimary }}
                  labelFormatter={(label) =>
                    typeof label === 'string' || typeof label === 'number'
                      ? formatDay(String(label))
                      : ''
                  }
                  formatter={(value) => [money.format(Number(value)), 'Price']}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Price"
                  stroke={palette.goldLight}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={!reduceMotion}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </>
      )}
    </Stack>
  );
}

function Reading({
  point,
  change,
  percent,
  windowLabel,
}: {
  point: ChartPoint;
  change: number;
  percent: number | null;
  windowLabel: string;
}) {
  const changeText =
    change === 0
      ? `No change over ${windowLabel}`
      : `${change > 0 ? '+' : '-'}${money.format(Math.abs(change))}${
          percent !== null ? ` (${percent > 0 ? '+' : ''}${percent.toFixed(1)}%)` : ''
        } over ${windowLabel}`;

  return (
    <Stack direction="row" spacing={1.25} alignItems="baseline" useFlexGap flexWrap="wrap">
      <Typography variant="h3" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {money.format(point.value)}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {formatDay(point.date)}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontVariantNumeric: 'tabular-nums',
          color: change === 0 ? 'text.secondary' : change > 0 ? 'success.main' : 'error.main',
        }}
      >
        {changeText}
      </Typography>
    </Stack>
  );
}

function axisMoney(value: number): string {
  return Math.abs(value) >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(2)}`;
}

function formatDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  if (!year || !month || !date) return day;
  return dayFormat.format(new Date(Date.UTC(year, month - 1, date)));
}

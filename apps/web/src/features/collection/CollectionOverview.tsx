import {
  Alert,
  Box,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import type {
  CollectionSummary,
  CollectionValueBreakdownBy,
  CollectionValueBucket,
  PriceRange,
} from '@opulent/shared';
import { useState } from 'react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  useCollectionValueBreakdown,
  useCollectionValueHistory,
} from '@/features/collection/queries';
import { palette } from '@/theme';
import { ChangeControls } from '@/shared/binder/ChangeControls';
import { CollectionStats } from './CollectionStats';

const FACTORS: { value: CollectionValueBreakdownBy; label: string }[] = [
  { value: 'set', label: 'Set' },
  { value: 'rarity', label: 'Rarity' },
  { value: 'finish', label: 'Finish' },
  { value: 'condition', label: 'Condition' },
  { value: 'language', label: 'Language' },
  { value: 'marks', label: 'Marks' },
  { value: 'trade', label: 'For trade' },
];

const SLICE_COLORS = [
  palette.goldLight,
  palette.steel,
  palette.markSigned,
  palette.markAltered,
  palette.markMisprint,
  palette.markMiscut,
  palette.markArtistProof,
  palette.gold,
  palette.steelDeep,
  palette.textSecondary,
];

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const moneyWhole = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const dayFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

function formatDay(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : dayFormat.format(date);
}

function axisMoney(value: number): string {
  return Math.abs(value) >= 1000 ? `$${(value / 1000).toFixed(1)}k` : moneyWhole.format(value);
}

/** Anything smaller than this cannot show an honest wedge, so it joins Other. */
const MIN_SLICE_SHARE = 0.01;

/** Slices worth drawing plus one tail wedge: a tiny share is thinner than a pixel. */
function pieBuckets(buckets: CollectionValueBucket[], total: number): CollectionValueBucket[] {
  if (buckets.length === 0 || total <= 0) return [];

  const keep = buckets.filter((bucket) => bucket.value / total >= MIN_SLICE_SHARE).slice(0, 8);
  const kept = new Set(keep.map((bucket) => bucket.key));
  const rest = buckets.filter((bucket) => !kept.has(bucket.key));
  if (rest.length === 0) return keep;

  const value = Math.round(rest.reduce((sum, bucket) => sum + bucket.value, 0) * 100) / 100;
  if (keep.length === 0) {
    const top = buckets.slice(0, 8);
    const topKeys = new Set(top.map((bucket) => bucket.key));
    const tail = buckets.filter((bucket) => !topKeys.has(bucket.key));
    return [
      ...top,
      {
        key: 'other',
        label: `Other (${tail.length})`,
        value: Math.round(tail.reduce((sum, bucket) => sum + bucket.value, 0) * 100) / 100,
      },
    ];
  }

  return [...keep, { key: 'other', label: `Other (${rest.length})`, value }];
}

/** Value over time and by one factor; each stack follows its own price rule, not one market price. */
export function CollectionOverview({
  enabled,
  totals,
}: {
  enabled: boolean;
  totals: CollectionSummary | undefined;
}) {
  const [range, setRange] = useState<PriceRange>('1m');
  const [factor, setFactor] = useState<CollectionValueBreakdownBy>('set');
  const history = useCollectionValueHistory(enabled, range);
  const breakdown = useCollectionValueBreakdown(enabled, factor);
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const animate = !reduceMotion;

  const points = history.data?.points ?? [];
  const total = breakdown.data?.total ?? 0;
  const buckets = pieBuckets(breakdown.data?.buckets ?? [], total);

  const tooltipStyle = {
    background: palette.surfaceRaised,
    border: `1px solid ${palette.divider}`,
    borderRadius: 8,
  };

  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
      <Stack spacing={2}>
        <Typography variant="h2">Collection overview</Typography>

        <CollectionStats totals={totals} />

        <Box
          sx={{
            display: 'grid',
            gap: { xs: 2.5, md: 3 },
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 3fr) minmax(0, 2fr)' },
          }}
        >
          <Stack spacing={1.5} sx={{ minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="space-between"
              useFlexGap
              flexWrap="wrap"
            >
              <Typography variant="h3">Value over time</Typography>
              <ChangeControls
                range={range}
                changeMode="amount"
                showMode={false}
                rangeLabel="Window"
                onRange={setRange}
                onMode={() => undefined}
              />
            </Stack>

            <Box sx={{ height: 260, minWidth: 0 }}>
              {history.isLoading ? (
                <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                  <CircularProgress size={28} />
                </Stack>
              ) : history.error ? (
                <Alert severity="error">{history.error.message}</Alert>
              ) : points.length === 0 ? (
                <Alert severity="info">No price history yet for these cards.</Alert>
              ) : (
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
                      width={58}
                      domain={['auto', 'auto']}
                      tickFormatter={axisMoney}
                      tick={{ fontSize: 11, fill: palette.textSecondary }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: palette.textPrimary }}
                      itemStyle={{ color: palette.textPrimary }}
                      labelFormatter={(label) =>
                        typeof label === 'string' || typeof label === 'number'
                          ? formatDay(String(label))
                          : ''
                      }
                      formatter={(value) => [money.format(Number(value)), 'Value']}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      name="Value"
                      stroke={palette.goldLight}
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={animate}
                      animationDuration={900}
                      animationEasing="ease-out"
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Box>
          </Stack>

          <Stack spacing={1.5} sx={{ minWidth: 0 }}>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent="space-between"
              useFlexGap
              flexWrap="wrap"
            >
              <Typography variant="h3">Value by</Typography>
              <TextField
                select
                size="small"
                label="Split by"
                value={factor}
                onChange={(event) => setFactor(event.target.value as CollectionValueBreakdownBy)}
                sx={{ minWidth: 148 }}
              >
                {FACTORS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Box sx={{ height: 260, minWidth: 0 }}>
              {breakdown.isLoading ? (
                <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                  <CircularProgress size={28} />
                </Stack>
              ) : breakdown.error ? (
                <Alert severity="error">{breakdown.error.message}</Alert>
              ) : buckets.length === 0 || total === 0 ? (
                <Alert severity="info">No priced cards to split yet.</Alert>
              ) : (
                <Stack spacing={1} sx={{ height: '100%' }}>
                  <Box sx={{ height: 190, minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={buckets}
                          dataKey="value"
                          nameKey="label"
                          innerRadius="46%"
                          outerRadius="80%"
                          minAngle={2.5}
                          paddingAngle={0.75}
                          stroke={palette.surface}
                          strokeWidth={1}
                          isAnimationActive={animate}
                          animationDuration={700}
                          animationEasing="ease-out"
                        >
                          {buckets.map((bucket, index) => (
                            <Cell
                              key={bucket.key}
                              fill={SLICE_COLORS[index % SLICE_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={tooltipStyle}
                          itemStyle={{ color: palette.textPrimary }}
                          formatter={(value, name) => {
                            const amount = Number(value);
                            const share = total > 0 ? (amount / total) * 100 : 0;
                            return [`${money.format(amount)} · ${share.toFixed(1)}%`, String(name)];
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>

                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, overflowY: 'auto' }}>
                    {buckets.map((bucket, index) => {
                      const share = total > 0 ? (bucket.value / total) * 100 : 0;
                      return (
                        <Stack
                          key={bucket.key}
                          direction="row"
                          spacing={0.5}
                          alignItems="center"
                          sx={{ minWidth: 0 }}
                        >
                          <Box
                            sx={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              bgcolor: SLICE_COLORS[index % SLICE_COLORS.length],
                              flexShrink: 0,
                            }}
                          />
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ overflowWrap: 'anywhere' }}
                          >
                            {bucket.label} · {share.toFixed(1)}%
                          </Typography>
                        </Stack>
                      );
                    })}
                  </Box>
                </Stack>
              )}
            </Box>
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}

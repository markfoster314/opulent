import {
  Alert,
  Box,
  CircularProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { CardFinish, PriceRange } from '@opulent/shared';
import { priceForFinish } from '@opulent/shared';
import { useEffect, useState } from 'react';
import type { MouseEvent, TouchEvent } from 'react';
import { useCardPriceSeries } from '../api/queries';
import { palette } from '../theme';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const RANGES: { value: PriceRange; label: string }[] = [
  { value: '1w', label: '1W' },
  { value: '1m', label: '1M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
];

/** Drawing space. The SVG scales to the width it is given. */
const WIDTH = 600;
const HEIGHT = 170;
const PAD = 12;
/** Room on the left for the price labels. */
const PLOT_LEFT = 64;
const PLOT_RIGHT = 12;

interface ChartPoint {
  day: string;
  value: number;
}

/**
 * The price line for one printing, in the finish the owner actually holds.
 *
 * History stores change points, and the server carries the last price forward,
 * so every day in the window has a value. A foil is charted with foil prices,
 * never the plain ones.
 *
 * Hovering the plot reads the nearest day. The heading shows that day's price
 * and date; with no pointer it shows the newest day. The change figure always
 * covers the whole selected window, so it does not jump while reading the line.
 */
export function PriceHistoryChart({
  scryfallId,
  finish,
}: {
  scryfallId: string;
  finish: CardFinish;
}) {
  const [range, setRange] = useState<PriceRange>('1w');
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const { data, isLoading, error } = useCardPriceSeries(scryfallId, range);

  // A new window starts clean; an index from the old series means nothing here.
  useEffect(() => {
    setHoverIndex(null);
  }, [range, scryfallId]);

  const points: ChartPoint[] = (data?.points ?? [])
    .map((point) => ({
      day: point.recordedOn,
      value: Number(priceForFinish(point.prices, finish) ?? ''),
    }))
    .filter((point) => Number.isFinite(point.value));

  const first = points[0];
  const last = points[points.length - 1];
  // The change runs from the first day of the window to the day under the
  // pointer, or to the last day when nothing is hovered.
  const activeIndex =
    hoverIndex === null ? points.length - 1 : Math.min(hoverIndex, points.length - 1);
  const active = points[activeIndex];
  const change = first && active ? active.value - first.value : null;
  const percent = change !== null && first && first.value > 0 ? (change / first.value) * 100 : null;
  const rangeLabel = RANGES.find((option) => option.value === range)?.label ?? '';
  const periodLabel =
    hoverIndex === null || !active ? `over ${rangeLabel}` : `to ${formatDay(active.day)}`;

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
          <Reading
            point={active ?? last}
            change={change}
            percent={percent}
            periodLabel={periodLabel}
          />

          <PriceLine points={points} hoverIndex={hoverIndex} onHover={setHoverIndex} />

          <Stack direction="row" justifyContent="space-between" spacing={1}>
            <Typography variant="caption" color="text.secondary">
              {formatDay(first.day)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDay(last.day)}
            </Typography>
          </Stack>
        </>
      )}
    </Stack>
  );
}

/**
 * Price and date under the pointer, plus the change across the whole window.
 * With no pointer it shows the newest day, so the row is never empty.
 */
function Reading({
  point,
  change,
  percent,
  periodLabel,
}: {
  point: ChartPoint;
  change: number;
  percent: number | null;
  /** "over 1W" at rest, or "to Oct 24" while pointing at a day. */
  periodLabel: string;
}) {
  const changeText =
    change === 0
      ? `No change ${periodLabel}`
      : `${change > 0 ? '+' : '-'}${money.format(Math.abs(change))}${
          percent !== null ? ` (${percent > 0 ? '+' : ''}${percent.toFixed(1)}%)` : ''
        } ${periodLabel}`;

  return (
    <Stack direction="row" spacing={1.25} alignItems="baseline" useFlexGap flexWrap="wrap">
      <Typography variant="h3" sx={{ fontVariantNumeric: 'tabular-nums' }}>
        {money.format(point.value)}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {formatDay(point.day)}
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

/** Gold line over a faint gold wash, with price labels and a hover crosshair. */
function PriceLine({
  points,
  hoverIndex,
  onHover,
}: {
  points: ChartPoint[];
  hoverIndex: number | null;
  onHover: (index: number | null) => void;
}) {
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(max, 1);
  const plotWidth = WIDTH - PLOT_LEFT - PLOT_RIGHT;
  const plotHeight = HEIGHT - PAD * 2;

  const x = (index: number) => PLOT_LEFT + (index / (points.length - 1)) * plotWidth;
  const y = (value: number) => HEIGHT - PAD - ((value - min) / span) * plotHeight;

  const line = points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.value).toFixed(1)}`,
    )
    .join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${HEIGHT - PAD} L${x(0).toFixed(1)},${HEIGHT - PAD} Z`;

  // One label when every price is the same, so they cannot stack up.
  const ticks = [max, (max + min) / 2, min].filter(
    (tick, index, all) => all.indexOf(tick) === index,
  );
  const hovered = hoverIndex !== null ? points[hoverIndex] : undefined;

  /** Turn a pointer position into the nearest day. */
  function indexAt(clientX: number, rect: DOMRect): number {
    const viewX = ((clientX - rect.left) / rect.width) * WIDTH;
    const position = (viewX - PLOT_LEFT) / plotWidth;
    return Math.max(0, Math.min(points.length - 1, Math.round(position * (points.length - 1))));
  }

  function handleMove(event: MouseEvent<HTMLDivElement>) {
    onHover(indexAt(event.clientX, event.currentTarget.getBoundingClientRect()));
  }

  /** A finger has no hover, so touching the line reads the same value. */
  function handleTouch(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    if (!touch) return;
    onHover(indexAt(touch.clientX, event.currentTarget.getBoundingClientRect()));
  }

  return (
    <Box
      onMouseMove={handleMove}
      onMouseLeave={() => onHover(null)}
      onTouchStart={handleTouch}
      onTouchMove={handleTouch}
      sx={{ position: 'relative', minWidth: 0 }}
    >
      <Box
        component="svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Price over time"
        sx={{ width: '100%', height: 'auto', display: 'block' }}
      >
        {ticks.map((tick, index) => (
          <g key={index}>
            <line
              x1={PLOT_LEFT}
              x2={WIDTH - PLOT_RIGHT}
              y1={y(tick)}
              y2={y(tick)}
              stroke={palette.divider}
              strokeWidth={1}
            />
            <text
              x={PLOT_LEFT - 8}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize={11}
              fill={palette.textSecondary}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {money.format(tick)}
            </text>
          </g>
        ))}

        <path d={area} fill={palette.goldTint} />
        <path
          d={line}
          fill="none"
          stroke={palette.goldLight}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {hovered && (
          <>
            <line
              x1={x(hoverIndex ?? 0)}
              x2={x(hoverIndex ?? 0)}
              y1={PAD}
              y2={HEIGHT - PAD}
              stroke={palette.goldBorder}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <circle
              cx={x(hoverIndex ?? 0)}
              cy={y(hovered.value)}
              r={4}
              fill={palette.goldHighlight}
              stroke={palette.surface}
              strokeWidth={2}
            />
          </>
        )}

        <circle
          cx={x(points.length - 1)}
          cy={y(points[points.length - 1]!.value)}
          r={3}
          fill={palette.goldLight}
        />
      </Box>

      {hovered && (
        <Box
          sx={{
            position: 'absolute',
            left: `${Math.min(92, Math.max(8, (x(hoverIndex ?? 0) / WIDTH) * 100))}%`,
            top: 0,
            transform: 'translate(-50%, 0)',
            px: 1,
            py: 0.25,
            borderRadius: 1,
            border: `1px solid ${palette.goldBorder}`,
            backgroundColor: palette.surfaceRaised,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {formatDay(hovered.day)} · {money.format(hovered.value)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

/** 2026-10-27 -> Oct 27. */
function formatDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  if (!year || !month || !date) return day;
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

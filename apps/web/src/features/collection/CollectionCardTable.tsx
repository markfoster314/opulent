import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import {
  Box,
  Button,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type { CollectionHighlight, CollectionSort, SortDirection } from '@opulent/shared';
import type { ReactNode } from 'react';
import { ART_SIZE, CardArtSquare } from '@/shared/cards/CardArtSquare';
import { palette } from '@/theme';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

const finishLabels: Record<string, string> = {
  foil: 'foil',
  etched: 'etched',
};

function changeColor(change: string | null) {
  if (change === null) return 'text.disabled';
  return change.startsWith('+') ? 'success.main' : 'error.main';
}

/** Down caret is natural order; clicking the active column reverses it. */
function SortHeader({
  label,
  column,
  sort,
  dir,
  onSortChange,
}: {
  label: string;
  column: CollectionSort;
  sort: CollectionSort | undefined;
  dir: SortDirection | undefined;
  onSortChange: (sort: CollectionSort, dir: SortDirection) => void;
}) {
  const active = sort === column;
  const nextDir: SortDirection = active
    ? dir === 'asc'
      ? 'desc'
      : 'asc'
    : column === 'name'
      ? 'asc'
      : 'desc';

  const downCaret = column === 'name' ? dir === 'asc' : dir === 'desc';

  return (
    <Box
      role="columnheader"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      sx={{ display: 'flex', justifyContent: 'inherit', minWidth: 0 }}
    >
      <Button
        size="small"
        onClick={() => onSortChange(column, nextDir)}
        endIcon={
          active ? (
            downCaret ? (
              <KeyboardArrowDownIcon fontSize="inherit" />
            ) : (
              <KeyboardArrowUpIcon fontSize="inherit" />
            )
          ) : (
            <UnfoldMoreIcon fontSize="inherit" sx={{ opacity: 0.55 }} />
          )
        }
        sx={{
          minWidth: 0,
          minHeight: 40,
          px: 0.5,
          color: active ? palette.textPrimary : palette.steel,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontWeight: 700,
          fontSize: '0.7rem',
          whiteSpace: 'nowrap',
          '& .MuiButton-endIcon': { ml: 0.25, mr: 0 },
          '&:hover': { color: palette.textPrimary, backgroundColor: palette.steelWash },
        }}
      >
        {label}
      </Button>
    </Box>
  );
}

function TradeMark({ forTrade }: { forTrade: boolean }) {
  return forTrade ? (
    <SwapHorizIcon fontSize="small" color="primary" />
  ) : (
    <SwapHorizIcon fontSize="small" sx={{ color: 'text.disabled' }} />
  );
}

export function CollectionCardRow({
  item,
  onClick,
  expandable = false,
  expanded = false,
  changeMode = 'amount',
  onToggleTrade,
  tradeSaving = false,
}: {
  item: CollectionHighlight;
  onClick?: (() => void) | undefined;
  expandable?: boolean;
  expanded?: boolean;
  changeMode?: 'amount' | 'percent';
  onToggleTrade?: ((item: CollectionHighlight) => void) | undefined;
  tradeSaving?: boolean;
}) {
  const finishNote = item.finish === 'nonfoil' ? '' : ` · ${finishLabels[item.finish] ?? ''}`;

  return (
    <Box
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-expanded={expandable ? expanded : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background-color 120ms ease',
        '&:hover': onClick ? { backgroundColor: palette.goldTint } : undefined,
        '&:focus-visible': { outline: `2px solid ${palette.gold}`, outlineOffset: -2 },
      }}
    >
      <Stack direction="row" sx={{ height: ART_SIZE, minWidth: 0 }}>
        <CardArtSquare url={item.imageUrl} foil={item.finish === 'foil'} />

        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          sx={{ flex: 1, minWidth: 0, pl: 1.25, pr: expandable ? 0.5 : { xs: 1.25, sm: 1.75 } }}
        >
          <Stack sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" spacing={0.75} alignItems="baseline" sx={{ minWidth: 0 }}>
              <Typography variant="body2" noWrap title={item.name} sx={{ minWidth: 0 }}>
                {item.name}
              </Typography>
              {item.quantity > 1 && (
                <Typography
                  variant="caption"
                  sx={{ color: 'primary.main', fontWeight: 700, flexShrink: 0 }}
                >
                  (x{item.quantity})
                </Typography>
              )}
            </Stack>
            <Typography variant="caption" color="text.secondary" noWrap>
              {item.setCode.toUpperCase()}
              {finishNote}
            </Typography>
          </Stack>

          <Typography
            variant="body2"
            sx={{
              width: 84,
              flexShrink: 0,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {item.price === null ? '—' : money.format(Number(item.price))}
          </Typography>

          <Typography
            variant="body2"
            sx={{
              width: 96,
              flexShrink: 0,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
              ml: 1,
              color: changeColor(changeMode === 'percent' ? item.changePercent : item.change),
            }}
          >
            {(changeMode === 'percent' ? item.changePercent : item.change) ?? '—'}
          </Typography>

          {onToggleTrade && (
            <Tooltip
              title={item.forTrade ? 'For trade. Click to keep it.' : 'Kept. Click to offer it.'}
            >
              <IconButton
                aria-label={
                  item.forTrade
                    ? `Stop offering ${item.name} for trade`
                    : `Offer ${item.name} for trade`
                }
                aria-pressed={item.forTrade}
                disabled={tradeSaving}
                onKeyDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleTrade(item);
                }}
                sx={{
                  width: 40,
                  height: 40,
                  flexShrink: 0,
                  display: { xs: 'none', sm: 'inline-flex' },
                }}
              >
                <TradeMark forTrade={item.forTrade} />
              </IconButton>
            </Tooltip>
          )}
        </Stack>

        {expandable && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              pr: 1,
              color: 'text.secondary',
              flexShrink: 0,
              transition: 'transform 200ms ease',
              transform: expanded ? 'rotate(180deg)' : 'none',
            }}
          >
            <ExpandMoreIcon fontSize="small" />
          </Box>
        )}
      </Stack>
    </Box>
  );
}

export function CollectionCardTable({
  items,
  onRowClick,
  expandedIds,
  renderDetail,
  sort,
  dir,
  onSortChange,
  changeMode = 'amount',
  onToggleTrade,
  tradeSaving = false,
}: {
  items: CollectionHighlight[];
  onRowClick?: (item: CollectionHighlight) => void;
  expandedIds?: ReadonlySet<string>;
  renderDetail?: (item: CollectionHighlight) => ReactNode;
  sort?: CollectionSort;
  dir?: SortDirection;
  onSortChange?: (sort: CollectionSort, dir: SortDirection) => void;
  changeMode?: 'amount' | 'percent';
  onToggleTrade?: (item: CollectionHighlight) => void;
  tradeSaving?: boolean;
}) {
  return (
    <Paper sx={{ p: 0, minWidth: 0, overflow: 'hidden' }}>
      {onSortChange && (
        <Box
          role="row"
          sx={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: `1px solid ${palette.divider}`,
            pr: renderDetail ? 0 : { xs: 1.25, sm: 1.75 },
          }}
        >
          <Box sx={{ width: ART_SIZE, flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0, pl: 1.25 }}>
            <SortHeader
              label="Name"
              column="name"
              sort={sort}
              dir={dir}
              onSortChange={onSortChange}
            />
          </Box>
          <Box sx={{ width: 84, flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
            <SortHeader
              label="Price"
              column="price"
              sort={sort}
              dir={dir}
              onSortChange={onSortChange}
            />
          </Box>
          <Box
            sx={{
              width: 96,
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'flex-end',
              ml: 1,
            }}
          >
            <SortHeader
              label={changeMode === 'percent' ? 'Change %' : 'Change'}
              column="change"
              sort={sort}
              dir={dir}
              onSortChange={onSortChange}
            />
          </Box>
          {onToggleTrade && (
            <Box sx={{ width: 40, flexShrink: 0, display: { xs: 'none', sm: 'block' } }} />
          )}
          {renderDetail && <Box sx={{ width: 28, flexShrink: 0 }} />}
        </Box>
      )}

      <Stack divider={<Divider flexItem />} spacing={0}>
        {items.map((item) => {
          const expanded = Boolean(renderDetail) && (expandedIds?.has(item.id) ?? false);
          return (
            <Box key={item.id} id={`collection-card-${item.id}`}>
              <CollectionCardRow
                item={item}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                expandable={Boolean(renderDetail)}
                expanded={expanded}
                changeMode={changeMode}
                onToggleTrade={onToggleTrade}
                tradeSaving={tradeSaving}
              />
              {renderDetail && (
                <Collapse in={expanded} timeout={240} unmountOnExit>
                  {renderDetail(item)}
                </Collapse>
              )}
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}

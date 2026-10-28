import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import { Box, Button, Collapse, Divider, Paper, Stack, Typography } from '@mui/material';
import type { WantItem } from '@opulent/shared';
import { describeWantScope, wantPriorityLabels } from '@opulent/shared';
import type { ReactNode } from 'react';
import { palette } from '../theme';
import type { WantSort, WantSortDir } from '../wantBrowser';
import { CardArtSquare } from './CollectionCardTable';

/** Keep row height aligned with the collection table. */
const ART_SIZE = 64;

function SortHeader({
  label,
  column,
  sort,
  dir,
  onSortChange,
}: {
  label: string;
  column: WantSort;
  sort: WantSort;
  dir: WantSortDir;
  onSortChange: (sort: WantSort, dir: WantSortDir) => void;
}) {
  const active = sort === column;
  const natural: WantSortDir = column === 'quantity' ? 'desc' : 'asc';
  const nextDir: WantSortDir = active ? (dir === 'asc' ? 'desc' : 'asc') : natural;
  const downCaret = column === 'quantity' ? dir === 'desc' : dir === 'asc';

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

function WantCardRow({
  item,
  onClick,
  expandable = false,
  expanded = false,
}: {
  item: WantItem;
  onClick?: (() => void) | undefined;
  expandable?: boolean;
  expanded?: boolean;
}) {
  const image = item.imageUris?.normal ?? item.imageUris?.large ?? item.imageUris?.small ?? null;

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
        <CardArtSquare url={image} foil={false} />

        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          sx={{ flex: 1, minWidth: 0, pl: 1.25, pr: expandable ? 0.5 : { xs: 1.25, sm: 1.75 } }}
        >
          <Stack sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" noWrap title={item.cardName ?? 'Card'} sx={{ minWidth: 0 }}>
              {item.cardName ?? 'Card'}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {describeWantScope(item)}
            </Typography>
          </Stack>

          <Typography
            variant="body2"
            sx={{
              width: 84,
              flexShrink: 0,
              textAlign: 'right',
              color: item.priority === 1 ? 'primary.main' : 'text.secondary',
            }}
          >
            {wantPriorityLabels[item.priority] ?? 'Medium'}
          </Typography>

          <Typography
            variant="body2"
            sx={{
              width: 52,
              flexShrink: 0,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
              ml: 1,
            }}
          >
            ×{item.quantity}
          </Typography>
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

export function WantCardTable({
  items,
  onRowClick,
  expandedIds,
  renderDetail,
  sort,
  dir,
  onSortChange,
}: {
  items: WantItem[];
  onRowClick?: (item: WantItem) => void;
  expandedIds?: ReadonlySet<string>;
  renderDetail?: (item: WantItem) => ReactNode;
  sort: WantSort;
  dir: WantSortDir;
  onSortChange: (sort: WantSort, dir: WantSortDir) => void;
}) {
  return (
    <Paper sx={{ p: 0, minWidth: 0, overflow: 'hidden' }}>
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
            label="Priority"
            column="priority"
            sort={sort}
            dir={dir}
            onSortChange={onSortChange}
          />
        </Box>
        <Box
          sx={{
            width: 52,
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'flex-end',
            ml: 1,
          }}
        >
          <SortHeader
            label="Qty"
            column="quantity"
            sort={sort}
            dir={dir}
            onSortChange={onSortChange}
          />
        </Box>
        {renderDetail && <Box sx={{ width: 28, flexShrink: 0 }} />}
      </Box>

      <Stack divider={<Divider flexItem />} spacing={0}>
        {items.map((item) => {
          const expanded = Boolean(renderDetail) && (expandedIds?.has(item.id) ?? false);
          return (
            <Box key={item.id} id={`want-card-${item.id}`}>
              <WantCardRow
                item={item}
                onClick={onRowClick ? () => onRowClick(item) : undefined}
                expandable={Boolean(renderDetail)}
                expanded={expanded}
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

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Box, Collapse, Divider, Paper, Stack, Typography } from '@mui/material';
import type { CollectionHighlight } from '@opulent/shared';
import type { ReactNode } from 'react';
import { palette } from '../theme';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Height of one row, which is also the width of the square art tile. */
const ART_SIZE = 64;

/**
 * The artwork window: the fractions of the card image cut away from each edge.
 *
 * These four numbers are the ones to edit while tuning the crop. Raise `top` to
 * move the window down the card; raise `bottom` to cut more off the foot; change
 * `left` and `right` to trim the sides. The window is a square in the layout, so
 * if these numbers leave a rectangle, the longer side is trimmed evenly and the
 * centre of the artwork stays in the centre.
 */
const CARD_ART_CROP = {
  top: 0.115,
  left: 0.1,
  right: 0.1,
  bottom: 0.485,
};

/** Scryfall card images are 488 by 680 pixels, so height over width. */
const CARD_IMAGE_ASPECT = 680 / 488;

const finishLabels: Record<string, string> = {
  foil: 'foil',
  etched: 'etched',
};

/** Green for a rise, red for a fall, dim for no news. */
function changeColor(change: string | null) {
  if (change === null) return 'text.disabled';
  return change.startsWith('+') ? 'success.main' : 'error.main';
}

/**
 * Places the full card image so the artwork window fills the square.
 *
 * Width and offsets are percentages of the square, which is the containing
 * block for the absolutely placed image. `maxWidth` is cleared because the
 * scaled image is wider than its box on purpose.
 */
function artCropSx() {
  const windowWidth = 1 - CARD_ART_CROP.left - CARD_ART_CROP.right;
  const windowHeight = 1 - CARD_ART_CROP.top - CARD_ART_CROP.bottom;

  const scale = 1 / Math.min(windowWidth, windowHeight * CARD_IMAGE_ASPECT);
  // Fractions of the image that the square can show, in each direction.
  const visibleWidth = 1 / scale;
  const visibleHeight = 1 / (scale * CARD_IMAGE_ASPECT);
  // Centre whatever the window leaves over, so trimming stays symmetrical.
  const offsetX = CARD_ART_CROP.left + (windowWidth - visibleWidth) / 2;
  const offsetY = CARD_ART_CROP.top + (windowHeight - visibleHeight) / 2;

  return {
    position: 'absolute',
    width: `${scale * 100}%`,
    maxWidth: 'none',
    height: 'auto',
    left: `${-offsetX * scale * 100}%`,
    top: `${-offsetY * scale * CARD_IMAGE_ASPECT * 100}%`,
  };
}

/** One square of card artwork, flush with the row's left edge. */
function ArtSquare({ url }: { url: string | null }) {
  return (
    <Box
      sx={{
        width: ART_SIZE,
        height: ART_SIZE,
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: palette.surfaceRaised,
      }}
    >
      {url && <Box component="img" src={url} alt="" loading="lazy" sx={artCropSx()} />}
    </Box>
  );
}

/** One card row: art, name, set, price, weekly move. */
export function CollectionCardRow({
  item,
  onClick,
  expandable = false,
  expanded = false,
}: {
  item: CollectionHighlight;
  onClick?: (() => void) | undefined;
  expandable?: boolean;
  expanded?: boolean;
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
        <ArtSquare url={item.imageUrl} />

        <Stack
          direction="row"
          spacing={1.25}
          alignItems="center"
          sx={{ flex: 1, minWidth: 0, pl: 1.25, pr: expandable ? 0.5 : { xs: 1.25, sm: 1.75 } }}
        >
          <Stack sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" noWrap title={item.name}>
              {item.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {item.setCode.toUpperCase()}
              {finishNote}
            </Typography>
          </Stack>

          <Typography variant="body2" sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
            {item.price === null ? '—' : money.format(Number(item.price))}
          </Typography>

          <Typography
            variant="body2"
            sx={{
              width: 64,
              flexShrink: 0,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
              color: changeColor(item.weekChange),
            }}
          >
            {item.weekChange ?? '—'}
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

/**
 * A flush table of card rows.
 *
 * Rows are clickable when `onRowClick` is given. When `renderDetail` is given,
 * every row in `expandedIds` stays open and shows its detail, so several can be
 * open at once.
 */
export function CollectionCardTable({
  items,
  onRowClick,
  expandedIds,
  renderDetail,
}: {
  items: CollectionHighlight[];
  onRowClick?: (item: CollectionHighlight) => void;
  /** Rows that are open. Several may be open at once. */
  expandedIds?: ReadonlySet<string>;
  renderDetail?: (item: CollectionHighlight) => ReactNode;
}) {
  return (
    <Paper sx={{ p: 0, minWidth: 0, overflow: 'hidden' }}>
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

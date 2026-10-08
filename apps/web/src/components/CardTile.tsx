import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import { Box, Chip, Paper, Stack, Tooltip, Typography } from '@mui/material';
import type { BinderItem, Card } from '@opulent/shared';
import { askingPriceForFinish, cardLanguageLabels, formatUsd } from '@opulent/shared';
import { palette } from '../theme';

interface CardTileProps {
  card: Card;
  quantity?: number;
  /** Asking price, already formatted, such as "$1.50", "MKT", or "90% MKT". */
  price?: string | null;
  /** Shown as a mark on the image. The note itself appears on hover. */
  notes?: string | null;
  caption?: string;
  onClick?: () => void;
}

/** The dollar amount on a binder stack. With no stored market price, market shows MKT and a percent shows as 90% MKT. */
export function binderTilePrice(
  item: Pick<BinderItem, 'card' | 'finish' | 'price'>,
): string | null {
  if (!item.card) return null;
  const asking = formatUsd(askingPriceForFinish(item.card.prices, item.finish, item.price));
  if (asking) return asking;
  if (item.price.kind === 'market') return 'MKT';
  if (item.price.kind === 'percent') return `${item.price.percent}% MKT`;
  return null;
}

/** Set, finish, condition, language, and any marks, in one line under the image. */
export function binderTileCaption(item: BinderItem): string {
  if (!item.card) return '';
  return [
    item.card.setCode.toUpperCase(),
    item.finish === 'nonfoil' ? null : item.finish,
    item.condition,
    item.language === 'en' ? null : cardLanguageLabels[item.language],
    item.signed ? 'Signed' : null,
    item.altered ? 'Altered' : null,
    item.misprint ? 'Misprint' : null,
    item.miscut ? 'Miscut' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Card images are hotlinked straight from Scryfall's CDN.
 *
 * The Scryfall terms forbid cropping, stretching, recolouring or watermarking
 * card images, so this tile only ever scales the whole image proportionally.
 */
export function CardTile({ card, quantity, price, notes, caption, onClick }: CardTileProps) {
  const image = card.imageUris?.normal ?? card.imageUris?.small;

  return (
    <Paper
      onClick={onClick}
      sx={{
        position: 'relative',
        p: 1,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 120ms ease, transform 120ms ease',
        '&:hover': onClick
          ? { borderColor: palette.gold, transform: 'translateY(-2px)' }
          : undefined,
      }}
    >
      {notes ? (
        <Tooltip
          title={notes}
          slotProps={{ tooltip: { sx: { whiteSpace: 'pre-wrap', maxWidth: 280 } } }}
        >
          <Box
            component="button"
            type="button"
            aria-label={notes}
            onClick={(event) => event.stopPropagation()}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              zIndex: 1,
              width: 42,
              height: 42,
              p: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 0,
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
              borderBottomLeftRadius: 0,
              // One pixel inside the card border, so this curve sits on the card's curve.
              borderTopLeftRadius: (theme) => {
                const radius = Number(theme.shape.borderRadius);
                return `${Math.max(0, radius - 1)}px`;
              },
              cursor: 'pointer',
              color: palette.background,
              backgroundColor: palette.gold,
            }}
          >
            <StickyNote2OutlinedIcon sx={{ fontSize: 24 }} />
          </Box>
        </Tooltip>
      ) : null}

      <Box
        sx={{
          position: 'relative',
          aspectRatio: '488 / 680',
          borderRadius: 1.5,
          overflow: 'hidden',
        }}
      >
        {image ? (
          <Box
            component="img"
            src={image}
            alt={card.name}
            loading="lazy"
            sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        ) : (
          <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
            <Typography variant="caption" color="text.secondary">
              No image
            </Typography>
          </Stack>
        )}

        {quantity !== undefined && quantity > 1 && (
          <Chip
            label={`x${quantity}`}
            size="small"
            color="primary"
            sx={{ position: 'absolute', top: 8, right: 8 }}
          />
        )}

        {price ? (
          <Chip
            label={price}
            size="small"
            color="primary"
            sx={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              maxWidth: 'calc(100% - 16px)',
              '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' },
            }}
          />
        ) : null}
      </Box>

      <Stack sx={{ px: 0.5, pt: 1 }}>
        <Typography variant="body2" noWrap title={card.name}>
          {card.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {caption ?? `${card.setCode.toUpperCase()} · ${card.collectorNumber}`}
        </Typography>
      </Stack>
    </Paper>
  );
}

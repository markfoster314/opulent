import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import type { Card } from '@opulent/shared';
import { palette } from '../theme';

interface CardTileProps {
  card: Card;
  quantity?: number;
  caption?: string;
  onClick?: () => void;
}

/**
 * Card images are hotlinked straight from Scryfall's CDN.
 *
 * The Scryfall terms forbid cropping, stretching, recolouring or watermarking
 * card images, so this tile only ever scales the whole image proportionally.
 */
export function CardTile({ card, quantity, caption, onClick }: CardTileProps) {
  const image = card.imageUris?.normal ?? card.imageUris?.small;

  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 1,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 120ms ease, transform 120ms ease',
        '&:hover': onClick
          ? { borderColor: palette.gold, transform: 'translateY(-2px)' }
          : undefined,
      }}
    >
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

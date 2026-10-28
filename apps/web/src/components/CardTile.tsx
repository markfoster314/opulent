import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';
import ContentCutOutlinedIcon from '@mui/icons-material/ContentCutOutlined';
import DrawOutlinedIcon from '@mui/icons-material/DrawOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import { Box, Chip, Link, Paper, Stack, Tooltip, Typography } from '@mui/material';
import type { CollectionItem, Card } from '@opulent/shared';
import { askingPriceForFinish, cardFinishLabels, formatUsd } from '@opulent/shared';
import type { ReactNode } from 'react';
import { palette } from '../theme';
import { FoilSheen } from './FoilSheen';

interface CardTileProps {
  card: Pick<Card, 'name' | 'imageUris' | 'setCode' | 'collectorNumber'>;
  quantity?: number;
  /** Asking price, already formatted, such as "$1.50", "MKT", or "90% MKT". */
  price?: string | null;
  /** Shown as a mark on the image. The note itself appears on hover. */
  notes?: string | null;
  /** A page of photos of this copy. Opens in a new tab. */
  photoUrl?: string | null;
  signed?: boolean;
  altered?: boolean;
  misprint?: boolean;
  miscut?: boolean;
  artistProof?: boolean;
  caption?: string;
  /** Draws a gloss over the scan when this copy is foil. */
  foil?: boolean;
  /** Drawn with the copy marks. A want uses these for language, printing, condition, and set. */
  extraMarks?: CardTileMark[];
  /** Image and name only. The set line and the photo line stay off. */
  nameOnly?: boolean;
  onClick?: () => void;
}

/** The dollar amount on a binder stack. With no stored market price, market shows MKT and a percent shows as 90% MKT. */
export function collectionTilePrice(
  item: Pick<CollectionItem, 'card' | 'finish' | 'price'>,
): string | null {
  if (!item.card) return null;
  const asking = formatUsd(askingPriceForFinish(item.card.prices, item.finish, item.price));
  if (asking) return asking;
  if (item.price.kind === 'market') return 'MKT';
  if (item.price.kind === 'percent') return `${item.price.percent}% MKT`;
  return null;
}

export function collectionTileCaption(item: CollectionItem): string {
  if (!item.card) return '';
  return [
    item.card.setCode.toUpperCase(),
    cardFinishLabels[item.finish],
    item.condition,
    item.language.toUpperCase(),
  ].join(' · ');
}

export interface CardTileMark {
  key: string;
  label: string;
  color: string;
  icon: ReactNode;
}

const markSize = 34;
const markIconSize = 18;

function cardMarks(
  props: Pick<
    CardTileProps,
    'notes' | 'signed' | 'altered' | 'misprint' | 'miscut' | 'artistProof'
  >,
): CardTileMark[] {
  const marks: CardTileMark[] = [];
  if (props.notes) {
    marks.push({
      key: 'notes',
      label: `Notes: ${props.notes}`,
      color: palette.gold,
      icon: <StickyNote2OutlinedIcon sx={{ fontSize: markIconSize }} />,
    });
  }
  if (props.signed) {
    marks.push({
      key: 'signed',
      label: 'Signed',
      color: palette.markSigned,
      icon: <DrawOutlinedIcon sx={{ fontSize: markIconSize }} />,
    });
  }
  if (props.altered) {
    marks.push({
      key: 'altered',
      label: 'Altered',
      color: palette.markAltered,
      icon: <BrushOutlinedIcon sx={{ fontSize: markIconSize }} />,
    });
  }
  if (props.misprint) {
    marks.push({
      key: 'misprint',
      label: 'Misprint',
      color: palette.markMisprint,
      icon: <ReportProblemOutlinedIcon sx={{ fontSize: markIconSize }} />,
    });
  }
  if (props.miscut) {
    marks.push({
      key: 'miscut',
      label: 'Miscut',
      color: palette.markMiscut,
      icon: <ContentCutOutlinedIcon sx={{ fontSize: markIconSize }} />,
    });
  }
  if (props.artistProof) {
    marks.push({
      key: 'artist-proof',
      label: 'Artist proof',
      color: palette.markArtistProof,
      icon: <WorkspacePremiumOutlinedIcon sx={{ fontSize: markIconSize }} />,
    });
  }
  return marks;
}

/** Scryfall terms forbid cropping, stretching, recolouring, or watermarking, so only scale the image. */
export function CardTile({
  card,
  quantity,
  price,
  notes,
  signed,
  altered,
  misprint,
  miscut,
  artistProof,
  caption,
  foil,
  photoUrl,
  extraMarks,
  nameOnly,
  onClick,
}: CardTileProps) {
  const image = card.imageUris?.normal ?? card.imageUris?.small;
  const marks = [
    ...cardMarks({ notes, signed, altered, misprint, miscut, artistProof }),
    ...(extraMarks ?? []),
  ];

  return (
    <Paper
      onClick={onClick}
      sx={{
        position: 'relative',
        p: 1,
        width: '100%',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color 120ms ease, transform 120ms ease',
        '&:hover': onClick
          ? { borderColor: palette.gold, transform: 'translateY(-2px)' }
          : undefined,
      }}
    >
      {marks.length > 0 ? (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {marks.map((mark, index) => (
            <Tooltip
              key={mark.key}
              title={mark.label}
              placement="left"
              slotProps={{ tooltip: { sx: { whiteSpace: 'pre-wrap', maxWidth: 280 } } }}
            >
              <Box
                component="button"
                type="button"
                aria-label={mark.label}
                onClick={(event) => event.stopPropagation()}
                sx={{
                  width: markSize,
                  height: markSize,
                  p: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 0,
                  borderRadius: 0,
                  borderTopLeftRadius:
                    index === 0
                      ? (theme) => {
                          const radius = Number(theme.shape.borderRadius);
                          return `${Math.max(0, radius - 1)}px`;
                        }
                      : 0,
                  cursor: 'pointer',
                  color: palette.background,
                  backgroundColor: mark.color,
                }}
              >
                {mark.icon}
              </Box>
            </Tooltip>
          ))}
        </Box>
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

        {foil && image ? <FoilSheen /> : null}

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
        <Typography
          variant="body2"
          noWrap={!nameOnly}
          title={card.name}
          sx={nameOnly ? { overflowWrap: 'anywhere' } : undefined}
        >
          {card.name}
        </Typography>
        {!nameOnly && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {caption ?? `${card.setCode.toUpperCase()} · ${card.collectorNumber}`}
          </Typography>
        )}
        {!nameOnly &&
          (photoUrl ? (
            <Link
              href={photoUrl}
              target="_blank"
              rel="noreferrer"
              variant="caption"
              onClick={(event) => event.stopPropagation()}
            >
              Photos
            </Link>
          ) : (
            <Typography variant="caption" aria-hidden sx={{ visibility: 'hidden' }}>
              Photos
            </Typography>
          ))}
      </Stack>
    </Paper>
  );
}

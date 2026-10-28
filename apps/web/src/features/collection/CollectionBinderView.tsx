import BrushOutlinedIcon from '@mui/icons-material/BrushOutlined';
import ContentCutOutlinedIcon from '@mui/icons-material/ContentCutOutlined';
import DrawOutlinedIcon from '@mui/icons-material/DrawOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import { Box, Stack, Typography } from '@mui/material';
import type { CollectionHighlight } from '@opulent/shared';
import { formatUsd } from '@opulent/shared';
import type { ReactNode } from 'react';
import { palette } from '@/theme';
import { FoilSheen } from '@/shared/cards/FoilSheen';

const markSticker = {
  signed: { label: 'Signed', color: palette.markSigned, icon: DrawOutlinedIcon },
  altered: { label: 'Altered', color: palette.markAltered, icon: BrushOutlinedIcon },
  misprint: { label: 'Misprint', color: palette.markMisprint, icon: ReportProblemOutlinedIcon },
  miscut: { label: 'Miscut', color: palette.markMiscut, icon: ContentCutOutlinedIcon },
  artistProof: {
    label: 'Artist proof',
    color: palette.markArtistProof,
    icon: WorkspacePremiumOutlinedIcon,
  },
} as const;

function marksFor(item: CollectionHighlight): {
  key: keyof typeof markSticker;
  label: string;
  color: string;
  icon: ReactNode;
}[] {
  return (Object.keys(markSticker) as (keyof typeof markSticker)[])
    .filter((key) => item[key])
    .map((key) => {
      const mark = markSticker[key];
      const Icon = mark.icon;
      return {
        key,
        label: mark.label,
        color: mark.color,
        icon: <Icon sx={{ fontSize: 14 }} />,
      };
    });
}

function changeLabels(item: CollectionHighlight): {
  amount: string | null;
  percent: string | null;
} {
  if (item.change === null) {
    return { amount: null, percent: item.changePercent };
  }
  const amount = Number(item.change);
  if (!Number.isFinite(amount) || amount === 0) {
    return { amount: null, percent: item.changePercent };
  }
  return {
    amount: `${amount > 0 ? '+' : '-'}${formatUsd(Math.abs(amount).toFixed(2))}`,
    percent: item.changePercent,
  };
}

function priceLabel(price: string | null): string {
  if (price === null) return '—';
  return formatUsd(price) ?? price;
}

function BinderCard({
  item,
  onSelect,
}: {
  item: CollectionHighlight;
  onSelect?: (item: CollectionHighlight) => void;
}) {
  const price = priceLabel(item.price);
  const change = changeLabels(item);
  const marks = marksFor(item);
  const foil = item.finish === 'foil' || item.finish === 'etched';
  const changeGood = change.amount?.startsWith('+') ?? change.percent?.startsWith('+') ?? false;
  const changeBad = change.amount?.startsWith('-') ?? change.percent?.startsWith('-') ?? false;

  return (
    <Box
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={onSelect ? `Open ${item.name}` : undefined}
      onClick={onSelect ? () => onSelect(item) : undefined}
      onKeyDown={
        onSelect
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect(item);
              }
            }
          : undefined
      }
      sx={{
        position: 'relative',
        minWidth: 0,
        cursor: onSelect ? 'pointer' : 'default',
        borderRadius: 2,
        transition: 'transform 150ms ease',
        '&:hover': { transform: 'translateY(-3px)' },
        '&:focus-visible': {
          outline: `2px solid ${palette.goldLight}`,
          outlineOffset: 3,
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          aspectRatio: '488 / 680',
          borderRadius: 2,
          overflow: 'hidden',
          backgroundColor: palette.surfaceRaised,
          boxShadow: '0 12px 26px rgba(0, 0, 0, 0.28)',
        }}
      >
        {item.imageUrl ? (
          <Box
            component="img"
            src={item.imageUrl}
            alt={item.name}
            title={item.name}
            loading="lazy"
            sx={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <Stack
            alignItems="center"
            justifyContent="center"
            spacing={0.5}
            sx={{ height: '100%', p: 1.5, textAlign: 'center' }}
          >
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {item.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {item.setCode.toUpperCase()}
            </Typography>
          </Stack>
        )}

        {foil ? <FoilSheen /> : null}

        {marks.length > 0 && (
          <Stack
            spacing={0.5}
            sx={{ position: 'absolute', top: 8, left: 8, zIndex: 2, alignItems: 'flex-start' }}
          >
            {marks.map((mark, index) => (
              <Stack
                key={mark.key}
                direction="row"
                spacing={0.5}
                alignItems="center"
                sx={{
                  px: 0.75,
                  py: 0.35,
                  color: palette.background,
                  backgroundColor: mark.color,
                  border: '1px solid rgba(0,0,0,0.18)',
                  borderRadius: 0.75,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.28)',
                  transform: `rotate(${index % 2 === 0 ? -3 : 2}deg)`,
                }}
              >
                {mark.icon}
                <Typography
                  sx={{ fontSize: 10, fontWeight: 700, lineHeight: 1, whiteSpace: 'nowrap' }}
                >
                  {mark.label}
                </Typography>
              </Stack>
            ))}
          </Stack>
        )}

        {item.quantity > 1 && (
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              px: 0.75,
              py: 0.35,
              color: palette.background,
              backgroundColor: palette.goldLight,
              borderRadius: 0.75,
              boxShadow: '0 2px 6px rgba(0,0,0,0.28)',
              transform: 'rotate(2deg)',
            }}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 800, lineHeight: 1 }}>
              ×{item.quantity}
            </Typography>
          </Box>
        )}

        <Box
          sx={{
            position: 'absolute',
            right: 8,
            bottom: 8,
            zIndex: 2,
            minWidth: 76,
            px: 1,
            py: 0.6,
            backgroundColor: 'rgba(20, 16, 13, 0.94)',
            border: '1px solid rgba(230, 205, 140, 0.55)',
            borderRadius: 1,
            boxShadow: '0 6px 16px rgba(0,0,0,0.38)',
            transform: 'rotate(-2deg)',
          }}
        >
          <Typography sx={{ color: '#fff', fontSize: 15, fontWeight: 800, lineHeight: 1.1 }}>
            {price}
          </Typography>
          {(change.amount || change.percent) && (
            <Stack
              direction="row"
              spacing={0.5}
              sx={{ mt: 0.25, alignItems: 'baseline', flexWrap: 'wrap' }}
            >
              {change.amount && (
                <Typography
                  sx={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    lineHeight: 1.1,
                    color: changeGood
                      ? 'success.main'
                      : changeBad
                        ? 'error.main'
                        : 'text.secondary',
                  }}
                >
                  {change.amount}
                </Typography>
              )}
              {change.percent && (
                <Typography
                  sx={{
                    fontSize: 10,
                    lineHeight: 1.1,
                    color: changeGood
                      ? 'success.main'
                      : changeBad
                        ? 'error.main'
                        : 'text.secondary',
                  }}
                >
                  {change.percent}
                </Typography>
              )}
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export function CollectionBinderView({
  items,
  onSelect,
}: {
  items: CollectionHighlight[];
  onSelect?: (item: CollectionHighlight) => void;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 1.5, sm: 2 },
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          sm: 'repeat(3, minmax(0, 1fr))',
          md: 'repeat(4, minmax(0, 1fr))',
          lg: 'repeat(5, minmax(0, 1fr))',
        },
        alignItems: 'start',
      }}
    >
      {items.map((item) => (
        <BinderCard key={item.id} item={item} onSelect={onSelect} />
      ))}
    </Box>
  );
}

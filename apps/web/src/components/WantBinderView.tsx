import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import { Box, Stack, Typography } from '@mui/material';
import type { WantItem } from '@opulent/shared';
import {
  cardConditionLabels,
  cardFinishLabels,
  cardLanguageLabels,
  wantPriorityLabels,
} from '@opulent/shared';
import type { ReactNode } from 'react';
import { palette } from '../theme';

const stickerColors = {
  language: palette.markLanguage,
  printing: palette.markPrinting,
  condition: palette.markCondition,
  set: palette.markSet,
} as const;

function joined(values: readonly string[], labels?: Record<string, string>): string {
  return values.map((value) => labels?.[value] ?? value.toUpperCase()).join(', ');
}

function specStickers(item: WantItem): {
  key: string;
  label: string;
  color: string;
  icon: ReactNode;
}[] {
  const specs = [
    {
      key: 'language',
      label: joined(item.wantedLanguages, cardLanguageLabels),
      color: stickerColors.language,
      icon: <LanguageOutlinedIcon sx={{ fontSize: 14 }} />,
    },
    {
      key: 'printing',
      label: joined(item.wantedFinishes, cardFinishLabels),
      color: stickerColors.printing,
      icon: <AutoAwesomeOutlinedIcon sx={{ fontSize: 14 }} />,
    },
    {
      key: 'condition',
      label: joined(item.wantedConditions, cardConditionLabels),
      color: stickerColors.condition,
      icon: <VerifiedOutlinedIcon sx={{ fontSize: 14 }} />,
    },
    {
      key: 'set',
      label: item.wantedSets.map((code) => code.toUpperCase()).join(', '),
      color: stickerColors.set,
      icon: <LayersOutlinedIcon sx={{ fontSize: 14 }} />,
    },
  ];
  return specs.filter((spec) => spec.label.length > 0);
}

function WantBinderCard({
  item,
  onSelect,
}: {
  item: WantItem;
  onSelect?: (item: WantItem) => void;
}) {
  const image = item.imageUris?.normal ?? item.imageUris?.large ?? item.imageUris?.small;
  const stickers = specStickers(item);

  return (
    <Box
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={onSelect ? `Open ${item.cardName ?? 'want'}` : undefined}
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
        {image ? (
          <Box
            component="img"
            src={image}
            alt={item.cardName ?? 'Card'}
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
              {item.cardName ?? 'Card'}
            </Typography>
          </Stack>
        )}

        {stickers.length > 0 && (
          <Stack
            spacing={0.5}
            sx={{ position: 'absolute', top: 8, left: 8, zIndex: 2, alignItems: 'flex-start' }}
          >
            {stickers.map((sticker, index) => (
              <Stack
                key={sticker.key}
                direction="row"
                spacing={0.5}
                alignItems="center"
                sx={{
                  px: 0.75,
                  py: 0.35,
                  color: palette.background,
                  backgroundColor: sticker.color,
                  border: '1px solid rgba(0,0,0,0.18)',
                  borderRadius: 0.75,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.28)',
                  transform: `rotate(${index % 2 === 0 ? -3 : 2}deg)`,
                  maxWidth: 'calc(100% - 52px)',
                }}
              >
                {sticker.icon}
                <Typography
                  sx={{
                    fontSize: 10,
                    fontWeight: 700,
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {sticker.label}
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
            px: 1,
            py: 0.6,
            backgroundColor: 'rgba(20, 16, 13, 0.94)',
            border: '1px solid rgba(230, 205, 140, 0.55)',
            borderRadius: 1,
            boxShadow: '0 6px 16px rgba(0,0,0,0.38)',
            transform: 'rotate(-2deg)',
          }}
        >
          <Typography
            sx={{
              color: item.priority === 1 ? palette.goldLight : '#fff',
              fontSize: 12,
              fontWeight: 800,
              lineHeight: 1.1,
            }}
          >
            {wantPriorityLabels[item.priority] ?? 'Medium'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export function WantBinderView({
  items,
  onSelect,
}: {
  items: WantItem[];
  onSelect?: (item: WantItem) => void;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: 1.5,
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          sm: 'repeat(3, minmax(0, 1fr))',
          md: 'repeat(4, minmax(0, 1fr))',
          lg: 'repeat(5, minmax(0, 1fr))',
        },
      }}
    >
      {items.map((item) => (
        <WantBinderCard key={item.id} item={item} onSelect={onSelect} />
      ))}
    </Box>
  );
}

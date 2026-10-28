import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import StyleOutlinedIcon from '@mui/icons-material/StyleOutlined';
import { Box, Paper, Stack, Typography } from '@mui/material';
import type { CollectionSummary } from '@opulent/shared';
import type { ReactNode } from 'react';
import { palette } from '@/theme';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const count = new Intl.NumberFormat('en-US');

const labelSx = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: palette.textSecondary,
} as const;

function Tile({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <Paper
      sx={{
        p: { xs: 1.25, sm: 2 },
        background: palette.surfaceRaised,
        borderColor: palette.divider,
        borderRadius: 2,
        minWidth: 0,
      }}
    >
      {/* A compact row on a phone, a stacked tile from sm up. */}
      <Stack
        direction={{ xs: 'row', sm: 'column' }}
        spacing={1}
        alignItems={{ xs: 'center', sm: 'stretch' }}
        justifyContent={{ xs: 'space-between', sm: 'flex-start' }}
      >
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="center"
          useFlexGap
          flexWrap="wrap"
          sx={{ minWidth: 0 }}
        >
          <Box sx={{ display: 'inline-flex', color: palette.steel }}>{icon}</Box>
          <Typography sx={labelSx}>{label}</Typography>
        </Stack>

        <Typography
          sx={{
            fontSize: { xs: 18, sm: 22 },
            fontWeight: 600,
            lineHeight: 1.2,
            fontVariantNumeric: 'tabular-nums',
            color: palette.textPrimary,
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </Typography>
      </Stack>
    </Paper>
  );
}

export function CollectionStats({ totals }: { totals: CollectionSummary | undefined }) {
  return (
    <Box
      sx={{
        display: 'grid',
        gap: { xs: 1, sm: 1.5 },
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
      }}
    >
      <Tile
        icon={<StyleOutlinedIcon fontSize="small" />}
        label="Cards"
        value={totals ? count.format(totals.cardCount) : '—'}
      />
      <Tile
        icon={<PaymentsOutlinedIcon fontSize="small" />}
        label="Collection value"
        value={totals ? money.format(Number(totals.marketValue)) : '—'}
      />
    </Box>
  );
}

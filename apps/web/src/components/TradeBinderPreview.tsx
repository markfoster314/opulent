import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { binderVisibilityLabels, type BinderVisibility } from '@opulent/shared';
import { Link as RouterLink } from 'react-router-dom';
import { palette } from '../theme';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** A faint grain for the leather surface. Inline, so the page needs no image file. */
const LEATHER_GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23g)' opacity='0.55'/%3E%3C/svg%3E")`;

const statLabelSx = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: palette.textSecondary,
} as const;

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
      <Typography sx={statLabelSx}>{label}</Typography>
      <Typography
        sx={{
          fontSize: { xs: 13, sm: 18 },
          fontWeight: 600,
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
          color: accent ? palette.goldLight : palette.textPrimary,
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

type OwnerProps = {
  variant: 'owner';
  username: string;
  visibility: BinderVisibility;
  cardCount: number;
  value: string;
  onTheTable: number;
};

type VisitorProps = {
  variant: 'visitor';
  username: string;
  authenticated: boolean;
  matchCount: number | null;
  matchesLoading: boolean;
};

function matchText({ authenticated, matchesLoading, matchCount }: VisitorProps): {
  text: string;
  tone: 'gold' | 'muted';
} {
  if (!authenticated) return { text: 'Sign in to see matches', tone: 'muted' };
  if (matchesLoading) return { text: 'Checking matches…', tone: 'muted' };
  if (matchCount === null) return { text: 'Matches unavailable', tone: 'muted' };
  if (matchCount === 0) return { text: 'No matches yet', tone: 'muted' };
  return { text: `${matchCount} match${matchCount === 1 ? '' : 'es'}`, tone: 'gold' };
}

/** Owner sees cards, value, and on-the-table; a visitor sees only the want-list match count. */
export function TradeBinderPreview(props: OwnerProps | VisitorProps) {
  const { username } = props;
  const visitor = props.variant === 'visitor' ? matchText(props) : null;

  return (
    <Paper
      component={RouterLink}
      to={`/u/${username}/trade-binder`}
      aria-label="Open trade binder"
      sx={{
        position: 'relative',
        display: 'block',
        overflow: 'hidden',
        p: { xs: 2, sm: 3 },
        pl: { xs: 2, sm: 6 },
        borderColor: palette.goldBorder,
        background: '#14100D',
        color: palette.textPrimary,
        textDecoration: 'none',
        '& *': { textDecoration: 'none' },
        boxShadow: 'inset 0 1px 0 rgba(240, 212, 138, 0.12), 0 18px 40px rgba(0, 0, 0, 0.35)',
        perspective: '900px',
        transformStyle: 'preserve-3d',
        transition: 'transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 8,
          border: '1px dashed rgba(212, 166, 42, 0.28)',
          borderRadius: 2,
          pointerEvents: 'none',
          zIndex: 0,
        },
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage: LEATHER_GRAIN,
          backgroundSize: '160px 160px',
          opacity: 0.06,
          mixBlendMode: 'overlay',
          pointerEvents: 'none',
          zIndex: 0,
        },
        '@media (hover: hover)': {
          '&:hover': {
            transform: 'translateY(-2px)',
            borderColor: palette.goldLight,
            boxShadow: 'inset 0 1px 0 rgba(240, 212, 138, 0.16), 0 24px 48px rgba(0, 0, 0, 0.45)',
            textDecoration: 'none',
          },
          '&:hover .binder-page': {
            transform: 'rotateY(-16deg)',
            borderRight: '1px solid rgba(240, 212, 138, 0.30)',
            boxShadow: 'inset -18px 0 26px rgba(0, 0, 0, 0.25)',
          },
        },
        '@media (prefers-reduced-motion: reduce)': {
          transition: 'none',
          '&:hover': { transform: 'none' },
          '& .binder-page': { transition: 'none' },
          '&:hover .binder-page': {
            transform: 'none',
            borderRight: 'none',
            boxShadow: 'none',
          },
        },
      }}
    >
      {/* The top page: turns on hover, never blocks the link. */}
      <Box
        aria-hidden
        className="binder-page"
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          pointerEvents: 'none',
          transformOrigin: 'left center',
          transform: 'rotateY(0deg)',
          transition: 'transform 340ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          willChange: 'transform',
        }}
      />

      {/* The spine: three rivets, and only room from sm up. */}
      <Box
        aria-hidden
        sx={{
          display: { xs: 'none', sm: 'flex' },
          position: 'absolute',
          left: 8,
          top: 8,
          bottom: 8,
          width: 34,
          borderRadius: 1,
          background: '#0B0806',
          borderRight: '1px solid rgba(212, 166, 42, 0.18)',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-around',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        {[0, 1, 2].map((rivet) => (
          <Box
            key={rivet}
            sx={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              bgcolor: 'rgba(212, 166, 42, 0.5)',
              boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.55)',
            }}
          />
        ))}
      </Box>

      <Stack spacing={2} sx={{ position: 'relative', zIndex: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
          <Typography
            variant="h3"
            sx={{ color: palette.goldLight, textShadow: '0 1px 0 rgba(0, 0, 0, 0.6)' }}
          >
            Trade binder
          </Typography>
          {props.variant === 'owner' && (
            <Chip
              size="small"
              label={binderVisibilityLabels[props.visibility]}
              color={props.visibility === 'public' ? 'primary' : 'default'}
              variant={props.visibility === 'public' ? 'filled' : 'outlined'}
            />
          )}
        </Stack>

        {props.variant === 'owner' ? (
          <Box
            sx={{
              display: 'grid',
              gap: { xs: 1, sm: 2 },
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            }}
          >
            <Stat label="Cards" value={String(props.cardCount)} />
            <Stat label="Value" value={money.format(Number(props.value))} accent />
            <Stat label="On the table" value={String(props.onTheTable)} />
          </Box>
        ) : (
          <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            <Typography sx={statLabelSx}>Matches</Typography>
            <Typography
              sx={{
                fontSize: { xs: 13, sm: 18 },
                fontWeight: 600,
                lineHeight: 1.2,
                fontVariantNumeric: 'tabular-nums',
                color: visitor?.tone === 'gold' ? palette.goldLight : palette.textSecondary,
              }}
            >
              {visitor?.text}
            </Typography>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
